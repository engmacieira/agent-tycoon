import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CEO_SPAWN_TILE, ROOM_CONFIGS, TILE_SIZE } from '../data/officeLayout';
import {
  DEFAULT_MODEL_ID,
  DEPARTMENT_TO_ROOM,
  LEGACY_MODEL_MIGRATION_MAP,
  alignContractInWarRoom,
  analyzeBriefingWithAtlas,
  auditDeliveryWithQa,
  executeSubTaskWithAgent,
  generateVegaFinopsReview,
  migrateLegacyModelId,
} from '../engine/llmClient';
import { findNearestWalkable, findPath } from '../engine/pathfinding';
import {
  DIRETORIA_DOOR_TILE,
  DIRETORIA_OUTBOX_TILE,
  QA_BENCH_TILES,
  QA_CHECKPOINT_TILE,
  SimulationRuntime,
  WAR_ROOM_SEATS,
  ensureAutonomousRuntime,
  getRoomAtPosition,
  returnAgentToHomeDesk,
  showCustomSpeechBubble,
  startAgentMission,
} from '../engine/simulationEngine';
import {
  Agent,
  AgentModelId,
  AgentSpriteVariant,
  ArtifactSection,
  BriefingOrder,
  CameraState,
  DeliveredArtifact,
  DepartmentIsland,
  EnvSecretSlot,
  InteractiveObject,
  JobRequisition,
  LocalSimLogEntry,
  OfficeClockState,
  PipelineStep,
  QaAuditRecord,
  QaSirenMode,
  RoomConfig,
  RoomId,
  SpeechBubble,
  SubTask,
  TaskPriority,
  TileCoord,
  WarRoomSession,
} from '../types/office';

const VAULT_STORAGE_KEY = 'pixelhq_env_vault_v2';
const AGENT_MODELS_STORAGE_KEY = 'pixelhq_agent_models_v1';
const OBFUSCATION_SALT = 'PIXELHQ8BIT_LOCAL_VAULT';

function migrateValueRecursively(value: unknown): { next: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const migrated = LEGACY_MODEL_MIGRATION_MAP[value.trim()];
    if (migrated && migrated !== value) {
      return { next: migrated, changed: true };
    }
    return { next: value, changed: false };
  }
  if (Array.isArray(value)) {
    let anyChanged = false;
    const nextArr = value.map((item) => {
      const res = migrateValueRecursively(item);
      if (res.changed) anyChanged = true;
      return res.next;
    });
    return { next: nextArr, changed: anyChanged };
  }
  if (value && typeof value === 'object') {
    let anyChanged = false;
    const obj = value as Record<string, unknown>;
    const nextObj: Record<string, unknown> = { ...obj };
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'model' || k === 'recommendedModel' || k === 'recommendedBudgetModel') {
        if (typeof v === 'string') {
          const migrated = migrateLegacyModelId(v);
          if (migrated !== v) {
            nextObj[k] = migrated;
            anyChanged = true;
          }
        }
      } else if (v && typeof v === 'object') {
        const res = migrateValueRecursively(v);
        if (res.changed) {
          nextObj[k] = res.next;
          anyChanged = true;
        }
      }
    }
    return { next: nextObj, changed: anyChanged };
  }
  return { next: value, changed: false };
}

function loadAndMigrateAgentModels(): Record<string, string> {
  try {
    // 1. Scan any legacy pixelhq_* localStorage entries (agents/state snapshots) and migrate old model IDs in-place
    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);
      if (
        !storageKey ||
        !storageKey.startsWith('pixelhq_') ||
        storageKey === VAULT_STORAGE_KEY ||
        storageKey === AGENT_MODELS_STORAGE_KEY
      ) {
        continue;
      }
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        const { next, changed } = migrateValueRecursively(parsed);
        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch {
        // Ignore non-JSON localStorage keys
      }
    }

    // 2. Load & migrate persisted per-agent model overrides
    const rawModels = localStorage.getItem(AGENT_MODELS_STORAGE_KEY);
    if (!rawModels) return {};
    const parsedModels = JSON.parse(rawModels) as Record<string, unknown>;
    if (!parsedModels || typeof parsedModels !== 'object') return {};

    const migratedMap: Record<string, string> = {};
    let changed = false;
    for (const [agentId, modelVal] of Object.entries(parsedModels)) {
      if (typeof modelVal === 'string' && modelVal.trim().length > 0) {
        const migrated = migrateLegacyModelId(modelVal);
        migratedMap[agentId] = migrated;
        if (migrated !== modelVal) changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(AGENT_MODELS_STORAGE_KEY, JSON.stringify(migratedMap));
    }
    return migratedMap;
  } catch {
    return {};
  }
}

function persistAgentModelsFromList(agentList: Agent[]): void {
  try {
    const modelMap: Record<string, string> = {};
    for (const ag of agentList) {
      if (ag.id !== 'ceo' && ag.model) {
        modelMap[ag.id] = migrateLegacyModelId(String(ag.model));
      }
    }
    localStorage.setItem(AGENT_MODELS_STORAGE_KEY, JSON.stringify(modelMap));
  } catch {
    // Ignore storage quota errors
  }
}

function obfuscateSecret(raw: string): string {
  const bytes = Array.from(raw).map((ch, idx) =>
    ch.charCodeAt(0) ^ OBFUSCATION_SALT.charCodeAt(idx % OBFUSCATION_SALT.length)
  );
  return btoa(String.fromCharCode(...bytes));
}

function deobfuscateSecret(encoded: string): string {
  try {
    const decoded = atob(encoded);
    return Array.from(decoded)
      .map((ch, idx) =>
        String.fromCharCode(
          ch.charCodeAt(0) ^ OBFUSCATION_SALT.charCodeAt(idx % OBFUSCATION_SALT.length)
        )
      )
      .join('');
  } catch {
    return '';
  }
}

function loadStoredKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.length > 0) {
        result[k] = deobfuscateSecret(v);
      }
    }
    return result;
  } catch {
    return {};
  }
}

function persistStoredKeys(keys: Record<string, string>): void {
  try {
    const encoded: Record<string, string> = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v.trim().length > 0) {
        encoded[k] = obfuscateSecret(v.trim());
      }
    }
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(encoded));
  } catch {
    // Ignore storage quota errors
  }
}

const SPECIALIST_NAMES: Record<DepartmentIsland, string[]> = {
  Backend: ['Kael', 'Dante', 'Igor'],
  Frontend: ['Lyra', 'Maya', 'Theo'],
  Administrativo: ['Bento', 'Clara', 'Nora'],
  Marketing: ['Iris', 'Luna', 'Caio'],
  QA: ['Soren', 'Nadia', 'Vitor'],
};

const DEPARTMENT_COLORS: Record<DepartmentIsland, { badge: string; sprite: AgentSpriteVariant; envPrefix: string }> = {
  Backend: { badge: '#22C55E', sprite: 'backend', envPrefix: 'AGENT_BACKEND' },
  Frontend: { badge: '#A855F7', sprite: 'frontend', envPrefix: 'AGENT_FRONTEND' },
  Administrativo: { badge: '#60A5FA', sprite: 'admin', envPrefix: 'AGENT_ADMIN' },
  Marketing: { badge: '#F97316', sprite: 'marketing', envPrefix: 'AGENT_MARKETING' },
  QA: { badge: '#EF4444', sprite: 'qa', envPrefix: 'AGENT_QA' },
};

const INITIAL_AGENTS: Agent[] = [
  {
    id: 'ceo',
    name: 'Dono',
    role: 'CEO',
    departmentId: 'diretoria',
    position: { x: CEO_SPAWN_TILE.x, y: CEO_SPAWN_TILE.y },
    direction: 'down',
    state: 'idle',
    spriteVariant: 'ceo',
    badgeColor: '#F59E0B',
    personality: 'Fundador visionário. Direciona metas estratégicas e aprova contratações.',
    needs: { cafe: 100, rotina: 100 },
    shortTermMemory: [],
    longTermMemory: [],
    assignedDeskId: 'slot-ceo',
    tokensUsed: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
  },
  {
    id: 'coord-team',
    name: 'Atlas',
    role: 'Coordenador de Equipe (Tech Lead & RH)',
    departmentId: 'coordenadores',
    position: { x: 43, y: 3 },
    direction: 'down',
    state: 'working',
    spriteVariant: 'coord-team',
    badgeColor: '#38BDF8',
    personality: 'Estratégico, atento a gargalos operacionais, focado em qualidade de entrega.',
    needs: { cafe: 72, rotina: 80 },
    apiKeyEnvVar: 'AGENT_TEAM_LEAD_KEY',
    model: 'gemini-3.1-pro-preview',
    dnaPrompt:
      'Você é o Coordenador de Equipe. Analisa demandas do CEO, identifica sobrecarga nas ilhas e propõe novas contratações especificando cargo, modelo de LLM ideal e justificativa técnica.',
    systemPrompt:
      'Você é o Coordenador de Equipe. Analisa demandas do CEO, identifica sobrecarga nas ilhas e propõe novas contratações especificando cargo, modelo de LLM ideal e justificativa técnica.',
    shortTermMemory: [],
    longTermMemory: [
      {
        id: 'lt-atlas-1',
        timestamp: 1,
        content: 'Escritório estruturado com 4 ilhas operacionais (Admin, Backend, Frontend, Marketing) e Lab QA.',
        importance: 5,
      },
      {
        id: 'lt-atlas-2',
        timestamp: 2,
        content: 'A Sala da Diretoria centraliza as ordens do CEO Dono para distribuição via Kanban.',
        importance: 4,
      },
    ],
    assignedDeskId: 'coord-team',
    tokensUsed: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    budgetLimitUsd: 1.0,
  },
  {
    id: 'coord-finance',
    name: 'Vega',
    role: 'Coordenador Financeiro (Controller FinOps)',
    departmentId: 'coordenadores',
    position: { x: 43, y: 6 },
    direction: 'up',
    state: 'working',
    spriteVariant: 'coord-finance',
    badgeColor: '#10B981',
    personality: 'Cauteloso, analítico, obcecado por eficiência de custo e prevenção de loops de API.',
    needs: { cafe: 58, rotina: 68 },
    apiKeyEnvVar: 'AGENT_FINANCE_COORD_KEY',
    model: 'gemini-3-flash-preview',
    dnaPrompt:
      'Você é o Coordenador Financeiro. Audita consumo de tokens por agente, calcula custos estimados e veta modelos caros quando um modelo rápido resolve.',
    systemPrompt:
      'Você é o Coordenador Financeiro. Audita consumo de tokens por agente, calcula custos estimados e veta modelos caros quando um modelo rápido resolve.',
    shortTermMemory: [],
    longTermMemory: [
      {
        id: 'lt-vega-1',
        timestamp: 1,
        content: 'Modo Simulação ativo: orçamento preservado em $0.00.',
        importance: 5,
      },
      {
        id: 'lt-vega-2',
        timestamp: 2,
        content: 'Priorizar modelos Flash / Flash-Lite para tarefas rotineiras e evitar loops de prompt.',
        importance: 5,
      },
    ],
    assignedDeskId: 'coord-finance',
    tokensUsed: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    budgetLimitUsd: 1.0,
  },
];

