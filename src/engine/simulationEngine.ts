import { OFFICE_GRID } from '../data/officeLayout';
import { Agent, Direction, RoomId, TileCoord } from '../types/office';

export interface InputKeysState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface SimulationRuntime {
  ceoPath: TileCoord[];
  ceoTargetTile: TileCoord | null;
  walkAnimTimer: number;
  walkFrame: number;
  ambientTimer: number;
  clockAccumulator: number;
}

const CEO_SPEED_TILES_PER_SEC = 5.4;
const COLLISION_HALF_EXTENT = 0.26;

function canOccupyPoint(px: number, py: number): boolean {
  // Check 4 corners of bounding box around avatar center (px, py)
  // Avatar coordinates are tile center coordinates (e.g. tile (6,6) -> center is (6,6))
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

export function stepSimulation(
  dtSeconds: number,
  agents: Agent[],
  keys: InputKeysState,
  runtime: SimulationRuntime,
  clockPaused: boolean,
  onMinuteTick: () => void
): void {
  const clampedDt = Math.min(dtSeconds, 0.05);
  runtime.ambientTimer += clampedDt;

  if (!clockPaused) {
    runtime.clockAccumulator += clampedDt;
    if (runtime.clockAccumulator >= 1.2) {
      runtime.clockAccumulator -= 1.2;
      onMinuteTick();
    }
  }

  const ceo = agents.find((a) => a.id === 'ceo');
  if (!ceo) return;

  let vx = 0;
  let vy = 0;
  if (keys.left) vx -= 1;
  if (keys.right) vx += 1;
  if (keys.up) vy -= 1;
  if (keys.down) vy += 1;

  const hasKeyboardInput = vx !== 0 || vy !== 0;

  if (hasKeyboardInput) {
    // Cancel any active A* click-to-move path when user uses WASD/Arrows
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

    // Axis-separated collision for smooth wall sliding
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
    const waypoint = runtime.ceoPath[0];
    const dx = waypoint.x - ceo.position.x;
    const dy = waypoint.y - ceo.position.y;
    const dist = Math.hypot(dx, dy);
    const step = CEO_SPEED_TILES_PER_SEC * clampedDt;

    if (dist <= step) {
      ceo.position.x = waypoint.x;
      ceo.position.y = waypoint.y;
      runtime.ceoPath.shift();
      if (runtime.ceoPath.length === 0) {
        runtime.ceoTargetTile = null;
        ceo.state = 'idle';
      } else {
        ceo.state = 'walking';
      }
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      ceo.position.x += nx * step;
      ceo.position.y += ny * step;
      ceo.direction = getDirectionFromDelta(nx, ny, ceo.direction);
      ceo.state = 'walking';
    }
  } else {
    ceo.state = 'idle';
  }

  // Update walk/idle animation frame
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
