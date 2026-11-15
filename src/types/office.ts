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

export type AgentState = 'idle' | 'walking' | 'working' | 'meeting' | 'break';

export interface Agent {
  id: string;
  name: string;
  role: string;
  departmentId: RoomId;
  position: { x: number; y: number };
  direction: Direction;
  state: AgentState;
  spriteVariant: 'ceo' | 'coordinator' | 'admin' | 'backend' | 'frontend' | 'marketing' | 'qa' | 'reception';
  // Phase 2 AI Agent Readiness
  apiKeyEnvVar?: string;
  model?: string;
  systemPrompt?: string;
  shortTermMemory: AgentMemoryEntry[];
  longTermMemory: AgentMemoryEntry[];
  assignedDeskId?: string;
  tokensUsed: number;
  estimatedCostUsd: number;
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