interface OfficeContextValue {
  rooms: RoomConfig[];
  agentsRef: React.MutableRefObject<Agent[]>;
  agents: Agent[];
  simulationRuntimeRef: React.MutableRefObject<SimulationRuntime>;
  cameraRef: React.MutableRefObject<CameraState>;
  zoomDisplay: number;
  followCeo: boolean;
  ceoCurrentRoomId: RoomId | null;
  selectedRoomId: RoomId | null;
  selectedObject: InteractiveObject | null;
  selectedAgentId: string | null;
  hoveredRoomId: RoomId | null;
  hoveredObject: InteractiveObject | null;
  hoveredAgentId: string | null;
  qaSirenActive: boolean;
  qaSirenMode: QaSirenMode;
  clock: OfficeClockState;
  envVaultSlots: EnvSecretSlot[];
  apiKeysByVar: Record<string, string>;
  localSimLogs: LocalSimLogEntry[];
  totalTokensUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  // Phase 3 & 4 TaskEngine, War Room, QA & Modals
  briefings: BriefingOrder[];
  warRoomSessions: WarRoomSession[];
  activeWarRoomSession: WarRoomSession | null;
  jobRequisitions: JobRequisition[];
  pendingRequisitions: JobRequisition[];
  deliveredArtifacts: DeliveredArtifact[];
  unreadDeliveriesCount: number;
  briefingModalOpen: boolean;
  briefingModalTab: 'briefing' | 'outbox';
  hiringModalOpen: boolean;
  isAnalyzingBriefing: boolean;
  // Actions
  selectRoom: (roomId: RoomId | null, object?: InteractiveObject | null) => void;
  selectAgent: (agentId: string | null) => void;
  setHoverTarget: (
    roomId: RoomId | null,
    object: InteractiveObject | null,
    agentId?: string | null
  ) => void;
  moveCeoToTile: (tile: TileCoord) => boolean;
  walkToRoom: (roomId: RoomId) => void;
  focusRoom: (roomId: RoomId) => void;
  focusAgent: (agentId: string) => void;
  centerOnCeo: () => void;
  adjustZoom: (delta: number) => void;
  setZoomAbsolute: (zoom: number) => void;
  setFollowCeo: (follow: boolean) => void;
  toggleQaSiren: () => void;
  toggleClockPause: () => void;
  advanceClockMinute: () => void;
  syncUiSnapshot: () => void;
  addLocalSimLog: (
    bubble: SpeechBubble,
    agentName: string,
    tokens?: number,
    costUsd?: number
  ) => void;
  updateAgentModel: (agentId: string, model: AgentModelId) => void;
  updateAgentDnaPrompt: (agentId: string, dnaPrompt: string) => void;
  saveEnvApiKey: (envVarName: string, rawKey: string) => void;
  clearEnvApiKey: (envVarName: string) => void;
  buildEnvExportText: (envVarFilter?: string) => string;
  // Phase 3 & 4 Actions
  openBriefingModal: (tab?: 'briefing' | 'outbox') => void;
  closeBriefingModal: () => void;
  openHiringModal: () => void;
  closeHiringModal: () => void;
  submitBriefing: (promptText: string, priority: TaskPriority) => Promise<void>;
  approveJobRequisition: (
    reqId: string,
    selectedModel: AgentModelId,
    apiKeyInput: string
  ) => void;
  rejectJobRequisition: (reqId: string) => void;
  markArtifactRead: (artifactId: string) => void;
  toggleAgentBudgetPause: (agentId: string) => void;
  setAgentBudgetLimit: (agentId: string, limitUsd: number) => void;
  handleDeliveryArrived: (agentId: string, artifactId: string) => void;
  handleNewHireSeated: (agentId: string) => void;
  handleWarRoomSeatArrived: (agentId: string, sessionId: string) => void;
  handleQaBenchArrived: (agentId: string, briefingId: string) => void;
  forceRetryPipeline: (briefingId: string) => void;
}

const OfficeContext = createContext<OfficeContextValue | null>(null);

