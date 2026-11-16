export type Direction = 'down' | 'up' | 'left' | 'right';

export type WingId = 'Norte' | 'Central' | 'Sul';

export type RoomId =
  | 'diretoria'
  | 'war-room'
  | 'coordenadores'
  | 'admin'
  | 'backend'
  | 'frontend'
  | 'marketing'
  | 'qa-lab'
  | 'recepcao'
  | 'cpd'
  | 'refeitorio'
  | 'recreacao'
  | 'banheiro';

export type FloorStyle =
  | 'corridor'
  | 'wood-noble'
  | 'carpet-executive'
  | 'wood-light'
  | 'carpet-admin'
  | 'carpet-backend'
  | 'carpet-frontend'
  | 'carpet-marketing'
  | 'lab-tile'
  | 'marble'
  | 'server-grid'
  | 'checkerboard'
  | 'lounge-cork'
  | 'bathroom-tile';

export type WallStyle = 'solid' | 'glass' | 'low-divider' | 'reinforced';

export type FurnitureType =
  | 'ceo-desk-h'
  | 'ceo-desk-v'
  | 'ceo-console'
  | 'ceo-chair'
  | 'bookshelf-trophy'
  | 'plant-tall'
  | 'plant-small'
  | 'guest-chair'
  | 'projector-screen'
  | 'oval-table-left'
  | 'oval-table-mid'
  | 'oval-table-right'
  | 'office-chair-down'
  | 'office-chair-up'
  | 'whiteboard'
  | 'water-cooler'
  | 'kanban-board'
  | 'coord-desk'
  | 'filing-cabinet'
  | 'desk-admin'
  | 'desk-backend'
  | 'desk-frontend'
  | 'desk-marketing'
  | 'printer-8bit'
  | 'mini-rack'
  | 'wireframe-board'
  | 'campaign-board'
  | 'qa-bench'
  | 'qa-magnifier'
  | 'qa-siren'
  | 'reception-counter'
  | 'sofa-v'
  | 'sofa-h'
  | 'coffee-table'
  | 'server-rack'
  | 'ac-unit'
  | 'vault-terminal'
  | 'fridge'
  | 'espresso-counter'
  | 'microwave-counter'
  | 'cafe-table'
  | 'stool'
  | 'arcade-cabinet'
  | 'beanbag-cyan'
  | 'beanbag-amber'
  | 'pingpong-table'
  | 'sink-mirror'
  | 'toilet-stall'
  | 'locker';

export interface TileCoord {
  x: number;
  y: number;
}

export interface RoomBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DeskSlot {
  id: string;
  label: string;
  roleTitle: string;
  deskTile: TileCoord;
  seatTile: TileCoord;
  facing: Direction;
  occupiedByAgentId: string | null;
}

export interface InteractiveObject {
  id: string;
  roomId: RoomId;
  type: FurnitureType;
  label: string;
  description: string;
  tiles: TileCoord[];
  /** Primary anchor tile for rendering multi-tile sprites */
  anchor: TileCoord;
  widthTiles: number;
  heightTiles: number;
  solid: boolean;
  interactive: boolean;
  /** Optional key for special drawer panels */
  specialAction?: 'ceo-console' | 'env-vault' | 'qa-siren' | 'espresso' | 'arcade' | 'kanban';
}

export interface RoomConfig {
  id: RoomId;
  name: string;
  shortName: string;
  wing: WingId;
  floorStyle: FloorStyle;
  accentColor: string;
  bounds: RoomBounds;
  signTile: TileCoord;
  entryTile: TileCoord;
  capacity: number;
  roleDescription: string;
  deskSlots: DeskSlot[];
}

export interface AgentMemoryEntry {
  id: string;
  timestamp: number;
  content: string;
  importance?: number;
}

export type AgentState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'meeting'
  | 'em_reuniao'
  | 'indo_reuniao'
  | 'homologando_qa'
  | 'corrigindo_qa'
  | 'break'
  | 'indo_cafe'
  | 'tomando_cafe'
  | 'auditando_infra'
  | 'planejando'
  | 'indo_diretoria_alerta'
  | 'aguardando_aprovacao'
  | 'indo_baia'
  | 'indo_qa'
  | 'entregando_diretoria'
  | 'pausado_orcamento';

export type QaSirenMode = 'off' | 'test' | 'approved' | 'warning';

export type KnownAgentModelId =
  | 'gemini-3.1-pro-preview'
  | 'gemini-3-flash-preview'
  | 'gemini-3.1-flash-lite-preview'
  | 'claude-sonnet-4-5'
  | 'gpt-4o-mini';

export type AgentModelId = KnownAgentModelId | (string & {});

export interface AgentNeeds {
  cafe: number; // 0-100
  rotina: number; // 0-100
}

export type AgentSpriteVariant =
  | 'ceo'
  | 'coord-team'
  | 'coord-finance'
  | 'coordinator'
  | 'admin'
  | 'backend'
  | 'frontend'
  | 'marketing'
  | 'qa'
  | 'reception';

export interface Agent {
  id: string;
  name: string;
  role: string;
  departmentId: RoomId;
  position: { x: number; y: number };
  direction: Direction;
  state: AgentState;
  spriteVariant: AgentSpriteVariant;
  badgeColor?: string;
  personality?: string;
  needs: AgentNeeds;
  // Phase 2 AI Agent Readiness
  apiKeyEnvVar?: string;
  model?: AgentModelId | string;
  systemPrompt?: string;
  dnaPrompt?: string;
  shortTermMemory: AgentMemoryEntry[];
  longTermMemory: AgentMemoryEntry[];
  assignedDeskId?: string;
  tokensUsed: number;
  estimatedCostUsd: number;
  // Phase 3 FinOps & Task Execution
  inputTokens?: number;
  outputTokens?: number;
  isPausedByBudget?: boolean;
  budgetLimitUsd?: number;
  activeSubTaskId?: string | null;
  lastApiError?: string;
}

