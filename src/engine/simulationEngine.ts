import { pickDialogue } from '../data/idleDialogues';
import { OFFICE_GRID } from '../data/officeLayout';
import { findNearestWalkable, findPath } from './pathfinding';
import {
  Agent,
  DialogueContext,
  Direction,
  RoomId,
  SpeechBubble,
  TileCoord,
} from '../types/office';

export interface InputKeysState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type MissionKind =
  | 'atlas_alert_diretoria'
  | 'new_hire_to_desk'
  | 'delivery_to_qa'
  | 'delivery_to_diretoria'
  | 'war_room_meeting'
  | 'qa_audit_bench';

export interface AutonomousAgentRuntime {
  path: TileCoord[];
  targetTile: TileCoord | null;
  phase:
    | 'at_desk'
    | 'going_to_target'
    | 'performing_task'
    | 'returning_home'
    | 'mission_walking'
    | 'mission_waiting';
  taskKind: 'cafe' | 'cpd' | 'planning' | null;
  missionKind: MissionKind | null;
  missionPayloadId: string | null;
  homeTile: TileCoord;
  homeFacing: Direction;
  waitTimer: number;
  animTimer: number;
  walkFrame: number;
  dialogueCooldown: number;
  workChatterTimer: number;
}

export interface SimulationRuntime {
  ceoPath: TileCoord[];
  ceoTargetTile: TileCoord | null;
  walkAnimTimer: number;
  walkFrame: number;
  ambientTimer: number;
  clockAccumulator: number;
  autonomous: Record<string, AutonomousAgentRuntime>;
  speechBubbles: SpeechBubble[];
  dialogueSeed: number;
}

const CEO_SPEED_TILES_PER_SEC = 5.4;
const AGENT_SPEED_TILES_PER_SEC = 3.7;
const COLLISION_HALF_EXTENT = 0.26;

export const DIRETORIA_DOOR_TILE: TileCoord = { x: 9, y: 10 };
export const DIRETORIA_OUTBOX_TILE: TileCoord = { x: 8, y: 5 };
export const QA_CHECKPOINT_TILE: TileCoord = { x: 47, y: 19 };
export const QA_BENCH_TILES: TileCoord[] = [
  { x: 45, y: 18 },
  { x: 47, y: 18 },
];

export const WAR_ROOM_SEATS: Array<{ tile: TileCoord; facing: Direction }> = [
  { tile: { x: 24, y: 4 }, facing: 'down' },
  { tile: { x: 26, y: 4 }, facing: 'down' },
  { tile: { x: 29, y: 4 }, facing: 'down' },
  { tile: { x: 24, y: 7 }, facing: 'up' },
  { tile: { x: 26, y: 7 }, facing: 'up' },
  { tile: { x: 29, y: 7 }, facing: 'up' },
];

const DEFAULT_HOME_DESKS: Record<string, { tile: TileCoord; facing: Direction }> = {
  'coord-team': { tile: { x: 43, y: 3 }, facing: 'down' },
  'coord-finance': { tile: { x: 43, y: 6 }, facing: 'up' },
};

const PLANNING_SPOTS: Array<{ tile: TileCoord; facing: Direction }> = [
  { tile: { x: 27, y: 8 }, facing: 'up' },
  { tile: { x: 16, y: 19 }, facing: 'up' },
  { tile: { x: 26, y: 19 }, facing: 'up' },
  { tile: { x: 36, y: 19 }, facing: 'up' },
  { tile: { x: 6, y: 19 }, facing: 'up' },
];

function canOccupyPoint(px: number, py: number): boolean {
  const minX = Math.round(px - COLLISION_HALF_EXTENT);
  const maxX = Math.round(px + COLLISION_HALF_EXTENT);
  const minY = Math.round(py - COLLISION_HALF_EXTENT);
  const maxY = Math.round(py + COLLISION_HALF_EXTENT);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (ty < 0 || ty >= OFFICE_GRID.rows || tx < 0 || tx >= OFFICE_GRID.cols) {
        return false;
      }
      if (!OFFICE_GRID.walkable[ty][tx]) {
        return false;
      }
    }
  }
  return true;
}

