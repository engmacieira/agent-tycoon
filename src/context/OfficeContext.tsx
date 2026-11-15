import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CEO_SPAWN_TILE, ROOM_CONFIGS, TILE_SIZE } from '../data/officeLayout';
import { findNearestWalkable, findPath } from '../engine/pathfinding';
import { SimulationRuntime, getRoomAtPosition } from '../engine/simulationEngine';
import {
  Agent,
  CameraState,
  EnvSecretSlot,
  InteractiveObject,
  OfficeClockState,
  RoomConfig,
  RoomId,
  TileCoord,
} from '../types/office';

const INITIAL_CEO_AGENT: Agent = {
  id: 'ceo',
  name: 'Dono',
  role: 'CEO',
  departmentId: 'diretoria',
  position: { x: CEO_SPAWN_TILE.x, y: CEO_SPAWN_TILE.y },
  direction: 'down',
  state: 'idle',
  spriteVariant: 'ceo',
  apiKeyEnvVar: undefined,
  model: undefined,
  systemPrompt: undefined,
  shortTermMemory: [],
  longTermMemory: [],
  assignedDeskId: 'slot-ceo',
  tokensUsed: 0,
  estimatedCostUsd: 0,
};

const INITIAL_ENV_VAULT_SLOTS: EnvSecretSlot[] = [
  { keyName: 'GEMINI_API_KEY', provider: 'Google Gemini', scope: 'Diretoria & Coordenadores', linked: false },
  { keyName: 'OPENAI_API_KEY', provider: 'OpenAI', scope: 'Ilha Backend & QA Lab', linked: false },
  { keyName: 'ANTHROPIC_API_KEY', provider: 'Anthropic Claude', scope: 'Ilha Frontend & Copy', linked: false },
  { keyName: 'GROQ_API_KEY', provider: 'Groq LPU', scope: 'Triagem & Administrativo', linked: false },
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
  hoveredRoomId: RoomId | null;
  hoveredObject: InteractiveObject | null;
  qaSirenActive: boolean;
  clock: OfficeClockState;
  envVaultSlots: EnvSecretSlot[];
  totalTokensUsed: number;
  totalCostUsd: number;
  // Actions
  selectRoom: (roomId: RoomId | null, object?: InteractiveObject | null) => void;
  setHoverTarget: (roomId: RoomId | null, object: InteractiveObject | null) => void;
  moveCeoToTile: (tile: TileCoord) => boolean;
  walkToRoom: (roomId: RoomId) => void;
  focusRoom: (roomId: RoomId) => void;
  centerOnCeo: () => void;
  adjustZoom: (delta: number) => void;
  setZoomAbsolute: (zoom: number) => void;
  setFollowCeo: (follow: boolean) => void;
  toggleQaSiren: () => void;
  toggleClockPause: () => void;
  advanceClockMinute: () => void;
  syncCeoRoomIndicator: () => void;
}

const OfficeContext = createContext<OfficeContextValue | null>(null);

export const OfficeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rooms] = useState<RoomConfig[]>(ROOM_CONFIGS);
  const [agents] = useState<Agent[]>([INITIAL_CEO_AGENT]);
  const agentsRef = useRef<Agent[]>([INITIAL_CEO_AGENT]);

  const simulationRuntimeRef = useRef<SimulationRuntime>({
    ceoPath: [],
    ceoTargetTile: null,
    walkAnimTimer: 0,
    walkFrame: 0,
    ambientTimer: 0,
    clockAccumulator: 0,
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
  const [hoveredRoomId, setHoveredRoomId] = useState<RoomId | null>(null);
  const [hoveredObject, setHoveredObject] = useState<InteractiveObject | null>(null);

  const [qaSirenActive, setQaSirenActive] = useState<boolean>(false);
  const [clock, setClock] = useState<OfficeClockState>({
    minutesOfDay: 9 * 60, // 09:00 start of workday
    dayCount: 1,
    isPaused: false,
  });
  const [envVaultSlots] = useState<EnvSecretSlot[]>(INITIAL_ENV_VAULT_SLOTS);

  const setFollowCeo = useCallback((follow: boolean) => {
    cameraRef.current.followCeo = follow;
    setFollowCeoState(follow);
  }, []);

  const selectRoom = useCallback((roomId: RoomId | null, object: InteractiveObject | null = null) => {
    setSelectedRoomId(roomId);
    setSelectedObject(object);
  }, []);

  const setHoverTarget = useCallback((roomId: RoomId | null, object: InteractiveObject | null) => {
    setHoveredRoomId((prev) => (prev === roomId ? prev : roomId));
    setHoveredObject((prev) => (prev?.id === object?.id ? prev : object));
  }, []);

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
      setSelectedRoomId(roomId);
      setSelectedObject(null);
    },
    [rooms]
  );

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

  const toggleQaSiren = useCallback(() => {
    setQaSirenActive((prev) => !prev);
  }, []);

  const toggleClockPause = useCallback(() => {
    setClock((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const advanceClockMinute = useCallback(() => {
    setClock((prev) => {
      const next = prev.minutesOfDay + 1;
      if (next >= 24 * 60) {
        return { ...prev, minutesOfDay: 0, dayCount: prev.dayCount + 1 };
      }
      return { ...prev, minutesOfDay: next };
    });
  }, []);

  const syncCeoRoomIndicator = useCallback(() => {
    const ceo = agentsRef.current.find((a) => a.id === 'ceo');
    if (!ceo) return;
    const roomId = getRoomAtPosition(ceo.position.x, ceo.position.y);
    setCeoCurrentRoomId((prev) => (prev === roomId ? prev : roomId));
  }, []);

  const totalTokensUsed = useMemo(
    () => agents.reduce((acc, a) => acc + a.tokensUsed, 0),
    [agents]
  );
  const totalCostUsd = useMemo(
    () => agents.reduce((acc, a) => acc + a.estimatedCostUsd, 0),
    [agents]
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
        hoveredRoomId,
        hoveredObject,
        qaSirenActive,
        clock,
        envVaultSlots,
        totalTokensUsed,
        totalCostUsd,
        selectRoom,
        setHoverTarget,
        moveCeoToTile,
        walkToRoom,
        focusRoom,
        centerOnCeo,
        adjustZoom,
        setZoomAbsolute,
        setFollowCeo,
        toggleQaSiren,
        toggleClockPause,
        advanceClockMinute,
        syncCeoRoomIndicator,
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