export type DialogueContext = 'na_copa' | 'no_cpd' | 'encontro_corredor' | 'trabalhando';

export interface SpeechBubble {
  id: string;
  agentId: string;
  text: string;
  context: DialogueContext;
  createdAt: number;
  expiresAt: number;
}

export interface LocalSimLogEntry {
  id: string;
  timeStr: string;
  agentId: string;
  agentName: string;
  context: DialogueContext;
  text: string;
  tokens: number;
  costUsd?: number;
}

export type TaskPriority = 'baixa' | 'media' | 'alta' | 'critica';

export type DepartmentIsland = 'Backend' | 'Frontend' | 'Administrativo' | 'Marketing' | 'QA';

export type SubTaskStatus =
  | 'pending_hire'
  | 'queued'
  | 'in_progress'
  | 'em_execucao'
  | 'qa_review'
  | 'delivered'
  | 'paused_budget'
  | 'api_error';

export type PipelineStepStatus =
  | 'pending_hire'
  | 'war_room'
  | 'waiting_dependency'
  | 'queued'
  | 'in_progress'
  | 'em_execucao'
  | 'qa_audit'
  | 'rework'
  | 'completed'
  | 'paused_budget'
  | 'api_error';

export interface PipelineStep {
  id: string;
  stepOrder: number;
  title: string;
  description: string;
  department: DepartmentIsland;
  targetRoomId: RoomId;
  dependsOnStepId: string | null;
  assignedAgentId: string | null;
  status: PipelineStepStatus;
  outputMarkdown?: string;
  outputSummary?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usedFallback?: boolean;
  apiError?: string;
  wasTruncated?: boolean;
  reworkCount: number;
  reworkFeedback?: string;
  previousOutputMarkdown?: string;
}

export interface WarRoomSession {
  id: string;
  briefingId: string;
  briefingTitle: string;
  status: 'convening' | 'aligning' | 'completed';
  participantAgentIds: string[];
  seatAssignments: Record<string, TileCoord>;
  sharedContract: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  startedAt: string;
  completedAt?: string;
}

export type QaVerdict = 'APROVADO' | 'APROVADO COM RESSALVAS' | 'REPROVADO';

export interface QaAuditRecord {
  id: string;
  briefingId: string;
  reviewerAgentId: string;
  reviewerName: string;
  approved: boolean;
  verdict?: QaVerdict;
  findings: string;
  targetReworkStepId?: string;
  targetStepIds?: string[];
  reworkCycleUsed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  timestamp: string;
}

export interface SubTask {
  id: string;
  briefingId: string;
  title: string;
  description: string;
  department: DepartmentIsland;
  targetRoomId: RoomId;
  assignedAgentId: string | null;
  status: SubTaskStatus;
  stepOrder?: number;
  dependsOnStepId?: string | null;
  reworkCount?: number;
  outputMarkdown?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  usedFallback?: boolean;
  apiError?: string;
}

export interface BriefingOrder {
  id: string;
  title: string;
  prompt: string;
  priority: TaskPriority;
  createdAt: string;
  status:
    | 'analyzing'
    | 'awaiting_hires'
    | 'war_room'
    | 'executing'
    | 'qa_homologation'
    | 'rework'
    | 'completed'
    | 'error';
  subTasks: SubTask[];
  pipelineSteps?: PipelineStep[];
  sharedContract?: string;
  warRoomSessionId?: string;
  qaAudit?: QaAuditRecord;
  requiresWarRoom?: boolean;
  apiError?: string;
}

export interface FinopsReview {
  estimatedCostPer1kTokensUsd: number;
  recommendedBudgetModel: AgentModelId;
  alertMessage?: string;
  approvedByVega: boolean;
}

export interface JobRequisition {
  id: string;
  briefingId: string;
  subTaskId: string;
  title: string;
  department: DepartmentIsland;
  targetRoomId: RoomId;
  recommendedModel: AgentModelId;
  justification: string;
  generatedDnaPrompt: string;
  suggestedEnvVar: string;
  finopsReview: FinopsReview;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ArtifactSection {
  id: string;
  department: DepartmentIsland | 'Resumo' | 'QA';
  label: string;
  agentName: string;
  model: string;
  markdownContent: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface DeliveredArtifact {
  id: string;
  briefingId: string;
  subTaskId: string;
  title: string;
  department: DepartmentIsland;
  agentId: string;
  agentName: string;
  model: string;
  markdownContent: string;
  sections?: ArtifactSection[];
  sharedContract?: string;
  qaFindings?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  deliveredAt: string;
  qaVerified: boolean;
  readByCeo: boolean;
  apiError?: string;
}

export interface EnvSecretSlot {
  keyName: string;
  provider: string;
  scope: string;
  linked: boolean;
}

export interface OfficeClockState {
  /** Minutes elapsed in virtual workday (e.g., 540 = 09:00) */
  minutesOfDay: number;
  dayCount: number;
  isPaused: boolean;
}

export interface CameraState {
  x: number; // world pixel center X
  y: number; // world pixel center Y
  zoom: number;
  followCeo: boolean;
}

export interface StaffRosterSlot {
  slotNumber: number;
  title: string;
  roomId: RoomId;
  roomName: string;
  status: 'active' | 'vacant';
  agentName?: string;
}
