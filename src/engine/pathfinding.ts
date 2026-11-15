import { OFFICE_GRID } from '../data/officeLayout';
import { TileCoord } from '../types/office';

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function isTileWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= OFFICE_GRID.cols || y >= OFFICE_GRID.rows) {
    return false;
  }
  return OFFICE_GRID.walkable[y][x];
}

export function findNearestWalkable(target: TileCoord, maxRadius = 4): TileCoord | null {
  if (isTileWalkable(target.x, target.y)) return target;

  for (let r = 1; r <= maxRadius; r++) {
    let best: TileCoord | null = null;
    let bestDist = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = target.x + dx;
        const ny = target.y + dy;
        if (isTileWalkable(nx, ny)) {
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            best = { x: nx, y: ny };
          }
        }
      }
    }
    if (best) return best;
  }
  return null;
}

const DIRS: Array<{ dx: number; dy: number; cost: number; diag: boolean }> = [
  { dx: 0, dy: -1, cost: 1, diag: false },
  { dx: 1, dy: 0, cost: 1, diag: false },
  { dx: 0, dy: 1, cost: 1, diag: false },
  { dx: -1, dy: 0, cost: 1, diag: false },
  { dx: 1, dy: -1, cost: Math.SQRT2, diag: true },
  { dx: 1, dy: 1, cost: Math.SQRT2, diag: true },
  { dx: -1, dy: 1, cost: Math.SQRT2, diag: true },
  { dx: -1, dy: -1, cost: Math.SQRT2, diag: true },
];

export function findPath(start: TileCoord, goal: TileCoord): TileCoord[] {
  const sx = Math.round(start.x);
  const sy = Math.round(start.y);
  const gx = Math.round(goal.x);
  const gy = Math.round(goal.y);

  if (!isTileWalkable(gx, gy)) return [];
  if (sx === gx && sy === gy) return [];

  const open: AStarNode[] = [];
  const openMap = new Map<string, AStarNode>();
  const closed = new Set<string>();

  const startH = Math.hypot(gx - sx, gy - sy);
  const startNode: AStarNode = {
    x: sx,
    y: sy,
    g: 0,
    h: startH,
    f: startH,
    parent: null,
  };

  open.push(startNode);
  openMap.set(key(sx, sy), startNode);

  while (open.length > 0) {
    // Pop lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) {
        bestIdx = i;
      }
    }

    const current = open[bestIdx];
    open.splice(bestIdx, 1);
    const cKey = key(current.x, current.y);
    openMap.delete(cKey);
    closed.add(cKey);

    if (current.x === gx && current.y === gy) {
      const path: TileCoord[] = [];
      let curr: AStarNode | null = current;
      while (curr && !(curr.x === sx && curr.y === sy)) {
        path.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      path.reverse();
      return path;
    }

    for (const dir of DIRS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = key(nx, ny);

      if (closed.has(nKey)) continue;
      if (!isTileWalkable(nx, ny)) continue;

      // Prevent diagonal corner cutting across walls or solid desks
      if (dir.diag) {
        if (!isTileWalkable(current.x + dir.dx, current.y) || !isTileWalkable(current.x, current.y + dir.dy)) {
          continue;
        }
      }

      const tentativeG = current.g + dir.cost;
      const existing = openMap.get(nKey);

      if (!existing) {
        const h = Math.hypot(gx - nx, gy - ny);
        const node: AStarNode = {
          x: nx,
          y: ny,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        };
        open.push(node);
        openMap.set(nKey, node);
      } else if (tentativeG < existing.g) {
        existing.g = tentativeG;
        existing.f = tentativeG + existing.h;
        existing.parent = current;
      }
    }
  }

  return [];
}