function getDirectionFromDelta(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

export function getRoomAtPosition(x: number, y: number): RoomId | null {
  const tx = Math.round(x);
  const ty = Math.round(y);
  if (tx < 0 || ty < 0 || tx >= OFFICE_GRID.cols || ty >= OFFICE_GRID.rows) {
    return null;
  }
  return OFFICE_GRID.roomAtTile[ty][tx];
}

export function ensureAutonomousRuntime(
  runtime: SimulationRuntime,
  agent: Agent
): AutonomousAgentRuntime {
  if (!runtime.autonomous[agent.id]) {
    const def = DEFAULT_HOME_DESKS[agent.id];
    runtime.autonomous[agent.id] = {
      path: [],
      targetTile: null,
      phase: 'at_desk',
      taskKind: null,
      missionKind: null,
      missionPayloadId: null,
      homeTile: def ? { ...def.tile } : { x: Math.round(agent.position.x), y: Math.round(agent.position.y) },
      homeFacing: def ? def.facing : agent.direction,
      waitTimer: 0,
      animTimer: 0,
      walkFrame: 0,
      dialogueCooldown: 6,
      workChatterTimer: agent.id === 'coord-team' ? 9 : 16,
    };
  }
  return runtime.autonomous[agent.id];
}

export function showCustomSpeechBubble(
  runtime: SimulationRuntime,
  agent: Agent,
  text: string,
  context: DialogueContext = 'trabalhando',
  onSpeechLogged?: (bubble: SpeechBubble, agentName: string, tokens?: number, costUsd?: number) => void,
  tokens = 0,
  costUsd = 0
) {
  runtime.speechBubbles = runtime.speechBubbles.filter((b) => b.agentId !== agent.id);
  const bubble: SpeechBubble = {
    id: `bub-${agent.id}-${Math.round(runtime.ambientTimer * 1000)}-${Math.random().toString(36).slice(2, 6)}`,
    agentId: agent.id,
    text,
    context,
    createdAt: runtime.ambientTimer,
    expiresAt: runtime.ambientTimer + 4.2,
  };
  runtime.speechBubbles.push(bubble);
  onSpeechLogged?.(bubble, agent.name, tokens, costUsd);
}

function emitBubble(
  runtime: SimulationRuntime,
  agent: Agent,
  context: DialogueContext,
  onSpeechLogged?: (bubble: SpeechBubble, agentName: string, tokens?: number, costUsd?: number) => void
) {
  runtime.dialogueSeed += 1;
  const text = pickDialogue(context, agent.id, runtime.dialogueSeed);
  showCustomSpeechBubble(runtime, agent, text, context, onSpeechLogged, 0, 0);
}

function assignAgentDestination(
  agent: Agent,
  auto: AutonomousAgentRuntime,
  desiredTile: TileCoord
): boolean {
  const target = findNearestWalkable(desiredTile, 2);
  if (!target) return false;
  const start = { x: Math.round(agent.position.x), y: Math.round(agent.position.y) };
  if (start.x === target.x && start.y === target.y) {
    auto.path = [];
    auto.targetTile = target;
    return true;
  }
  const path = findPath(start, target);
  if (path.length === 0) return false;
  auto.path = path;
  auto.targetTile = target;
  return true;
}

export function startAgentMission(
  runtime: SimulationRuntime,
  agent: Agent,
  missionKind: MissionKind,
  targetTile: TileCoord,
  payloadId: string | null = null
): void {
  const auto = ensureAutonomousRuntime(runtime, agent);
  auto.missionKind = missionKind;
  auto.missionPayloadId = payloadId;
  auto.taskKind = null;
  auto.waitTimer = 0;

  if (missionKind === 'atlas_alert_diretoria') {
    agent.state = 'indo_diretoria_alerta';
  } else if (missionKind === 'new_hire_to_desk') {
    agent.state = 'indo_baia';
  } else if (missionKind === 'delivery_to_qa') {
    agent.state = 'indo_qa';
  } else if (missionKind === 'delivery_to_diretoria') {
    agent.state = 'entregando_diretoria';
  } else if (missionKind === 'war_room_meeting') {
    agent.state = 'indo_reuniao';
  } else if (missionKind === 'qa_audit_bench') {
    agent.state = 'indo_qa';
  }

  assignAgentDestination(agent, auto, targetTile);
  auto.phase = 'mission_walking';
}

export function returnAgentToHomeDesk(
  runtime: SimulationRuntime,
  agent: Agent,
  deskState: 'working' | 'corrigindo_qa' = 'working'
): void {
  const auto = ensureAutonomousRuntime(runtime, agent);
  auto.missionKind = null;
  auto.missionPayloadId = null;
  auto.taskKind = null;

  const atHomeAlready =
    Math.round(agent.position.x) === auto.homeTile.x &&
    Math.round(agent.position.y) === auto.homeTile.y;

  if (atHomeAlready) {
    auto.path = [];
    auto.targetTile = null;
    auto.phase = 'at_desk';
    agent.direction = auto.homeFacing;
    agent.state = deskState;
    return;
  }

  if (assignAgentDestination(agent, auto, auto.homeTile)) {
    auto.phase = 'returning_home';
    agent.state = deskState === 'corrigindo_qa' ? 'corrigindo_qa' : 'walking';
  } else {
    auto.phase = 'at_desk';
    agent.direction = auto.homeFacing;
    agent.state = deskState;
  }
}

function moveAlongPath(
  agent: Agent,
  path: TileCoord[],
  speed: number,
  dt: number
): boolean {
  if (path.length === 0) return true;
  const waypoint = path[0];
  const dx = waypoint.x - agent.position.x;
  const dy = waypoint.y - agent.position.y;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;

  if (dist <= step) {
    agent.position.x = waypoint.x;
    agent.position.y = waypoint.y;
    path.shift();
    return path.length === 0;
  } else {
    const nx = dx / dist;
    const ny = dy / dist;
    agent.position.x += nx * step;
    agent.position.y += ny * step;
    agent.direction = getDirectionFromDelta(nx, ny, agent.direction);
    return false;
  }
}

export interface SimulationCallbacks {
  onMinuteTick: () => void;
  onSpeechLogged?: (
    bubble: SpeechBubble,
    agentName: string,
    tokens?: number,
    costUsd?: number
  ) => void;
  onDeliveryArrived?: (agentId: string, artifactId: string) => void;
  onNewHireSeated?: (agentId: string) => void;
  onWarRoomSeatArrived?: (agentId: string, sessionId: string) => void;
  onQaBenchArrived?: (agentId: string, briefingId: string) => void;
}

export function stepSimulation(
  dtSeconds: number,
  agents: Agent[],
  keys: InputKeysState,
  runtime: SimulationRuntime,
  clockPaused: boolean,
  callbacks: SimulationCallbacks
): void {
  const clampedDt = Math.min(dtSeconds, 0.05);
  runtime.ambientTimer += clampedDt;

  if (runtime.speechBubbles.length > 0) {
    runtime.speechBubbles = runtime.speechBubbles.filter(
      (b) => b.expiresAt > runtime.ambientTimer
    );
  }

  if (!clockPaused) {
    runtime.clockAccumulator += clampedDt;
    if (runtime.clockAccumulator >= 1.2) {
      runtime.clockAccumulator -= 1.2;
      callbacks.onMinuteTick();
    }
  }

  // 1. CEO Manual Keyboard + Click-to-Move Control
  const ceo = agents.find((a) => a.id === 'ceo');
  if (ceo) {
    let vx = 0;
    let vy = 0;
    if (keys.left) vx -= 1;
    if (keys.right) vx += 1;
    if (keys.up) vy -= 1;
    if (keys.down) vy += 1;

    const hasKeyboardInput = vx !== 0 || vy !== 0;

    if (hasKeyboardInput) {
      if (runtime.ceoPath.length > 0) {
        runtime.ceoPath = [];
        runtime.ceoTargetTile = null;
      }

      const len = Math.hypot(vx, vy);
      vx /= len;
      vy /= len;

      const step = CEO_SPEED_TILES_PER_SEC * clampedDt;
      const nextX = ceo.position.x + vx * step;
      const nextY = ceo.position.y + vy * step;

      let moved = false;
      if (canOccupyPoint(nextX, ceo.position.y)) {
        ceo.position.x = nextX;
        moved = true;
      }
      if (canOccupyPoint(ceo.position.x, nextY)) {
        ceo.position.y = nextY;
        moved = true;
      }

      ceo.direction = getDirectionFromDelta(vx, vy, ceo.direction);
      ceo.state = moved ? 'walking' : 'idle';
    } else if (runtime.ceoPath.length > 0) {
      const done = moveAlongPath(ceo, runtime.ceoPath, CEO_SPEED_TILES_PER_SEC, clampedDt);
      if (done) {
        runtime.ceoTargetTile = null;
        ceo.state = 'idle';
      } else {
        ceo.state = 'walking';
      }
    } else {
      ceo.state = 'idle';
    }

    if (ceo.state === 'walking') {
      runtime.walkAnimTimer += clampedDt;
      if (runtime.walkAnimTimer >= 0.13) {
        runtime.walkAnimTimer = 0;
        runtime.walkFrame = (runtime.walkFrame + 1) % 4;
      }
    } else {
      runtime.walkAnimTimer += clampedDt;
      if (runtime.walkAnimTimer >= 0.55) {
        runtime.walkAnimTimer = 0;
        runtime.walkFrame = (runtime.walkFrame + 1) % 2;
      }
    }
  }

  // 2. Autonomous Coordinators + Hired Island Specialists
  for (const agent of agents) {
    if (agent.id === 'ceo') continue;

    const auto = ensureAutonomousRuntime(runtime, agent);
    if (auto.dialogueCooldown > 0) auto.dialogueCooldown -= clampedDt;

    // Respect Vega/CEO Budget Pause
    if (agent.isPausedByBudget) {
      agent.state = 'pausado_orcamento';
      continue;
    }

    const isWalkingPhase =
      auto.phase === 'going_to_target' ||
      auto.phase === 'returning_home' ||
      auto.phase === 'mission_walking';

    if (auto.phase === 'mission_walking') {
      const arrived = moveAlongPath(agent, auto.path, AGENT_SPEED_TILES_PER_SEC, clampedDt);
      if (arrived) {
        if (auto.missionKind === 'atlas_alert_diretoria') {
          auto.phase = 'mission_waiting';
          agent.state = 'aguardando_aprovacao';
          agent.direction = 'up';
          showCustomSpeechBubble(
            runtime,
            agent,
            'Chefe! Temos vagas pendentes para destravar a demanda.',
            'trabalhando',
            callbacks.onSpeechLogged
          );
        } else if (auto.missionKind === 'new_hire_to_desk') {
          auto.phase = 'at_desk';
          auto.missionKind = null;
          agent.direction = auto.homeFacing;
          agent.state = 'working';
          callbacks.onNewHireSeated?.(agent.id);
        } else if (auto.missionKind === 'delivery_to_qa') {
          auto.phase = 'mission_waiting';
          auto.waitTimer = 2.4;
          agent.state = 'indo_qa';
          agent.direction = 'up';
          showCustomSpeechBubble(
            runtime,
            agent,
            'Validando entrega no Laboratório de QA...',
            'trabalhando',
            callbacks.onSpeechLogged
          );
        } else if (auto.missionKind === 'delivery_to_diretoria') {
          auto.phase = 'mission_waiting';
          auto.waitTimer = 1.6;
          agent.state = 'entregando_diretoria';
          agent.direction = 'up';
          if (auto.missionPayloadId) {
            callbacks.onDeliveryArrived?.(agent.id, auto.missionPayloadId);
          }
          showCustomSpeechBubble(
            runtime,
            agent,
            'Entrega concluída na Caixa de Saída!',
            'trabalhando',
            callbacks.onSpeechLogged
          );
        } else if (auto.missionKind === 'war_room_meeting') {
          auto.phase = 'mission_waiting';
          agent.state = 'em_reuniao';
          agent.direction = agent.position.y <= 5.5 ? 'down' : 'up';
          if (auto.missionPayloadId) {
            callbacks.onWarRoomSeatArrived?.(agent.id, auto.missionPayloadId);
          }
        } else if (auto.missionKind === 'qa_audit_bench') {
          auto.phase = 'mission_waiting';
          agent.state = 'homologando_qa';
          agent.direction = 'up';
          if (auto.missionPayloadId) {
            callbacks.onQaBenchArrived?.(agent.id, auto.missionPayloadId);
          }
        }
      }
    } else if (auto.phase === 'mission_waiting') {
      if (auto.missionKind === 'atlas_alert_diretoria') {
        agent.state = 'aguardando_aprovacao';
        agent.direction = 'up';
      } else if (auto.missionKind === 'war_room_meeting') {
        agent.state = 'em_reuniao';
        agent.direction = agent.position.y <= 5.5 ? 'down' : 'up';
      } else if (auto.missionKind === 'qa_audit_bench') {
        agent.state = 'homologando_qa';
        agent.direction = 'up';
      } else if (auto.missionKind === 'delivery_to_qa') {
        auto.waitTimer -= clampedDt;
        if (auto.waitTimer <= 0) {
          startAgentMission(
            runtime,
            agent,
            'delivery_to_diretoria',
            DIRETORIA_OUTBOX_TILE,
            auto.missionPayloadId
          );
        }
      } else if (auto.missionKind === 'delivery_to_diretoria') {
        auto.waitTimer -= clampedDt;
        if (auto.waitTimer <= 0) {
          returnAgentToHomeDesk(runtime, agent);
        }
      }
    } else if (auto.phase === 'at_desk') {
      // If actively processing a real subtask LLM call or fixing QA feedback, keep sitting at desk!
      if (agent.activeSubTaskId || agent.state === 'corrigindo_qa') {
        if (agent.state !== 'corrigindo_qa') {
          agent.state = 'working';
        }
        agent.direction = auto.homeFacing;
      } else {
        // Free 0-token idle life cycle
        if (!clockPaused) {
          agent.needs.cafe = Math.max(0, agent.needs.cafe - 1.15 * clampedDt);
          agent.needs.rotina = Math.max(0, agent.needs.rotina - 1.75 * clampedDt);
        }

        auto.workChatterTimer -= clampedDt;
        if (auto.workChatterTimer <= 0) {
          auto.workChatterTimer = 24 + (runtime.dialogueSeed % 10);
          if (auto.dialogueCooldown <= 0) {
            emitBubble(runtime, agent, 'trabalhando', callbacks.onSpeechLogged);
            auto.dialogueCooldown = 10;
          }
        }

        if (agent.needs.cafe < 30) {
          const coffeeTile =
            agent.id === 'coord-team'
              ? { x: 25, y: 30 }
              : agent.id === 'coord-finance'
              ? { x: 26, y: 30 }
              : { x: 27, y: 30 };
          if (assignAgentDestination(agent, auto, coffeeTile)) {
            auto.phase = 'going_to_target';
            auto.taskKind = 'cafe';
            agent.state = 'indo_cafe';
          }
        } else if (agent.needs.rotina < 35) {
          if (agent.id === 'coord-finance') {
            if (assignAgentDestination(agent, auto, { x: 17, y: 34 })) {
              auto.phase = 'going_to_target';
              auto.taskKind = 'cpd';
              agent.state = 'auditando_infra';
            }
          } else if (agent.id === 'coord-team') {
            const spot = PLANNING_SPOTS[runtime.dialogueSeed % PLANNING_SPOTS.length];
            if (assignAgentDestination(agent, auto, spot.tile)) {
              auto.phase = 'going_to_target';
              auto.taskKind = 'planning';
              agent.state = 'planejando';
            }
          } else {
            // Hired specialists stay mostly idle at their desk unless grabbing coffee
            agent.needs.rotina = 85;
          }
        } else {
          agent.state = 'working';
        }
      }
    } else if (auto.phase === 'going_to_target') {
      const arrived = moveAlongPath(agent, auto.path, AGENT_SPEED_TILES_PER_SEC, clampedDt);
      if (arrived) {
        auto.phase = 'performing_task';
        auto.waitTimer = 4.6;
        if (auto.taskKind === 'cafe') {
          agent.state = 'tomando_cafe';
          agent.direction = 'up';
          emitBubble(runtime, agent, 'na_copa', callbacks.onSpeechLogged);
          auto.dialogueCooldown = 9;
        } else if (auto.taskKind === 'cpd') {
          agent.state = 'auditando_infra';
          agent.direction = 'down';
          emitBubble(runtime, agent, 'no_cpd', callbacks.onSpeechLogged);
          auto.dialogueCooldown = 9;
        } else {
          agent.state = 'planejando';
          agent.direction = 'up';
          emitBubble(runtime, agent, 'trabalhando', callbacks.onSpeechLogged);
          auto.dialogueCooldown = 9;
        }
      }
    } else if (auto.phase === 'performing_task') {
      auto.waitTimer -= clampedDt;
      if (auto.taskKind === 'cafe') {
        agent.needs.cafe = Math.min(100, agent.needs.cafe + 22 * clampedDt);
      } else {
        agent.needs.rotina = Math.min(100, agent.needs.rotina + 22 * clampedDt);
      }

      if (auto.waitTimer <= 0) {
        if (auto.taskKind === 'cafe') agent.needs.cafe = 100;
        else agent.needs.rotina = 100;
        returnAgentToHomeDesk(runtime, agent);
      }
    } else if (auto.phase === 'returning_home') {
      const arrived = moveAlongPath(agent, auto.path, AGENT_SPEED_TILES_PER_SEC, clampedDt);
      if (arrived) {
        agent.direction = auto.homeFacing;
        auto.phase = 'at_desk';
        auto.taskKind = null;
        auto.targetTile = null;
        agent.state = agent.state === 'corrigindo_qa' ? 'corrigindo_qa' : 'working';
      }
    }

    if (isWalkingPhase) {
      auto.animTimer += clampedDt;
      if (auto.animTimer >= 0.16) {
        auto.animTimer = 0;
        auto.walkFrame = (auto.walkFrame + 1) % 4;
      }
    } else {
      auto.animTimer += clampedDt;
      if (auto.animTimer >= 0.6) {
        auto.animTimer = 0;
        auto.walkFrame = (auto.walkFrame + 1) % 2;
      }
    }
  }

  // 3. Proximity Encounter Dialogues (<= 2 tiles, zero tokens)
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      const dist = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
      if (dist <= 2.1) {
        const speaker = a.id !== 'ceo' ? a : b;
        if (speaker.id === 'ceo') continue;
        const auto = ensureAutonomousRuntime(runtime, speaker);
        if (auto.missionKind !== null) continue;
        const otherIsWalking =
          (a.id === 'ceo' && a.state === 'walking') ||
          (b.id === 'ceo' && b.state === 'walking');
        if (
          auto.dialogueCooldown <= 0 &&
          (auto.phase !== 'at_desk' || otherIsWalking)
        ) {
          emitBubble(runtime, speaker, 'encontro_corredor', callbacks.onSpeechLogged);
          auto.dialogueCooldown = 16;
        }
      }
    }
  }
}