export const OfficeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<RoomConfig[]>(() =>
    ROOM_CONFIGS.map((r) => ({
      ...r,
      deskSlots: r.deskSlots.map((s) => ({ ...s })),
    }))
  );

  const agentsRef = useRef<Agent[]>(
    (() => {
      const migratedModels = loadAndMigrateAgentModels();
      return INITIAL_AGENTS.map((a) => ({
        ...a,
        model: a.model
          ? (migrateLegacyModelId(migratedModels[a.id] ?? String(a.model)) as AgentModelId)
          : undefined,
        position: { ...a.position },
        needs: { ...a.needs },
        shortTermMemory: [...a.shortTermMemory],
        longTermMemory: [...a.longTermMemory],
      }));
    })()
  );
  const [agents, setAgents] = useState<Agent[]>(() => agentsRef.current);

  const simulationRuntimeRef = useRef<SimulationRuntime>({
    ceoPath: [],
    ceoTargetTile: null,
    walkAnimTimer: 0,
    walkFrame: 0,
    ambientTimer: 0,
    clockAccumulator: 0,
    autonomous: {},
    speechBubbles: [],
    dialogueSeed: 0,
  });

  const cameraRef = useRef<CameraState>({
    x: (CEO_SPAWN_TILE.x + 0.5) * TILE_SIZE,
    y: (CEO_SPAWN_TILE.y + 0.5) * TILE_SIZE,
    zoom: 1.35,
    followCeo: true,
  });

  const [zoomDisplay, setZoomDisplay] = useState<number>(1.35);
  const [followCeo, setFollowCeoState] = useState<boolean>(true);
  const [ceoCurrentRoomId, setCeoCurrentRoomId] = useState<RoomId | null>('diretoria');

  const [selectedRoomId, setSelectedRoomId] = useState<RoomId | null>(null);
  const [selectedObject, setSelectedObject] = useState<InteractiveObject | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const [hoveredRoomId, setHoveredRoomId] = useState<RoomId | null>(null);
  const [hoveredObject, setHoveredObject] = useState<InteractiveObject | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);

  const [qaSirenMode, setQaSirenMode] = useState<QaSirenMode>('off');
  const qaSirenActive = qaSirenMode !== 'off';
  const qaSirenTimerRef = useRef<number | null>(null);
  const [clock, setClock] = useState<OfficeClockState>({
    minutesOfDay: 9 * 60,
    dayCount: 1,
    isPaused: false,
  });
  const clockMinutesRef = useRef<number>(9 * 60);

  const [apiKeysByVar, setApiKeysByVar] = useState<Record<string, string>>(() => loadStoredKeys());
  const apiKeysRef = useRef<Record<string, string>>(apiKeysByVar);
  apiKeysRef.current = apiKeysByVar;

  const [localSimLogs, setLocalSimLogs] = useState<LocalSimLogEntry[]>([
    {
      id: 'init-log-1',
      timeStr: '09:00',
      agentId: 'coord-team',
      agentName: 'Atlas',
      context: 'trabalhando',
      text: 'Sala dos Coordenadores operacional. Aguardando ordens do CEO.',
      tokens: 0,
    },
    {
      id: 'init-log-2',
      timeStr: '09:00',
      agentId: 'coord-finance',
      agentName: 'Vega',
      context: 'trabalhando',
      text: 'Monitoramento FinOps ativo. Orçamento preservado em $0.00.',
      tokens: 0,
    },
  ]);

  // Phase 3 & 4 States
  const [briefings, setBriefings] = useState<BriefingOrder[]>([]);
  const briefingsRef = useRef<BriefingOrder[]>([]);
  briefingsRef.current = briefings;

  const [warRoomSessions, setWarRoomSessions] = useState<WarRoomSession[]>([]);
  const warRoomSessionsRef = useRef<WarRoomSession[]>([]);
  warRoomSessionsRef.current = warRoomSessions;
  const warRoomArrivalRef = useRef<Record<string, Set<string>>>({});
  const warRoomExecutedRef = useRef<Set<string>>(new Set());

  const qaAuditRunningRef = useRef<Set<string>>(new Set());
  const qaBenchPendingRef = useRef<Record<string, { reviewerId: string; started: boolean }>>({});

  const [jobRequisitions, setJobRequisitions] = useState<JobRequisition[]>([]);
  const jobReqsRef = useRef<JobRequisition[]>([]);
  jobReqsRef.current = jobRequisitions;

  const [deliveredArtifacts, setDeliveredArtifacts] = useState<DeliveredArtifact[]>([]);
  const stagedArtifactsRef = useRef<
    Record<string, { artifact: DeliveredArtifact; learnedFact: string }>
  >({});

  const [briefingModalOpen, setBriefingModalOpen] = useState<boolean>(false);
  const [briefingModalTab, setBriefingModalTab] = useState<'briefing' | 'outbox'>('briefing');
  const [hiringModalOpen, setHiringModalOpen] = useState<boolean>(false);
  const [isAnalyzingBriefing, setIsAnalyzingBriefing] = useState<boolean>(false);

  const syncAgentsSnapshot = useCallback(() => {
    setAgents(
      agentsRef.current.map((a) => ({
        ...a,
        position: { ...a.position },
        needs: { ...a.needs },
        shortTermMemory: [...a.shortTermMemory],
        longTermMemory: [...a.longTermMemory],
      }))
    );
  }, []);

  const setFollowCeo = useCallback((follow: boolean) => {
    cameraRef.current.followCeo = follow;
    setFollowCeoState(follow);
  }, []);

  const selectRoom = useCallback((roomId: RoomId | null, object: InteractiveObject | null = null) => {
    setSelectedAgentId(null);
    setSelectedRoomId(roomId);
    setSelectedObject(object);
  }, []);

  const selectAgent = useCallback((agentId: string | null) => {
    setSelectedRoomId(null);
    setSelectedObject(null);
    setSelectedAgentId(agentId);
  }, []);

  const setHoverTarget = useCallback(
    (
      roomId: RoomId | null,
      object: InteractiveObject | null,
      agentId: string | null = null
    ) => {
      setHoveredRoomId((prev) => (prev === roomId ? prev : roomId));
      setHoveredObject((prev) => (prev?.id === object?.id ? prev : object));
      setHoveredAgentId((prev) => (prev === agentId ? prev : agentId));
    },
    []
  );

  const moveCeoToTile = useCallback((tile: TileCoord): boolean => {
    const ceo = agentsRef.current.find((a) => a.id === 'ceo');
    if (!ceo) return false;

    const target = findNearestWalkable(tile, 3);
    if (!target) return false;

    const start: TileCoord = {
      x: Math.round(ceo.position.x),
      y: Math.round(ceo.position.y),
    };

    const path = findPath(start, target);
    if (path.length === 0) return false;

    simulationRuntimeRef.current.ceoPath = path;
    simulationRuntimeRef.current.ceoTargetTile = target;
    return true;
  }, []);

  const focusRoom = useCallback(
    (roomId: RoomId) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      cameraRef.current.followCeo = false;
      setFollowCeoState(false);
      cameraRef.current.x = (room.bounds.x + room.bounds.w / 2) * TILE_SIZE;
      cameraRef.current.y = (room.bounds.y + room.bounds.h / 2) * TILE_SIZE;
      setSelectedAgentId(null);
      setSelectedRoomId(roomId);
      setSelectedObject(null);
    },
    [rooms]
  );

  const focusAgent = useCallback((agentId: string) => {
    const agent = agentsRef.current.find((a) => a.id === agentId);
    if (!agent) return;
    cameraRef.current.followCeo = false;
    setFollowCeoState(false);
    cameraRef.current.x = (agent.position.x + 0.5) * TILE_SIZE;
    cameraRef.current.y = (agent.position.y + 0.5) * TILE_SIZE;
    setSelectedRoomId(null);
    setSelectedObject(null);
    setSelectedAgentId(agentId);
  }, []);

  const walkToRoom = useCallback(
    (roomId: RoomId) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      moveCeoToTile(room.entryTile);
      setFollowCeo(true);
    },
    [rooms, moveCeoToTile, setFollowCeo]
  );

  const centerOnCeo = useCallback(() => {
    const ceo = agentsRef.current.find((a) => a.id === 'ceo');
    if (ceo) {
      cameraRef.current.x = (ceo.position.x + 0.5) * TILE_SIZE;
      cameraRef.current.y = (ceo.position.y + 0.5) * TILE_SIZE;
    }
    cameraRef.current.followCeo = true;
    setFollowCeoState(true);
  }, []);

  const setZoomAbsolute = useCallback((zoom: number) => {
    const clamped = Math.max(0.65, Math.min(2.5, Number(zoom.toFixed(2))));
    cameraRef.current.zoom = clamped;
    setZoomDisplay(clamped);
  }, []);

  const adjustZoom = useCallback(
    (delta: number) => {
      setZoomAbsolute(cameraRef.current.zoom + delta);
    },
    [setZoomAbsolute]
  );

  const triggerQaSiren = useCallback((mode: QaSirenMode, autoResetMs?: number) => {
    if (qaSirenTimerRef.current !== null) {
      window.clearTimeout(qaSirenTimerRef.current);
      qaSirenTimerRef.current = null;
    }
    setQaSirenMode(mode);
    if (autoResetMs && mode !== 'off') {
      qaSirenTimerRef.current = window.setTimeout(() => {
        setQaSirenMode('off');
        qaSirenTimerRef.current = null;
      }, autoResetMs);
    }
  }, []);

  const toggleQaSiren = useCallback(() => {
    setQaSirenMode((prev) => (prev === 'off' ? 'test' : 'off'));
  }, []);

  const toggleClockPause = useCallback(() => {
    setClock((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const advanceClockMinute = useCallback(() => {
    setClock((prev) => {
      const next = prev.minutesOfDay + 1;
      if (next >= 24 * 60) {
        clockMinutesRef.current = 0;
        return { ...prev, minutesOfDay: 0, dayCount: prev.dayCount + 1 };
      }
      clockMinutesRef.current = next;
      return { ...prev, minutesOfDay: next };
    });
  }, []);

  const addLocalSimLog = useCallback(
    (bubble: SpeechBubble, agentName: string, tokens = 0, costUsd = 0) => {
      const mins = clockMinutesRef.current;
      const h = String(Math.floor(mins / 60) % 24).padStart(2, '0');
      const m = String(mins % 60).padStart(2, '0');
      const entry: LocalSimLogEntry = {
        id: bubble.id,
        timeStr: `${h}:${m}`,
        agentId: bubble.agentId,
        agentName,
        context: bubble.context,
        text: bubble.text,
        tokens,
        costUsd,
      };
      setLocalSimLogs((prev) => [entry, ...prev].slice(0, 40));
    },
    []
  );

  const syncUiSnapshot = useCallback(() => {
    const ceo = agentsRef.current.find((a) => a.id === 'ceo');
    if (ceo) {
      const roomId = getRoomAtPosition(ceo.position.x, ceo.position.y);
      setCeoCurrentRoomId((prev) => (prev === roomId ? prev : roomId));
    }
    syncAgentsSnapshot();
  }, [syncAgentsSnapshot]);

  const updateAgentModel = useCallback(
    (agentId: string, model: AgentModelId) => {
      const target = agentsRef.current.find((a) => a.id === agentId);
      if (!target) return;
      target.model = migrateLegacyModelId(String(model)) as AgentModelId;
      target.lastApiError = undefined;
      persistAgentModelsFromList(agentsRef.current);
      syncAgentsSnapshot();
    },
    [syncAgentsSnapshot]
  );

  const updateAgentDnaPrompt = useCallback(
    (agentId: string, dnaPrompt: string) => {
      const target = agentsRef.current.find((a) => a.id === agentId);
      if (!target) return;
      target.dnaPrompt = dnaPrompt;
      target.systemPrompt = dnaPrompt;
      syncAgentsSnapshot();
    },
    [syncAgentsSnapshot]
  );

  const saveEnvApiKey = useCallback(
    (envVarName: string, rawKey: string) => {
      setApiKeysByVar((prev) => {
        const next = { ...prev, [envVarName]: rawKey.trim() };
        persistStoredKeys(next);
        return next;
      });
      for (const ag of agentsRef.current) {
        if (ag.apiKeyEnvVar === envVarName) {
          ag.lastApiError = undefined;
        }
      }
      syncAgentsSnapshot();
    },
    [syncAgentsSnapshot]
  );

  const clearEnvApiKey = useCallback(
    (envVarName: string) => {
      setApiKeysByVar((prev) => {
        const next = { ...prev };
        delete next[envVarName];
        persistStoredKeys(next);
        return next;
      });
      for (const ag of agentsRef.current) {
        if (ag.apiKeyEnvVar === envVarName) {
          ag.lastApiError = undefined;
        }
      }
      syncAgentsSnapshot();
    },
    [syncAgentsSnapshot]
  );

  const buildEnvExportText = useCallback(
    (envVarFilter?: string) => {
      const contracted = agentsRef.current.filter((a) => Boolean(a.apiKeyEnvVar));
      const lines = ['# PixelHQ 8-Bits — Bloco de Variáveis .env'];
      for (const ag of contracted) {
        const keyName = ag.apiKeyEnvVar!;
        if (envVarFilter && keyName !== envVarFilter) continue;
        const val = apiKeysByVar[keyName] || 'COLE_SUA_CHAVE_AQUI';
        lines.push(`# ${ag.name} (${ag.role}) · Modelo: ${ag.model ?? DEFAULT_MODEL_ID}`);
        lines.push(`${keyName}="${val}"`);
      }
      return lines.join('\n');
    },
    [apiKeysByVar]
  );

  // ================= PHASE 3 & 4: DAG PIPELINE, WAR ROOM & QA LAB =================

  const getCurrentTimeStr = useCallback(() => {
    const mins = clockMinutesRef.current;
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(
      2,
      '0'
    )}`;
  }, []);

  const updateBriefingSync = useCallback(
    (briefingId: string, updater: (b: BriefingOrder) => BriefingOrder) => {
      const next = briefingsRef.current.map((b) => (b.id === briefingId ? updater(b) : b));
      briefingsRef.current = next;
      setBriefings(next);
    },
    []
  );

  const updateWarRoomSessionSync = useCallback(
    (sessionId: string, updater: (s: WarRoomSession) => WarRoomSession) => {
      const next = warRoomSessionsRef.current.map((s) => (s.id === sessionId ? updater(s) : s));
      warRoomSessionsRef.current = next;
      setWarRoomSessions(next);
    },
    []
  );

  const finalizeConsolidatedDelivery = useCallback(
    (briefingId: string, carrierAgent?: Agent) => {
      const briefing = briefingsRef.current.find((b) => b.id === briefingId);
      if (!briefing) return;

      const steps = [...(briefing.pipelineSteps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
      const productionSteps = steps.filter((s) => s.department !== 'QA');
      const qaStep = steps.find((s) => s.department === 'QA');
      const timeStr = getCurrentTimeStr();

      const totalIn =
        steps.reduce((acc, s) => acc + s.inputTokens, 0) + (briefing.qaAudit?.inputTokens ?? 0);
      const totalOut =
        steps.reduce((acc, s) => acc + s.outputTokens, 0) + (briefing.qaAudit?.outputTokens ?? 0);
      const totalCost = Number(
        (
          steps.reduce((acc, s) => acc + s.estimatedCostUsd, 0) +
          (briefing.qaAudit?.estimatedCostUsd ?? 0)
        ).toFixed(6)
      );
      const anyFallback = steps.some((s) => Boolean(s.usedFallback)) || Boolean(briefing.qaAudit?.usedFallback);

      const sections: ArtifactSection[] = [];
      const summaryLines = [
        `# Pacote Consolidado: ${briefing.title}`,
        `**Briefing:** ${briefing.prompt}`,
        `**Prioridade:** ${briefing.priority.toUpperCase()} · **Entregue às:** ${timeStr}`,
        `**Consumo do Pipeline:** ${(totalIn + totalOut).toLocaleString('pt-BR')} tokens (${totalIn} in / ${totalOut} out · $${totalCost.toFixed(4)})`,
      ];
      if (briefing.sharedContract) {
        summaryLines.push('', '## Contrato da War Room', briefing.sharedContract);
      }
      if (briefing.qaAudit) {
        const verdictLabel =
          briefing.qaAudit.verdict ??
          (briefing.qaAudit.approved ? 'APROVADO' : 'APROVADO COM RESSALVAS');
        summaryLines.push(
          '',
          '## Status de Homologação (Lab QA)',
          `- **Revisor:** ${briefing.qaAudit.reviewerName}`,
          `- **Veredito:** ${verdictLabel} (Ciclos de correção: ${briefing.qaAudit.reworkCycleUsed}/1)`,
          `- **Parecer Final:** ${briefing.qaAudit.findings}`
        );
      }

      sections.push({
        id: `sec-exec-${briefing.id}`,
        department: 'Resumo',
        label: 'Resumo Executivo',
        agentName: 'Atlas + Squad',
        model: 'Pipeline Multi-Setor',
        markdownContent: summaryLines.join('\n'),
        inputTokens: totalIn,
        outputTokens: totalOut,
        estimatedCostUsd: totalCost,
      });

      for (const st of productionSteps) {
        const ag = st.assignedAgentId
          ? agentsRef.current.find((a) => a.id === st.assignedAgentId)
          : null;
        sections.push({
          id: `sec-${st.id}`,
          department: st.department,
          label: st.department,
          agentName: ag?.name ?? st.department,
          model: String(ag?.model ?? DEFAULT_MODEL_ID),
          markdownContent: st.outputMarkdown ?? '_Sem saída registrada._',
          inputTokens: st.inputTokens,
          outputTokens: st.outputTokens,
          estimatedCostUsd: st.estimatedCostUsd,
        });
      }

      if (qaStep || briefing.qaAudit) {
        const qaReviewer = briefing.qaAudit?.reviewerName ?? 'Lab QA';
        const verdictLabel =
          briefing.qaAudit?.verdict ??
          (briefing.qaAudit?.approved === false ? 'APROVADO COM RESSALVAS' : 'APROVADO');
        const qaContent = [
          `# Relatório de Homologação — Lab QA`,
          `**Revisor:** ${qaReviewer} · **Veredito:** ${verdictLabel} · **Ciclos de Retrabalho:** ${briefing.qaAudit?.reworkCycleUsed ?? 0}/1`,
          '',
          briefing.qaAudit?.findings ?? qaStep?.outputMarkdown ?? 'Entrega homologada.',
        ].join('\n');
        sections.push({
          id: `sec-qa-${briefing.id}`,
          department: 'QA',
          label: 'Relatório QA',
          agentName: qaReviewer,
          model: String(
            agentsRef.current.find((a) => a.id === briefing.qaAudit?.reviewerAgentId)?.model ??
              DEFAULT_MODEL_ID
          ),
          markdownContent: qaContent,
          inputTokens: briefing.qaAudit?.inputTokens ?? qaStep?.inputTokens ?? 0,
          outputTokens: briefing.qaAudit?.outputTokens ?? qaStep?.outputTokens ?? 0,
          estimatedCostUsd: briefing.qaAudit?.estimatedCostUsd ?? qaStep?.estimatedCostUsd ?? 0,
        });
      }

      const consolidatedMarkdown = sections
        .map((sec) => `<!-- ${sec.label} (${sec.agentName}) -->\n${sec.markdownContent}`)
        .join('\n\n---\n\n');

      const leadAgent =
        carrierAgent ??
        agentsRef.current.find((a) => a.id === steps[steps.length - 1]?.assignedAgentId) ??
        agentsRef.current.find((a) => a.id === 'coord-team');

      if (!leadAgent) return;

      const artifact: DeliveredArtifact = {
        id: `art-pkg-${briefing.id}-${Date.now()}`,
        briefingId: briefing.id,
        subTaskId: steps[0]?.id ?? briefing.id,
        title: briefing.title,
        department: productionSteps[0]?.department ?? 'Backend',
        agentId: leadAgent.id,
        agentName:
          sections.length > 2 ? `${leadAgent.name} + Squad` : leadAgent.name,
        model: String(leadAgent.model ?? DEFAULT_MODEL_ID),
        markdownContent: consolidatedMarkdown,
        sections,
        sharedContract: briefing.sharedContract,
        qaFindings: briefing.qaAudit?.findings,
        inputTokens: totalIn,
        outputTokens: totalOut,
        estimatedCostUsd: totalCost,
        usedFallback: anyFallback,
        deliveredAt: timeStr,
        qaVerified: true,
        readByCeo: false,
      };

      stagedArtifactsRef.current[artifact.id] = {
        artifact,
        learnedFact: `Pacote "${briefing.title}" homologado no Lab QA e entregue à Diretoria.`,
      };

      startAgentMission(
        simulationRuntimeRef.current,
        leadAgent,
        'delivery_to_diretoria',
        DIRETORIA_OUTBOX_TILE,
        artifact.id
      );
      syncAgentsSnapshot();
    },
    [getCurrentTimeStr, syncAgentsSnapshot]
  );

  // Forward ref holder for mutual recursion between step runner, QA audit & pipeline scheduler
  const advancePipelineRef = useRef<(briefingId: string) => void>(() => {});
  const runQaAuditExecutionRef = useRef<(briefingId: string, reviewerId: string) => Promise<void>>(
    async () => {}
  );

  const runPipelineStep = useCallback(
    async (
      briefingId: string,
      stepId: string,
      reworkFeedbackOverride?: string,
      previousOutputOverride?: string
    ) => {
      const briefing = briefingsRef.current.find((b) => b.id === briefingId);
      const step = briefing?.pipelineSteps?.find((s) => s.id === stepId);
      if (!briefing || !step || !step.assignedAgentId) return;

      const agent = agentsRef.current.find((a) => a.id === step.assignedAgentId);
      if (!agent) return;

      const effectiveFeedback = reworkFeedbackOverride ?? step.reworkFeedback;
      const effectivePrevious = previousOutputOverride ?? step.previousOutputMarkdown;

      // Budget guard
      if (
        agent.isPausedByBudget ||
        (agent.budgetLimitUsd !== undefined && agent.estimatedCostUsd >= agent.budgetLimitUsd)
      ) {
        agent.isPausedByBudget = true;
        agent.state = 'pausado_orcamento';
        agent.activeSubTaskId = null;
        updateBriefingSync(briefingId, (b) => ({
          ...b,
          subTasks: b.subTasks.map((st) =>
            st.id === stepId ? { ...st, status: 'paused_budget' } : st
          ),
          pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
            ps.id === stepId ? { ...ps, status: 'paused_budget' } : ps
          ),
        }));
        showCustomSpeechBubble(
          simulationRuntimeRef.current,
          agent,
          'Orçamento atingido! Aguardando liberação do Vega/CEO.',
          'trabalhando',
          addLocalSimLog
        );
        syncAgentsSnapshot();
        return;
      }

      // Return agent to home desk if away (War Room, café, etc.) while preserving rework/work state
      agent.activeSubTaskId = step.id;
      returnAgentToHomeDesk(
        simulationRuntimeRef.current,
        agent,
        effectiveFeedback ? 'corrigindo_qa' : 'working'
      );

      agent.shortTermMemory = [
        {
          id: `st-${step.id}`,
          timestamp: Date.now(),
          content: effectiveFeedback
            ? `Corrigindo apontamento QA: ${effectiveFeedback.slice(0, 90)}`
            : `Executando Passo ${step.stepOrder}: ${step.title}`,
        },
      ];

      updateBriefingSync(briefingId, (b) => ({
        ...b,
        status: effectiveFeedback ? 'rework' : 'executing',
        subTasks: b.subTasks.map((st) =>
          st.id === stepId ? { ...st, status: 'em_execucao', assignedAgentId: agent.id } : st
        ),
        pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
          ps.id === stepId
            ? {
                ...ps,
                status: effectiveFeedback ? 'rework' : 'em_execucao',
                assignedAgentId: agent.id,
              }
            : ps
        ),
      }));

      showCustomSpeechBubble(
        simulationRuntimeRef.current,
        agent,
        effectiveFeedback
          ? `Corrigindo QA: ${step.title.slice(0, 28)}...`
          : `Passo ${step.stepOrder}: ${step.title.slice(0, 28)}...`,
        'trabalhando',
        addLocalSimLog
      );
      syncAgentsSnapshot();

      // Lean Handoff Context from dependency step
      const depStep = step.dependsOnStepId
        ? briefing.pipelineSteps?.find((p) => p.id === step.dependsOnStepId)
        : undefined;
      const dependencyContext = depStep?.outputSummary || depStep?.outputMarkdown;

      const subTaskPayload: SubTask = {
        id: step.id,
        briefingId,
        title: step.title,
        description: step.description,
        department: step.department,
        targetRoomId: step.targetRoomId,
        assignedAgentId: agent.id,
        status: 'em_execucao',
        stepOrder: step.stepOrder,
        dependsOnStepId: step.dependsOnStepId,
        reworkCount: step.reworkCount,
      };

      const key = agent.apiKeyEnvVar ? apiKeysRef.current[agent.apiKeyEnvVar] : undefined;
      const result = await executeSubTaskWithAgent({
        agent,
        subTask: subTaskPayload,
        agentApiKey: key,
        sharedContract: briefing.sharedContract,
        dependencyContext,
        reworkFeedback: effectiveFeedback,
        previousOutputMarkdown: effectivePrevious,
      });

      const hasApiError = Boolean(result.apiError);
      agent.lastApiError = result.apiError;

      const totalRunTokens = result.inputTokens + result.outputTokens;
      agent.inputTokens = (agent.inputTokens ?? 0) + result.inputTokens;
      agent.outputTokens = (agent.outputTokens ?? 0) + result.outputTokens;
      agent.tokensUsed += totalRunTokens;
      agent.estimatedCostUsd = Number((agent.estimatedCostUsd + result.estimatedCostUsd).toFixed(6));

      if (agent.budgetLimitUsd !== undefined && agent.estimatedCostUsd >= agent.budgetLimitUsd) {
        agent.isPausedByBudget = true;
      }

      // Extract 1-line learning and clear short-term memory
      agent.longTermMemory = [
        ...agent.longTermMemory,
        {
          id: `lt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: Date.now(),
          content: result.learnedFact,
          importance: 4,
        },
      ].slice(-8);
      agent.shortTermMemory = [];
      agent.activeSubTaskId = null;

      updateBriefingSync(briefingId, (b) => ({
        ...b,
        status: hasApiError ? 'error' : b.status,
        subTasks: b.subTasks.map((st) =>
          st.id === stepId
            ? {
                ...st,
                status: hasApiError ? 'api_error' : 'qa_review',
                outputMarkdown: result.markdownOutput,
                inputTokens: (st.inputTokens ?? 0) + result.inputTokens,
                outputTokens: (st.outputTokens ?? 0) + result.outputTokens,
                estimatedCostUsd: Number(
                  ((st.estimatedCostUsd ?? 0) + result.estimatedCostUsd).toFixed(6)
                ),
                usedFallback: result.usedFallback,
                apiError: result.apiError,
              }
            : st
        ),
        pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
          ps.id === stepId
            ? {
                ...ps,
                status: hasApiError ? 'api_error' : 'completed',
                outputMarkdown: result.markdownOutput,
                outputSummary: result.summary,
                inputTokens: ps.inputTokens + result.inputTokens,
                outputTokens: ps.outputTokens + result.outputTokens,
                estimatedCostUsd: Number(
                  (ps.estimatedCostUsd + result.estimatedCostUsd).toFixed(6)
                ),
                usedFallback: result.usedFallback,
                wasTruncated: result.wasTruncated,
                apiError: result.apiError,
                reworkFeedback: undefined,
                previousOutputMarkdown: undefined,
              }
            : ps
        ),
      }));

      if (hasApiError && result.apiError) {
        showCustomSpeechBubble(
          simulationRuntimeRef.current,
          agent,
          result.apiError.slice(0, 68),
          'trabalhando',
          addLocalSimLog
        );
        const timeStr = getCurrentTimeStr();
        const errArtifact: DeliveredArtifact = {
          id: `art-err-${stepId}-${Date.now()}`,
          briefingId,
          subTaskId: stepId,
          title: step.title,
          department: step.department,
          agentId: agent.id,
          agentName: agent.name,
          model: String(agent.model ?? DEFAULT_MODEL_ID),
          markdownContent: result.markdownOutput,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          usedFallback: false,
          deliveredAt: timeStr,
          qaVerified: false,
          readByCeo: false,
          apiError: result.apiError,
        };
        stagedArtifactsRef.current[errArtifact.id] = {
          artifact: errArtifact,
          learnedFact: result.learnedFact,
        };
        startAgentMission(
          simulationRuntimeRef.current,
          agent,
          'delivery_to_diretoria',
          DIRETORIA_OUTBOX_TILE,
          errArtifact.id
        );
        syncAgentsSnapshot();
        return;
      }

      const refreshed = briefingsRef.current.find((b) => b.id === briefingId);
      const allSteps = refreshed?.pipelineSteps ?? [];
      const isSingleStepNoQa = allSteps.length === 1 && allSteps[0].department !== 'QA';

      if (isSingleStepNoQa) {
        // Classic single-island flow: QA Checkpoint -> Diretoria Outbox
        const timeStr = getCurrentTimeStr();
        const singleArtifact: DeliveredArtifact = {
          id: `art-${stepId}-${Date.now()}`,
          briefingId,
          subTaskId: stepId,
          title: step.title,
          department: step.department,
          agentId: agent.id,
          agentName: agent.name,
          model: String(agent.model ?? DEFAULT_MODEL_ID),
          markdownContent: result.markdownOutput,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: result.estimatedCostUsd,
          usedFallback: result.usedFallback,
          deliveredAt: timeStr,
          qaVerified: true,
          readByCeo: false,
        };
        stagedArtifactsRef.current[singleArtifact.id] = {
          artifact: singleArtifact,
          learnedFact: result.learnedFact,
        };
        startAgentMission(
          simulationRuntimeRef.current,
          agent,
          'delivery_to_qa',
          QA_CHECKPOINT_TILE,
          singleArtifact.id
        );
        syncAgentsSnapshot();
        return;
      }

      agent.state = 'working';
      syncAgentsSnapshot();
      advancePipelineRef.current(briefingId);
    },
    [addLocalSimLog, getCurrentTimeStr, syncAgentsSnapshot, updateBriefingSync]
  );

  const runQaAuditExecution = useCallback(
    async (briefingId: string, reviewerId: string) => {
      if (qaAuditRunningRef.current.has(briefingId)) return;
      qaAuditRunningRef.current.add(briefingId);

      try {
        const briefing = briefingsRef.current.find((b) => b.id === briefingId);
        const reviewer = agentsRef.current.find((a) => a.id === reviewerId);
        if (!briefing || !reviewer) return;

        const reworkCycleUsed = briefing.qaAudit?.reworkCycleUsed ?? 0;
        const previousFindings =
          briefing.qaAudit && !briefing.qaAudit.approved ? briefing.qaAudit.findings : undefined;

        showCustomSpeechBubble(
          simulationRuntimeRef.current,
          reviewer,
          reworkCycleUsed >= 1
            ? 'Verificação final rápida sobre códigos corrigidos (1/1)...'
            : 'Auditando entregas e contrato no Lab QA...',
          'trabalhando',
          addLocalSimLog
        );

        const producedSteps = (briefing.pipelineSteps ?? [])
          .filter((s) => s.department !== 'QA' && s.outputMarkdown)
          .map((s) => ({
            id: s.id,
            stepOrder: s.stepOrder,
            department: s.department,
            title: s.title,
            outputMarkdown: s.outputMarkdown!,
          }));

        const qaKey = reviewer.apiKeyEnvVar ? apiKeysRef.current[reviewer.apiKeyEnvVar] : undefined;
        const audit = await auditDeliveryWithQa({
          reviewer,
          briefingPrompt: briefing.prompt,
          sharedContract: briefing.sharedContract,
          producedSteps,
          reworkCycleUsed,
          previousFindings,
          qaApiKey: qaKey,
        });

        reviewer.inputTokens = (reviewer.inputTokens ?? 0) + audit.inputTokens;
        reviewer.outputTokens = (reviewer.outputTokens ?? 0) + audit.outputTokens;
        reviewer.tokensUsed += audit.inputTokens + audit.outputTokens;
        reviewer.estimatedCostUsd = Number(
          (reviewer.estimatedCostUsd + audit.estimatedCostUsd).toFixed(6)
        );
        reviewer.lastApiError = audit.apiError;

        const qaRecord: QaAuditRecord = {
          id: `qa-${briefingId}-${Date.now()}`,
          briefingId,
          reviewerAgentId: reviewer.id,
          reviewerName: reviewer.name,
          approved: audit.approved,
          verdict: audit.verdict,
          findings: audit.findings,
          targetReworkStepId: audit.targetStepId,
          targetStepIds: audit.targetStepIds,
          reworkCycleUsed: audit.approved ? reworkCycleUsed : reworkCycleUsed + 1,
          inputTokens: audit.inputTokens,
          outputTokens: audit.outputTokens,
          estimatedCostUsd: audit.estimatedCostUsd,
          usedFallback: audit.usedFallback,
          timestamp: getCurrentTimeStr(),
        };

        if (audit.apiError) {
          triggerQaSiren('warning', 8000);
          updateBriefingSync(briefingId, (b) => ({
            ...b,
            status: 'error',
            qaAudit: qaRecord,
            apiError: audit.apiError,
            pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
              ps.department === 'QA' ? { ...ps, status: 'api_error', apiError: audit.apiError } : ps
            ),
          }));
          returnAgentToHomeDesk(simulationRuntimeRef.current, reviewer);
          syncAgentsSnapshot();
          return;
        }

        if (audit.approved) {
          triggerQaSiren('approved', 8000);
          updateBriefingSync(briefingId, (b) => ({
            ...b,
            status: 'completed',
            qaAudit: qaRecord,
            subTasks: b.subTasks.map((st) =>
              st.department === 'QA'
                ? {
                    ...st,
                    status: 'delivered',
                    outputMarkdown: audit.findings,
                    inputTokens: (st.inputTokens ?? 0) + audit.inputTokens,
                    outputTokens: (st.outputTokens ?? 0) + audit.outputTokens,
                    estimatedCostUsd: Number(
                      ((st.estimatedCostUsd ?? 0) + audit.estimatedCostUsd).toFixed(6)
                    ),
                  }
                : st
            ),
            pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
              ps.department === 'QA'
                ? {
                    ...ps,
                    status: 'completed',
                    assignedAgentId: reviewer.id,
                    outputMarkdown: audit.findings,
                    inputTokens: ps.inputTokens + audit.inputTokens,
                    outputTokens: ps.outputTokens + audit.outputTokens,
                    estimatedCostUsd: Number(
                      (ps.estimatedCostUsd + audit.estimatedCostUsd).toFixed(6)
                    ),
                    usedFallback: audit.usedFallback,
                  }
                : ps
            ),
          }));

          showCustomSpeechBubble(
            simulationRuntimeRef.current,
            reviewer,
            audit.verdict === 'APROVADO COM RESSALVAS'
              ? 'Aprovado com ressalvas no Lab QA! Levando pacote à Diretoria.'
              : 'Homologado no Lab QA! Levando pacote à Diretoria.',
            'trabalhando',
            addLocalSimLog
          );
          finalizeConsolidatedDelivery(briefingId, reviewer);
          syncAgentsSnapshot();
        } else {
          // Route rejection back to ALL failed steps and release QA lock BEFORE scheduling rework
          triggerQaSiren('warning', 8000);
          const productionSteps = (briefing.pipelineSteps ?? []).filter(
            (s) => s.department !== 'QA'
          );
          const rawTargetIds =
            audit.targetStepIds.length > 0
              ? audit.targetStepIds
              : audit.targetStepId
              ? [audit.targetStepId]
              : productionSteps[0]
              ? [productionSteps[0].id]
              : [];
          const failedIdSet = new Set(rawTargetIds);

          updateBriefingSync(briefingId, (b) => ({
            ...b,
            status: 'rework',
            qaAudit: qaRecord,
            subTasks: b.subTasks.map((st) =>
              failedIdSet.has(st.id)
                ? { ...st, status: 'em_execucao' }
                : st.department === 'QA'
                ? { ...st, status: 'queued' }
                : st
            ),
            pipelineSteps: (b.pipelineSteps ?? []).map((ps) => {
              if (failedIdSet.has(ps.id)) {
                const blockedByFailedDep =
                  Boolean(ps.dependsOnStepId) && failedIdSet.has(ps.dependsOnStepId!);
                return {
                  ...ps,
                  status: blockedByFailedDep ? 'waiting_dependency' : 'queued',
                  reworkCount: ps.reworkCount + 1,
                  reworkFeedback: audit.findings,
                  previousOutputMarkdown: ps.outputMarkdown,
                };
              }
              if (ps.department === 'QA') {
                return { ...ps, status: 'waiting_dependency', outputMarkdown: audit.findings };
              }
              return ps;
            }),
          }));

          // Return failed creators (e.g. Kael, Lyra) to their home desks with QA correction flag
          for (const ps of productionSteps) {
            if (!failedIdSet.has(ps.id) || !ps.assignedAgentId) continue;
            const creator = agentsRef.current.find((a) => a.id === ps.assignedAgentId);
            if (creator) {
              creator.activeSubTaskId = ps.id;
              returnAgentToHomeDesk(simulationRuntimeRef.current, creator, 'corrigindo_qa');
              showCustomSpeechBubble(
                simulationRuntimeRef.current,
                creator,
                'Reprovado no QA! Retornando à baia para corrigir.',
                'trabalhando',
                addLocalSimLog
              );
            }
          }

          showCustomSpeechBubble(
            simulationRuntimeRef.current,
            reviewer,
            `Falha detectada! Devolvido para correção (1/1).`,
            'trabalhando',
            addLocalSimLog
          );
          returnAgentToHomeDesk(simulationRuntimeRef.current, reviewer);
          syncAgentsSnapshot();

          // Schedule pipeline advancement AFTER finally clears qaAuditRunningRef & qaBenchPendingRef
          window.setTimeout(() => {
            advancePipelineRef.current(briefingId);
          }, 180);
        }
      } finally {
        qaAuditRunningRef.current.delete(briefingId);
        delete qaBenchPendingRef.current[briefingId];
      }
    },
    [
      addLocalSimLog,
      finalizeConsolidatedDelivery,
      getCurrentTimeStr,
      syncAgentsSnapshot,
      triggerQaSiren,
      updateBriefingSync,
    ]
  );

  runQaAuditExecutionRef.current = runQaAuditExecution;

  const startQaHomologationForBriefing = useCallback(
    (briefingId: string) => {
      const briefing = briefingsRef.current.find((b) => b.id === briefingId);
      if (!briefing || qaBenchPendingRef.current[briefingId] || qaAuditRunningRef.current.has(briefingId)) {
        return;
      }

      const qaStep = briefing.pipelineSteps?.find((s) => s.department === 'QA');
      const qaAgent =
        (qaStep?.assignedAgentId
          ? agentsRef.current.find((a) => a.id === qaStep.assignedAgentId)
          : null) ??
        agentsRef.current.find((a) => a.departmentId === 'qa-lab') ??
        agentsRef.current.find((a) => a.id === 'coord-team');

      if (!qaAgent) {
        finalizeConsolidatedDelivery(briefingId);
        return;
      }

      qaBenchPendingRef.current[briefingId] = { reviewerId: qaAgent.id, started: false };

      const isReaudit = Boolean(briefing.qaAudit && !briefing.qaAudit.approved);

      updateBriefingSync(briefingId, (b) => ({
        ...b,
        status: 'qa_homologation',
        subTasks: b.subTasks.map((st) =>
          st.department === 'QA' ? { ...st, status: 'em_execucao', assignedAgentId: qaAgent.id } : st
        ),
        pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
          ps.department === 'QA'
            ? {
                ...ps,
                status: 'qa_audit',
                assignedAgentId: qaAgent.id,
                outputMarkdown: isReaudit
                  ? 'Executando verificação final pós-retrabalho (Ciclo 1/1)...'
                  : ps.outputMarkdown,
              }
            : ps
        ),
      }));

      const benchTile = qaAgent.departmentId === 'qa-lab' ? QA_BENCH_TILES[0] : QA_BENCH_TILES[1];
      startAgentMission(
        simulationRuntimeRef.current,
        qaAgent,
        'qa_audit_bench',
        benchTile,
        briefingId
      );
      showCustomSpeechBubble(
        simulationRuntimeRef.current,
        qaAgent,
        isReaudit
          ? 'Reverificando código corrigido no Lab QA (Ciclo 1/1)...'
          : 'Indo ao Laboratório de QA para homologação!',
        'trabalhando',
        addLocalSimLog
      );
      syncAgentsSnapshot();

      // Safety fallback timer in case pathfinding takes longer or agent was already adjacent
      window.setTimeout(() => {
        const pending = qaBenchPendingRef.current[briefingId];
        if (pending && !pending.started) {
          pending.started = true;
          void runQaAuditExecutionRef.current(briefingId, pending.reviewerId);
        }
      }, 3200);
    },
    [addLocalSimLog, finalizeConsolidatedDelivery, syncAgentsSnapshot, updateBriefingSync]
  );

  const advancePipelineForBriefing = useCallback(
    (briefingId: string) => {
      const briefing = briefingsRef.current.find((b) => b.id === briefingId);
      if (!briefing) return;

      const steps = [...(briefing.pipelineSteps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
      if (steps.length === 0) return;

      const productionSteps = steps.filter((s) => s.department !== 'QA');
      const qaSteps = steps.filter((s) => s.department === 'QA');

      if (productionSteps.some((s) => s.status === 'api_error')) {
        return;
      }

      const allProductionDone = productionSteps.every((s) => s.status === 'completed');
      if (allProductionDone) {
        if (qaSteps.length > 0 && !briefing.qaAudit?.approved) {
          startQaHomologationForBriefing(briefingId);
        } else {
          finalizeConsolidatedDelivery(briefingId);
        }
        return;
      }

      const readySteps = productionSteps.filter((st) => {
        if (st.status !== 'queued' && st.status !== 'waiting_dependency') return false;
        if (!st.dependsOnStepId) return true;
        const dep = productionSteps.find((p) => p.id === st.dependsOnStepId);
        return dep?.status === 'completed';
      });

      for (const st of readySteps) {
        void runPipelineStep(briefingId, st.id);
      }
    },
    [finalizeConsolidatedDelivery, runPipelineStep, startQaHomologationForBriefing]
  );

  advancePipelineRef.current = advancePipelineForBriefing;

  const executeWarRoomAlignment = useCallback(
    async (sessionId: string) => {
      if (warRoomExecutedRef.current.has(sessionId)) return;
      warRoomExecutedRef.current.add(sessionId);

      const session = warRoomSessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;
      const briefing = briefingsRef.current.find((b) => b.id === session.briefingId);
      const atlas = agentsRef.current.find((a) => a.id === 'coord-team');
      if (!briefing || !atlas) return;

      updateWarRoomSessionSync(sessionId, (s) => ({ ...s, status: 'aligning' }));

      showCustomSpeechBubble(
        simulationRuntimeRef.current,
        atlas,
        'Alinhando schema JSON e contratos na War Room...',
        'trabalhando',
        addLocalSimLog
      );

      // Alternating participant bubble
      const peerId = session.participantAgentIds.find((id) => id !== 'coord-team');
      const peer = peerId ? agentsRef.current.find((a) => a.id === peerId) : null;
      if (peer) {
        window.setTimeout(() => {
          showCustomSpeechBubble(
            simulationRuntimeRef.current,
            peer,
            'Contrato e payload revisados com a squad!',
            'trabalhando',
            addLocalSimLog
          );
        }, 700);
      }

      const atlasKey = atlas.apiKeyEnvVar ? apiKeysRef.current[atlas.apiKeyEnvVar] : undefined;
      const stepsInput = (briefing.pipelineSteps ?? []).map((s) => ({
        stepOrder: s.stepOrder,
        department: s.department,
        title: s.title,
      }));

      const alignment = await alignContractInWarRoom({
        atlas,
        briefingPrompt: briefing.prompt,
        steps: stepsInput,
        atlasApiKey: atlasKey,
      });

      atlas.inputTokens = (atlas.inputTokens ?? 0) + alignment.inputTokens;
      atlas.outputTokens = (atlas.outputTokens ?? 0) + alignment.outputTokens;
      atlas.tokensUsed += alignment.inputTokens + alignment.outputTokens;
      atlas.estimatedCostUsd = Number(
        (atlas.estimatedCostUsd + alignment.estimatedCostUsd).toFixed(6)
      );

      updateWarRoomSessionSync(sessionId, (s) => ({
        ...s,
        status: 'completed',
        sharedContract: alignment.sharedContract,
        inputTokens: alignment.inputTokens,
        outputTokens: alignment.outputTokens,
        estimatedCostUsd: alignment.estimatedCostUsd,
        usedFallback: alignment.usedFallback,
        completedAt: getCurrentTimeStr(),
      }));

      updateBriefingSync(briefing.id, (b) => ({
        ...b,
        status: 'executing',
        sharedContract: alignment.sharedContract,
        pipelineSteps: (b.pipelineSteps ?? []).map((ps) => ({
          ...ps,
          status: ps.dependsOnStepId ? 'waiting_dependency' : 'queued',
        })),
      }));

      showCustomSpeechBubble(
        simulationRuntimeRef.current,
        atlas,
        'Contrato de API fechado! Dispersando para execução.',
        'trabalhando',
        addLocalSimLog
      );

      // Disperse War Room participants back to their home desks
      for (const pid of session.participantAgentIds) {
        const participant = agentsRef.current.find((a) => a.id === pid);
        if (participant) {
          returnAgentToHomeDesk(simulationRuntimeRef.current, participant);
        }
      }
      syncAgentsSnapshot();

      window.setTimeout(() => {
        advancePipelineRef.current(briefing.id);
      }, 650);
    },
    [
      addLocalSimLog,
      getCurrentTimeStr,
      syncAgentsSnapshot,
      updateBriefingSync,
      updateWarRoomSessionSync,
    ]
  );

  const startWarRoomForBriefing = useCallback(
    (briefingId: string) => {
      const briefing = briefingsRef.current.find((b) => b.id === briefingId);
      const atlas = agentsRef.current.find((a) => a.id === 'coord-team');
      if (!briefing || !atlas) return;
      if (briefing.warRoomSessionId) return;

      const participantIds: string[] = ['coord-team'];
      for (const st of briefing.pipelineSteps ?? []) {
        if (st.assignedAgentId && !participantIds.includes(st.assignedAgentId)) {
          participantIds.push(st.assignedAgentId);
        }
      }
      const cappedParticipants = participantIds.slice(0, WAR_ROOM_SEATS.length);

      const sessionId = `wr-${briefingId}-${Date.now()}`;
      const seatAssignments: Record<string, TileCoord> = {};
      cappedParticipants.forEach((pid, idx) => {
        const seat = WAR_ROOM_SEATS[idx % WAR_ROOM_SEATS.length];
        seatAssignments[pid] = { ...seat.tile };
      });

      const session: WarRoomSession = {
        id: sessionId,
        briefingId,
        briefingTitle: briefing.title,
        status: 'convening',
        participantAgentIds: cappedParticipants,
        seatAssignments,
        sharedContract: 'Alinhamento em andamento na Sala de Reunião...',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        usedFallback: false,
        startedAt: getCurrentTimeStr(),
      };

      warRoomArrivalRef.current[sessionId] = new Set();
      warRoomSessionsRef.current = [session, ...warRoomSessionsRef.current];
      setWarRoomSessions(warRoomSessionsRef.current);

      updateBriefingSync(briefingId, (b) => ({
        ...b,
        status: 'war_room',
        warRoomSessionId: sessionId,
        pipelineSteps: (b.pipelineSteps ?? []).map((ps) => ({ ...ps, status: 'war_room' })),
      }));

      // Walk Atlas + squad to the War Room oval table!
      for (const pid of cappedParticipants) {
        const ag = agentsRef.current.find((a) => a.id === pid);
        const seatTile = seatAssignments[pid];
        if (ag && seatTile) {
          startAgentMission(
            simulationRuntimeRef.current,
            ag,
            'war_room_meeting',
            seatTile,
            sessionId
          );
        }
      }

      showCustomSpeechBubble(
        simulationRuntimeRef.current,
        atlas,
        'Convocando squad para alinhamento na War Room!',
        'trabalhando',
        addLocalSimLog
      );
      syncAgentsSnapshot();

      // Safety timer: start alignment even if one avatar takes longer in corridor traffic
      window.setTimeout(() => {
        void executeWarRoomAlignment(sessionId);
      }, 3400);
    },
    [addLocalSimLog, executeWarRoomAlignment, getCurrentTimeStr, syncAgentsSnapshot, updateBriefingSync]
  );

  const forceRetryPipeline = useCallback(
    (briefingId: string) => {
      const briefing = briefingsRef.current.find((b) => b.id === briefingId);
      if (!briefing) return;

      qaAuditRunningRef.current.delete(briefingId);
      delete qaBenchPendingRef.current[briefingId];
      setIsAnalyzingBriefing(false);

      const atlas = agentsRef.current.find((a) => a.id === 'coord-team');
      if (atlas) {
        showCustomSpeechBubble(
          simulationRuntimeRef.current,
          atlas,
          'Destravando pipeline e reprocessando etapa pendente!',
          'trabalhando',
          addLocalSimLog
        );
      }

      // 1. If War Room is stuck convening/aligning, re-run alignment immediately
      if (briefing.requiresWarRoom && briefing.warRoomSessionId) {
        const wrSession = warRoomSessionsRef.current.find(
          (s) => s.id === briefing.warRoomSessionId
        );
        if (wrSession && wrSession.status !== 'completed') {
          warRoomExecutedRef.current.delete(wrSession.id);
          void executeWarRoomAlignment(wrSession.id);
          return;
        }
      }

      const steps = [...(briefing.pipelineSteps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
      const productionSteps = steps.filter((s) => s.department !== 'QA');
      const qaSteps = steps.filter((s) => s.department === 'QA');

      // 2. Unstick any production steps in progress, rework, error, or paused
      const stuckProdIds = new Set(
        productionSteps
          .filter(
            (s) =>
              s.status === 'in_progress' ||
              s.status === 'em_execucao' ||
              s.status === 'rework' ||
              s.status === 'api_error' ||
              s.status === 'paused_budget'
          )
          .map((s) => s.id)
      );

      if (stuckProdIds.size > 0) {
        for (const ps of productionSteps) {
          if (!stuckProdIds.has(ps.id) || !ps.assignedAgentId) continue;
          const ag = agentsRef.current.find((a) => a.id === ps.assignedAgentId);
          if (ag) {
            ag.activeSubTaskId = null;
            ag.isPausedByBudget = false;
            returnAgentToHomeDesk(
              simulationRuntimeRef.current,
              ag,
              ps.reworkFeedback ? 'corrigindo_qa' : 'working'
            );
          }
        }

        updateBriefingSync(briefingId, (b) => ({
          ...b,
          status: b.qaAudit && !b.qaAudit.approved ? 'rework' : 'executing',
          apiError: undefined,
          subTasks: b.subTasks.map((st) =>
            stuckProdIds.has(st.id)
              ? { ...st, status: 'queued', apiError: undefined }
              : st
          ),
          pipelineSteps: (b.pipelineSteps ?? []).map((ps) => {
            if (!stuckProdIds.has(ps.id)) return ps;
            const depPending =
              Boolean(ps.dependsOnStepId) &&
              (stuckProdIds.has(ps.dependsOnStepId!) ||
                productionSteps.find((p) => p.id === ps.dependsOnStepId)?.status !== 'completed');
            return {
              ...ps,
              status: depPending ? 'waiting_dependency' : 'queued',
              apiError: undefined,
            };
          }),
        }));

        syncAgentsSnapshot();
        window.setTimeout(() => {
          advancePipelineForBriefing(briefingId);
        }, 120);
        return;
      }

      // 3. If all production steps are completed, re-trigger Lab QA homologation (or delivery)
      const allProductionDone = productionSteps.every((s) => s.status === 'completed');
      if (allProductionDone) {
        if (qaSteps.length > 0 && !briefing.qaAudit?.approved) {
          updateBriefingSync(briefingId, (b) => ({
            ...b,
            status: 'qa_homologation',
            apiError: undefined,
            pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
              ps.department === 'QA'
                ? { ...ps, status: 'waiting_dependency', apiError: undefined }
                : ps
            ),
          }));
          startQaHomologationForBriefing(briefingId);
        } else {
          finalizeConsolidatedDelivery(briefingId);
        }
        return;
      }

      // 4. Otherwise advance queued/waiting steps
      advancePipelineForBriefing(briefingId);
    },
    [
      addLocalSimLog,
      advancePipelineForBriefing,
      executeWarRoomAlignment,
      finalizeConsolidatedDelivery,
      startQaHomologationForBriefing,
      syncAgentsSnapshot,
      updateBriefingSync,
    ]
  );

  const handleWarRoomSeatArrived = useCallback(
    (agentId: string, sessionId: string) => {
      const arrived = warRoomArrivalRef.current[sessionId];
      if (!arrived) return;
      arrived.add(agentId);
      const session = warRoomSessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;
      if (arrived.size >= session.participantAgentIds.length) {
        void executeWarRoomAlignment(sessionId);
      }
    },
    [executeWarRoomAlignment]
  );

  const handleQaBenchArrived = useCallback((_agentId: string, briefingId: string) => {
    const pending = qaBenchPendingRef.current[briefingId];
    if (!pending || pending.started) return;
    pending.started = true;
    void runQaAuditExecutionRef.current(briefingId, pending.reviewerId);
  }, []);

  const handleDeliveryArrived = useCallback(
    (agentId: string, artifactId: string) => {
      const staged = stagedArtifactsRef.current[artifactId];
      if (!staged) return;
      delete stagedArtifactsRef.current[artifactId];

      const { artifact, learnedFact } = staged;
      setDeliveredArtifacts((prev) => [artifact, ...prev]);

      // Post-task: extract 1 learned sentence to longTermMemory, clear shortTermMemory
      const agent = agentsRef.current.find((a) => a.id === agentId);
      if (agent) {
        agent.longTermMemory = [
          ...agent.longTermMemory,
          {
            id: `lt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            timestamp: Date.now(),
            content: learnedFact,
            importance: 4,
          },
        ].slice(-8);
        agent.shortTermMemory = [];
        agent.activeSubTaskId = null;
      }

      updateBriefingSync(artifact.briefingId, (b) => {
        const isPackage = (b.pipelineSteps?.length ?? 0) > 1;
        const updatedSubs = b.subTasks.map((st) =>
          isPackage || st.id === artifact.subTaskId
            ? {
                ...st,
                status: artifact.apiError ? ('api_error' as const) : ('delivered' as const),
              }
            : st
        );
        const allFinished = updatedSubs.every(
          (st) => st.status === 'delivered' || st.status === 'api_error'
        );
        const hasAnyError = updatedSubs.some((st) => st.status === 'api_error');
        return {
          ...b,
          status: allFinished ? (hasAnyError ? 'error' : 'completed') : b.status,
          subTasks: updatedSubs,
        };
      });

      syncAgentsSnapshot();
    },
    [syncAgentsSnapshot, updateBriefingSync]
  );

  const tryLaunchBriefingAfterHires = useCallback(
    (briefingId: string) => {
      const briefing = briefingsRef.current.find((b) => b.id === briefingId);
      if (!briefing) return;

      const hasPendingReq = jobReqsRef.current.some(
        (r) => r.briefingId === briefingId && r.status === 'pending'
      );
      if (hasPendingReq) return;

      // Ensure no newly hired agent for this briefing is still walking from Recepção
      const assignedIds = new Set(
        (briefing.pipelineSteps ?? []).map((s) => s.assignedAgentId).filter(Boolean) as string[]
      );
      const stillWalkingNewHire = Array.from(assignedIds).some((id) => {
        const auto = simulationRuntimeRef.current.autonomous[id];
        return auto?.missionKind === 'new_hire_to_desk';
      });
      if (stillWalkingNewHire) return;

      if (briefing.requiresWarRoom && !briefing.warRoomSessionId) {
        startWarRoomForBriefing(briefingId);
      } else {
        advancePipelineForBriefing(briefingId);
      }
    },
    [advancePipelineForBriefing, startWarRoomForBriefing]
  );

  const handleNewHireSeated = useCallback(
    (agentId: string) => {
      const agent = agentsRef.current.find((a) => a.id === agentId);
      if (!agent || !agent.activeSubTaskId) return;

      for (const b of briefingsRef.current) {
        const step = b.pipelineSteps?.find((s) => s.id === agent.activeSubTaskId);
        if (step) {
          agent.activeSubTaskId = null;
          updateBriefingSync(b.id, (br) => ({
            ...br,
            pipelineSteps: (br.pipelineSteps ?? []).map((ps) =>
              ps.id === step.id
                ? {
                    ...ps,
                    assignedAgentId: agent.id,
                    status: ps.dependsOnStepId ? 'waiting_dependency' : 'queued',
                  }
                : ps
            ),
            subTasks: br.subTasks.map((st) =>
              st.id === step.id ? { ...st, assignedAgentId: agent.id, status: 'queued' } : st
            ),
          }));
          tryLaunchBriefingAfterHires(b.id);
          break;
        }
      }
    },
    [tryLaunchBriefingAfterHires, updateBriefingSync]
  );

  const submitBriefing = useCallback(
    async (promptText: string, priority: TaskPriority) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;

      const atlas = agentsRef.current.find((a) => a.id === 'coord-team');
      if (!atlas) return;

      setIsAnalyzingBriefing(true);
      const createdAt = getCurrentTimeStr();
      const briefingId = `brief-${Date.now()}`;

      const newOrder: BriefingOrder = {
        id: briefingId,
        title: trimmed.length > 52 ? `${trimmed.slice(0, 52)}...` : trimmed,
        prompt: trimmed,
        priority,
        createdAt,
        status: 'analyzing',
        subTasks: [],
        pipelineSteps: [],
      };
      briefingsRef.current = [newOrder, ...briefingsRef.current];
      setBriefings(briefingsRef.current);

      atlas.state = 'planejando';
      showCustomSpeechBubble(
        simulationRuntimeRef.current,
        atlas,
        'Analisando escopo e DAG multi-setor...',
        'trabalhando',
        addLocalSimLog
      );
      syncAgentsSnapshot();

      const atlasKey = atlas.apiKeyEnvVar ? apiKeysRef.current[atlas.apiKeyEnvVar] : undefined;
      const analysis = await analyzeBriefingWithAtlas({
        atlas,
        briefingPrompt: trimmed,
        priority,
        atlasApiKey: atlasKey,
      });

      atlas.inputTokens = (atlas.inputTokens ?? 0) + analysis.inputTokens;
      atlas.outputTokens = (atlas.outputTokens ?? 0) + analysis.outputTokens;
      atlas.tokensUsed += analysis.inputTokens + analysis.outputTokens;
      atlas.estimatedCostUsd = Number(
        (atlas.estimatedCostUsd + analysis.estimatedCostUsd).toFixed(6)
      );

      if (analysis.apiError) {
        atlas.lastApiError = analysis.apiError;
        updateBriefingSync(briefingId, (b) => ({
          ...b,
          status: 'error',
          apiError: analysis.apiError,
          subTasks: [],
          pipelineSteps: [],
        }));
        showCustomSpeechBubble(
          simulationRuntimeRef.current,
          atlas,
          analysis.apiError.slice(0, 68),
          'trabalhando',
          addLocalSimLog
        );
        returnAgentToHomeDesk(simulationRuntimeRef.current, atlas);
        setIsAnalyzingBriefing(false);
        syncAgentsSnapshot();
        return;
      }

      atlas.lastApiError = undefined;

      const createdSubTasks: SubTask[] = [];
      const createdSteps: PipelineStep[] = [];
      const createdRequisitions: JobRequisition[] = [];

      // Map Atlas plan stepId -> runtime stepId
      const stepIdMap: Record<string, string> = {};
      analysis.subTasks.forEach((plan, idx) => {
        stepIdMap[plan.stepId] = `sub-${briefingId}-${idx + 1}`;
      });

      const activeTaskCountByAgent: Record<string, number> = {};
      for (const b of briefingsRef.current) {
        for (const st of b.subTasks) {
          if (
            st.assignedAgentId &&
            (st.status === 'queued' || st.status === 'in_progress' || st.status === 'em_execucao')
          ) {
            activeTaskCountByAgent[st.assignedAgentId] =
              (activeTaskCountByAgent[st.assignedAgentId] ?? 0) + 1;
          }
        }
      }

      const existingSpecialistsCountByDept: Record<DepartmentIsland, number> = {
        Backend: agentsRef.current.filter((a) => a.departmentId === 'backend').length,
        Frontend: agentsRef.current.filter((a) => a.departmentId === 'frontend').length,
        Administrativo: agentsRef.current.filter((a) => a.departmentId === 'admin').length,
        Marketing: agentsRef.current.filter((a) => a.departmentId === 'marketing').length,
        QA: agentsRef.current.filter((a) => a.departmentId === 'qa-lab').length,
      };

      const uniqueIslands = new Set<DepartmentIsland>();

      analysis.subTasks.forEach((plan, idx) => {
        uniqueIslands.add(plan.department);
        const targetRoomId = DEPARTMENT_TO_ROOM[plan.department];
        const stepId = stepIdMap[plan.stepId] ?? `sub-${briefingId}-${idx + 1}`;
        const mappedDepId = plan.dependsOnStepId ? stepIdMap[plan.dependsOnStepId] ?? null : null;

        const candidates = agentsRef.current.filter(
          (a) =>
            a.departmentId === targetRoomId &&
            !a.isPausedByBudget &&
            (activeTaskCountByAgent[a.id] ?? 0) < 2 &&
            !a.activeSubTaskId
        );

        const chosen = candidates[0] ?? null;
        const roomObj = rooms.find((r) => r.id === targetRoomId);
        const freeSlotsCount = roomObj
          ? roomObj.deskSlots.filter((s) => s.occupiedByAgentId === null).length
          : 0;
        const plannedInBatchForDept = createdRequisitions.filter(
          (r) => r.department === plan.department
        ).length;

        if (chosen) {
          activeTaskCountByAgent[chosen.id] = (activeTaskCountByAgent[chosen.id] ?? 0) + 1;
          createdSubTasks.push({
            id: stepId,
            briefingId,
            title: plan.title,
            description: plan.description,
            department: plan.department,
            targetRoomId,
            assignedAgentId: chosen.id,
            status: 'queued',
            stepOrder: plan.stepOrder,
            dependsOnStepId: mappedDepId,
            reworkCount: 0,
          });
          createdSteps.push({
            id: stepId,
            stepOrder: plan.stepOrder,
            title: plan.title,
            description: plan.description,
            department: plan.department,
            targetRoomId,
            dependsOnStepId: mappedDepId,
            assignedAgentId: chosen.id,
            status: mappedDepId ? 'waiting_dependency' : 'queued',
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            reworkCount: 0,
          });
        } else if (freeSlotsCount - plannedInBatchForDept > 0) {
          existingSpecialistsCountByDept[plan.department] += 1;
          const slotNum = String(existingSpecialistsCountByDept[plan.department]).padStart(2, '0');
          const envPrefix = DEPARTMENT_COLORS[plan.department].envPrefix;
          const finopsReview = generateVegaFinopsReview({
            department: plan.department,
            recommendedModel: plan.recommendedModel,
            subTaskTitle: plan.title,
          });

          const req: JobRequisition = {
            id: `req-${stepId}`,
            briefingId,
            subTaskId: stepId,
            title: plan.recommendedRoleTitle,
            department: plan.department,
            targetRoomId,
            recommendedModel: plan.recommendedModel,
            justification: plan.justification,
            generatedDnaPrompt: plan.generatedDnaPrompt,
            suggestedEnvVar: `${envPrefix}_${slotNum}_KEY`,
            finopsReview,
            status: 'pending',
          };
          createdRequisitions.push(req);

          createdSubTasks.push({
            id: stepId,
            briefingId,
            title: plan.title,
            description: plan.description,
            department: plan.department,
            targetRoomId,
            assignedAgentId: null,
            status: 'pending_hire',
            stepOrder: plan.stepOrder,
            dependsOnStepId: mappedDepId,
            reworkCount: 0,
          });
          createdSteps.push({
            id: stepId,
            stepOrder: plan.stepOrder,
            title: plan.title,
            description: plan.description,
            department: plan.department,
            targetRoomId,
            dependsOnStepId: mappedDepId,
            assignedAgentId: null,
            status: 'pending_hire',
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            reworkCount: 0,
          });
        } else {
          const allDeptAgents = agentsRef.current.filter((a) => a.departmentId === targetRoomId);
          const fallbackAgent = allDeptAgents[0] ?? atlas;
          createdSubTasks.push({
            id: stepId,
            briefingId,
            title: plan.title,
            description: plan.description,
            department: plan.department,
            targetRoomId,
            assignedAgentId: fallbackAgent.id,
            status: 'queued',
            stepOrder: plan.stepOrder,
            dependsOnStepId: mappedDepId,
            reworkCount: 0,
          });
          createdSteps.push({
            id: stepId,
            stepOrder: plan.stepOrder,
            title: plan.title,
            description: plan.description,
            department: plan.department,
            targetRoomId,
            dependsOnStepId: mappedDepId,
            assignedAgentId: fallbackAgent.id,
            status: mappedDepId ? 'waiting_dependency' : 'queued',
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            reworkCount: 0,
          });
        }
      });

      const requiresWarRoom = uniqueIslands.size >= 2;

      updateBriefingSync(briefingId, (b) => ({
        ...b,
        status: createdRequisitions.length > 0 ? 'awaiting_hires' : 'executing',
        requiresWarRoom,
        subTasks: createdSubTasks,
        pipelineSteps: createdSteps,
      }));

      if (createdRequisitions.length > 0) {
        jobReqsRef.current = [...jobReqsRef.current, ...createdRequisitions];
        setJobRequisitions(jobReqsRef.current);
        startAgentMission(
          simulationRuntimeRef.current,
          atlas,
          'atlas_alert_diretoria',
          DIRETORIA_DOOR_TILE,
          briefingId
        );
        setIsAnalyzingBriefing(false);
        syncAgentsSnapshot();
        return;
      }

      setIsAnalyzingBriefing(false);
      syncAgentsSnapshot();

      if (requiresWarRoom) {
        startWarRoomForBriefing(briefingId);
      } else {
        returnAgentToHomeDesk(simulationRuntimeRef.current, atlas);
        advancePipelineForBriefing(briefingId);
      }
    },
    [
      addLocalSimLog,
      advancePipelineForBriefing,
      getCurrentTimeStr,
      rooms,
      startWarRoomForBriefing,
      syncAgentsSnapshot,
      updateBriefingSync,
    ]
  );

  const approveJobRequisition = useCallback(
    (reqId: string, selectedModel: AgentModelId, apiKeyInput: string) => {
      const req = jobReqsRef.current.find((r) => r.id === reqId);
      if (!req || req.status !== 'pending') return;

      const finalKey = apiKeyInput.trim();
      if (finalKey) {
        saveEnvApiKey(req.suggestedEnvVar, finalKey);
      }

      const targetRoom = rooms.find((r) => r.id === req.targetRoomId);
      const freeSlot = targetRoom?.deskSlots.find((s) => s.occupiedByAgentId === null);
      if (!freeSlot) return;

      const existingInDept = agentsRef.current.filter(
        (a) => a.departmentId === req.targetRoomId
      ).length;
      const namePool = SPECIALIST_NAMES[req.department];
      const specialistName = namePool[existingInDept % namePool.length];
      const theme = DEPARTMENT_COLORS[req.department];
      const newAgentId = `agent-${req.department.toLowerCase()}-${Date.now().toString().slice(-4)}`;

      const newAgent: Agent = {
        id: newAgentId,
        name: specialistName,
        role: req.title,
        departmentId: req.targetRoomId,
        position: { x: 6, y: 34 },
        direction: 'up',
        state: 'indo_baia',
        spriteVariant: theme.sprite,
        badgeColor: theme.badge,
        personality: `Especialista contratado para a ilha ${req.department}.`,
        needs: { cafe: 90, rotina: 95 },
        apiKeyEnvVar: req.suggestedEnvVar,
        model: migrateLegacyModelId(String(selectedModel)) as AgentModelId,
        dnaPrompt: req.generatedDnaPrompt,
        systemPrompt: req.generatedDnaPrompt,
        shortTermMemory: [],
        longTermMemory: [
          {
            id: `lt-${newAgentId}-1`,
            timestamp: Date.now(),
            content: `Contratado via Diretoria para ${req.title} na ilha ${req.department}.`,
            importance: 5,
          },
        ],
        assignedDeskId: freeSlot.id,
        tokensUsed: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        budgetLimitUsd: 1.0,
        activeSubTaskId: req.subTaskId,
      };

      agentsRef.current.push(newAgent);
      persistAgentModelsFromList(agentsRef.current);

      const auto = ensureAutonomousRuntime(simulationRuntimeRef.current, newAgent);
      auto.homeTile = { ...freeSlot.seatTile };
      auto.homeFacing = freeSlot.facing;

      startAgentMission(
        simulationRuntimeRef.current,
        newAgent,
        'new_hire_to_desk',
        freeSlot.seatTile,
        req.subTaskId
      );

      showCustomSpeechBubble(
        simulationRuntimeRef.current,
        newAgent,
        `Cheguei na Recepção! Indo para minha baia em ${req.department}.`,
        'encontro_corredor',
        addLocalSimLog
      );

      setRooms((prev) =>
        prev.map((r) =>
          r.id === req.targetRoomId
            ? {
                ...r,
                deskSlots: r.deskSlots.map((s) =>
                  s.id === freeSlot.id ? { ...s, occupiedByAgentId: newAgentId } : s
                ),
              }
            : r
        )
      );

      updateBriefingSync(req.briefingId, (b) => ({
        ...b,
        subTasks: b.subTasks.map((st) =>
          st.id === req.subTaskId ? { ...st, assignedAgentId: newAgentId, status: 'queued' } : st
        ),
        pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
          ps.id === req.subTaskId
            ? {
                ...ps,
                assignedAgentId: newAgentId,
                status: ps.dependsOnStepId ? 'waiting_dependency' : 'queued',
              }
            : ps
        ),
      }));

      const nextReqs = jobReqsRef.current.map((r) =>
        r.id === reqId ? { ...r, status: 'approved' as const, recommendedModel: selectedModel } : r
      );
      jobReqsRef.current = nextReqs;
      setJobRequisitions(nextReqs);

      const remainingPending = nextReqs.filter((r) => r.status === 'pending');
      if (remainingPending.length === 0) {
        const atlas = agentsRef.current.find((a) => a.id === 'coord-team');
        if (atlas) {
          returnAgentToHomeDesk(simulationRuntimeRef.current, atlas);
        }
        setHiringModalOpen(false);
      }

      syncAgentsSnapshot();
    },
    [rooms, saveEnvApiKey, addLocalSimLog, syncAgentsSnapshot, updateBriefingSync]
  );

  const rejectJobRequisition = useCallback(
    (reqId: string) => {
      const targetReq = jobReqsRef.current.find((r) => r.id === reqId);
      const nextReqs = jobReqsRef.current.map((r) =>
        r.id === reqId ? { ...r, status: 'rejected' as const } : r
      );
      jobReqsRef.current = nextReqs;
      setJobRequisitions(nextReqs);

      if (targetReq) {
        const atlas = agentsRef.current.find((a) => a.id === 'coord-team');
        updateBriefingSync(targetReq.briefingId, (b) => ({
          ...b,
          pipelineSteps: (b.pipelineSteps ?? []).map((ps) =>
            ps.id === targetReq.subTaskId
              ? {
                  ...ps,
                  assignedAgentId: atlas?.id ?? null,
                  status: ps.dependsOnStepId ? 'waiting_dependency' : 'queued',
                }
              : ps
          ),
          subTasks: b.subTasks.map((st) =>
            st.id === targetReq.subTaskId
              ? { ...st, assignedAgentId: atlas?.id ?? null, status: 'queued' }
              : st
          ),
        }));
        tryLaunchBriefingAfterHires(targetReq.briefingId);
      }

      const remainingPending = nextReqs.filter((r) => r.status === 'pending');
      if (remainingPending.length === 0) {
        const atlas = agentsRef.current.find((a) => a.id === 'coord-team');
        if (atlas) returnAgentToHomeDesk(simulationRuntimeRef.current, atlas);
        setHiringModalOpen(false);
      }
    },
    [tryLaunchBriefingAfterHires, updateBriefingSync]
  );

  const markArtifactRead = useCallback((artifactId: string) => {
    setDeliveredArtifacts((prev) =>
      prev.map((a) => (a.id === artifactId ? { ...a, readByCeo: true } : a))
    );
  }, []);

  const toggleAgentBudgetPause = useCallback(
    (agentId: string) => {
      const agent = agentsRef.current.find((a) => a.id === agentId);
      if (!agent || agent.id === 'ceo') return;
      agent.isPausedByBudget = !agent.isPausedByBudget;
      if (agent.isPausedByBudget) {
        agent.state = 'pausado_orcamento';
      } else {
        agent.state = 'working';
      }
      syncAgentsSnapshot();
    },
    [syncAgentsSnapshot]
  );

  const setAgentBudgetLimit = useCallback(
    (agentId: string, limitUsd: number) => {
      const agent = agentsRef.current.find((a) => a.id === agentId);
      if (!agent) return;
      agent.budgetLimitUsd = Math.max(0.01, Number(limitUsd.toFixed(2)));
      if (agent.estimatedCostUsd < agent.budgetLimitUsd && agent.isPausedByBudget) {
        agent.isPausedByBudget = false;
        agent.state = 'working';
      }
      syncAgentsSnapshot();
    },
    [syncAgentsSnapshot]
  );

  const openBriefingModal = useCallback((tab: 'briefing' | 'outbox' = 'briefing') => {
    setBriefingModalTab(tab);
    setBriefingModalOpen(true);
  }, []);

  const closeBriefingModal = useCallback(() => {
    setBriefingModalOpen(false);
  }, []);

  const openHiringModal = useCallback(() => {
    setHiringModalOpen(true);
  }, []);

  const closeHiringModal = useCallback(() => {
    setHiringModalOpen(false);
  }, []);

  const envVaultSlots: EnvSecretSlot[] = useMemo(() => {
    return agents
      .filter((a) => Boolean(a.apiKeyEnvVar))
      .map((a) => ({
        keyName: a.apiKeyEnvVar!,
        provider: String(a.model ?? DEFAULT_MODEL_ID),
        scope: `${a.name} · ${a.role}`,
        linked: Boolean(apiKeysByVar[a.apiKeyEnvVar!]?.length),
      }));
  }, [agents, apiKeysByVar]);

  const pendingRequisitions = useMemo(
    () => jobRequisitions.filter((r) => r.status === 'pending'),
    [jobRequisitions]
  );

  const unreadDeliveriesCount = useMemo(
    () => deliveredArtifacts.filter((a) => !a.readByCeo).length,
    [deliveredArtifacts]
  );

  const totalTokensUsed = useMemo(
    () => agents.reduce((acc, a) => acc + a.tokensUsed, 0),
    [agents]
  );
  const totalInputTokens = useMemo(
    () => agents.reduce((acc, a) => acc + (a.inputTokens ?? 0), 0),
    [agents]
  );
  const totalOutputTokens = useMemo(
    () => agents.reduce((acc, a) => acc + (a.outputTokens ?? 0), 0),
    [agents]
  );
  const totalCostUsd = useMemo(
    () => agents.reduce((acc, a) => acc + a.estimatedCostUsd, 0),
    [agents]
  );

  const activeWarRoomSession = useMemo(
    () =>
      warRoomSessions.find((s) => s.status !== 'completed') ?? warRoomSessions[0] ?? null,
    [warRoomSessions]
  );

  return (
    <OfficeContext.Provider
      value={{
        rooms,
        agentsRef,
        agents,
        simulationRuntimeRef,
        cameraRef,
        zoomDisplay,
        followCeo,
        ceoCurrentRoomId,
        selectedRoomId,
        selectedObject,
        selectedAgentId,
        hoveredRoomId,
        hoveredObject,
        hoveredAgentId,
        qaSirenActive,
        qaSirenMode,
        clock,
        envVaultSlots,
        apiKeysByVar,
        localSimLogs,
        totalTokensUsed,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        briefings,
        warRoomSessions,
        activeWarRoomSession,
        jobRequisitions,
        pendingRequisitions,
        deliveredArtifacts,
        unreadDeliveriesCount,
        briefingModalOpen,
        briefingModalTab,
        hiringModalOpen,
        isAnalyzingBriefing,
        selectRoom,
        selectAgent,
        setHoverTarget,
        moveCeoToTile,
        walkToRoom,
        focusRoom,
        focusAgent,
        centerOnCeo,
        adjustZoom,
        setZoomAbsolute,
        setFollowCeo,
        toggleQaSiren,
        toggleClockPause,
        advanceClockMinute,
        syncUiSnapshot,
        addLocalSimLog,
        updateAgentModel,
        updateAgentDnaPrompt,
        saveEnvApiKey,
        clearEnvApiKey,
        buildEnvExportText,
        openBriefingModal,
        closeBriefingModal,
        openHiringModal,
        closeHiringModal,
        submitBriefing,
        approveJobRequisition,
        rejectJobRequisition,
        markArtifactRead,
        toggleAgentBudgetPause,
        setAgentBudgetLimit,
        handleDeliveryArrived,
        handleNewHireSeated,
        handleWarRoomSeatArrived,
        handleQaBenchArrived,
        forceRetryPipeline,
      }}
    >
      {children}
    </OfficeContext.Provider>
  );
};

export function useOffice(): OfficeContextValue {
  const ctx = useContext(OfficeContext);
  if (!ctx) throw new Error('useOffice must be used within OfficeProvider');
  return ctx;
}
