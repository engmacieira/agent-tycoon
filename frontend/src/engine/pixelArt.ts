import { TILE_SIZE } from '../data/officeLayout';
import { FloorStyle, InteractiveObject, WallStyle } from '../types/office';

// 2px pixel unit inside 32x32 tile = crisp 16x16 pixel-art grid
const P = 2;

function createOffscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * P, y * P, w * P, h * P);
}

/**
 * Adds a crisp 1px dark outline around non-transparent pixels of an offscreen sprite
 * plus a subtle 2px downward drop shadow for 2.5D top-down depth.
 */
function applyPixelDepthAndOutline(
  srcCanvas: HTMLCanvasElement,
  addOutline: boolean,
  addShadow: boolean
): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const [outCanvas, outCtx] = createOffscreen(w, h);

  if (addShadow) {
    outCtx.save();
    outCtx.globalAlpha = 0.28;
    outCtx.drawImage(srcCanvas, 0, 2);
    outCtx.globalCompositeOperation = 'source-in';
    outCtx.fillStyle = '#020617';
    outCtx.fillRect(0, 0, w, h);
    outCtx.restore();
  }

  if (addOutline) {
    const srcCtx = srcCanvas.getContext('2d')!;
    const img = srcCtx.getImageData(0, 0, w, h);
    const data = img.data;
    const outlineCanvas = document.createElement('canvas');
    outlineCanvas.width = w;
    outlineCanvas.height = h;
    const olCtx = outlineCanvas.getContext('2d')!;
    olCtx.fillStyle = '#090D16';

    const isOpaque = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return data[(y * w + x) * 4 + 3] > 180;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!isOpaque(x, y)) {
          if (
            isOpaque(x - 1, y) ||
            isOpaque(x + 1, y) ||
            isOpaque(x, y - 1) ||
            isOpaque(x, y + 1)
          ) {
            olCtx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
    outCtx.drawImage(outlineCanvas, 0, 0);
  }

  outCtx.drawImage(srcCanvas, 0, 0);
  return outCanvas;
}

const floorCache = new Map<FloorStyle, HTMLCanvasElement>();
const wallCache = new Map<string, HTMLCanvasElement>();
const furnitureCache = new Map<string, HTMLCanvasElement>();

export function getFloorSprite(style: FloorStyle): HTMLCanvasElement {
  const cached = floorCache.get(style);
  if (cached) return cached;

  const [canvas, ctx] = createOffscreen(TILE_SIZE, TILE_SIZE);

  // Softened, low-contrast architectural floor palettes so foreground furniture & CEO pop cleanly
  switch (style) {
    case 'corridor': {
      px(ctx, 0, 0, 16, 16, '#B8C4D4');
      px(ctx, 0, 0, 16, 1, '#C3CFDE');
      px(ctx, 0, 0, 1, 16, '#C3CFDE');
      px(ctx, 15, 0, 1, 16, '#A8B5C7');
      px(ctx, 0, 15, 16, 1, '#A8B5C7');
      px(ctx, 8, 1, 1, 14, '#AEBBCB');
      px(ctx, 1, 8, 14, 1, '#AEBBCB');
      break;
    }
    case 'wood-noble': {
      px(ctx, 0, 0, 16, 16, '#5D3926');
      px(ctx, 0, 0, 16, 4, '#643E29');
      px(ctx, 0, 4, 16, 1, '#4E2E1D');
      px(ctx, 0, 8, 16, 4, '#613C28');
      px(ctx, 0, 12, 16, 1, '#4E2E1D');
      px(ctx, 0, 15, 16, 1, '#4E2E1D');
      px(ctx, 6, 0, 1, 4, '#4E2E1D');
      px(ctx, 12, 5, 1, 3, '#4E2E1D');
      px(ctx, 3, 8, 1, 4, '#4E2E1D');
      px(ctx, 10, 13, 1, 2, '#4E2E1D');
      px(ctx, 2, 2, 3, 1, '#6C442E');
      px(ctx, 9, 10, 4, 1, '#6C442E');
      break;
    }
    case 'carpet-executive': {
      px(ctx, 0, 0, 16, 16, '#263449');
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          if ((x + y) % 4 === 0) px(ctx, x, y, 1, 1, '#2B3B52');
        }
      }
      px(ctx, 0, 0, 16, 1, '#212E41');
      px(ctx, 0, 0, 1, 16, '#212E41');
      break;
    }
    case 'wood-light': {
      px(ctx, 0, 0, 16, 16, '#B09272');
      px(ctx, 0, 0, 16, 4, '#B7997A');
      px(ctx, 0, 4, 16, 1, '#9E8062');
      px(ctx, 0, 8, 16, 4, '#B49575');
      px(ctx, 0, 12, 16, 1, '#9E8062');
      px(ctx, 0, 15, 16, 1, '#9E8062');
      px(ctx, 8, 0, 1, 4, '#9E8062');
      px(ctx, 3, 8, 1, 4, '#9E8062');
      break;
    }
    case 'carpet-admin': {
      px(ctx, 0, 0, 16, 16, '#3D536D');
      for (let y = 1; y < 16; y += 4) {
        for (let x = 1; x < 16; x += 4) {
          px(ctx, x, y, 1, 1, '#445C78');
          px(ctx, x + 2, y + 2, 1, 1, '#374B63');
        }
      }
      break;
    }
    case 'carpet-backend': {
      px(ctx, 0, 0, 16, 16, '#204235');
      for (let y = 1; y < 16; y += 4) {
        for (let x = 1; x < 16; x += 4) {
          px(ctx, x, y, 1, 1, '#264D3E');
          px(ctx, x + 2, y + 2, 1, 1, '#1B382D');
        }
      }
      break;
    }
    case 'carpet-frontend': {
      px(ctx, 0, 0, 16, 16, '#473663');
      for (let y = 1; y < 16; y += 4) {
        for (let x = 1; x < 16; x += 4) {
          px(ctx, x, y, 1, 1, '#503D70');
          px(ctx, x + 2, y + 2, 1, 1, '#395A6B');
        }
      }
      break;
    }
    case 'carpet-marketing': {
      px(ctx, 0, 0, 16, 16, '#87522C');
      for (let y = 1; y < 16; y += 4) {
        for (let x = 1; x < 16; x += 4) {
          px(ctx, x, y, 1, 1, '#945B32');
          px(ctx, x + 2, y + 2, 1, 1, '#9E6E33');
        }
      }
      break;
    }
    case 'lab-tile': {
      px(ctx, 0, 0, 16, 16, '#CBD4E0');
      px(ctx, 0, 0, 16, 1, '#D6DEE8');
      px(ctx, 0, 0, 1, 16, '#D6DEE8');
      px(ctx, 15, 0, 1, 16, '#B6C2D1');
      px(ctx, 0, 15, 16, 1, '#B6C2D1');
      px(ctx, 4, 4, 1, 1, '#B6C2D1');
      px(ctx, 11, 11, 1, 1, '#B6C2D1');
      break;
    }
    case 'marble': {
      px(ctx, 0, 0, 16, 16, '#D4DCE6');
      px(ctx, 0, 0, 8, 8, '#DCE3EC');
      px(ctx, 8, 8, 8, 8, '#DCE3EC');
      px(ctx, 2, 3, 3, 1, '#C5CFD9');
      px(ctx, 10, 12, 3, 1, '#C5CFD9');
      px(ctx, 0, 15, 16, 1, '#C0CAD6');
      px(ctx, 15, 0, 1, 16, '#C0CAD6');
      break;
    }
    case 'server-grid': {
      px(ctx, 0, 0, 16, 16, '#1B2536');
      px(ctx, 0, 0, 16, 1, '#253247');
      px(ctx, 0, 0, 1, 16, '#253247');
      for (let y = 3; y < 15; y += 4) {
        for (let x = 3; x < 15; x += 4) {
          px(ctx, x, y, 2, 2, '#151D2B');
        }
      }
      break;
    }
    case 'checkerboard': {
      // Softened warm slate & muted cream checkerboard so tables/chairs stand out cleanly
      px(ctx, 0, 0, 8, 8, '#CED6E0');
      px(ctx, 8, 0, 8, 8, '#748296');
      px(ctx, 0, 8, 8, 8, '#748296');
      px(ctx, 8, 8, 8, 8, '#CED6E0');
      px(ctx, 0, 0, 8, 1, '#D8DFE8');
      px(ctx, 8, 8, 8, 1, '#D8DFE8');
      break;
    }
    case 'lounge-cork': {
      px(ctx, 0, 0, 16, 16, '#7C563E');
      px(ctx, 0, 0, 16, 1, '#875F45');
      px(ctx, 0, 15, 16, 1, '#6D4A34');
      px(ctx, 3, 5, 2, 1, '#714D37');
      px(ctx, 10, 11, 2, 1, '#875F45');
      break;
    }
    case 'bathroom-tile': {
      px(ctx, 0, 0, 16, 16, '#AED6EB');
      px(ctx, 0, 0, 8, 8, '#C1E1F2');
      px(ctx, 8, 8, 8, 8, '#C1E1F2');
      px(ctx, 0, 7, 16, 1, '#98C7E0');
      px(ctx, 7, 0, 1, 16, '#98C7E0');
      break;
    }
  }

  floorCache.set(style, canvas);
  return canvas;
}

export function getWallSprite(style: WallStyle): HTMLCanvasElement {
  const cached = wallCache.get(style);
  if (cached) return cached;

  const [canvas, ctx] = createOffscreen(TILE_SIZE, TILE_SIZE);

  switch (style) {
    case 'solid': {
      px(ctx, 0, 0, 16, 9, '#334155');
      px(ctx, 0, 0, 16, 2, '#475569');
      px(ctx, 0, 9, 16, 6, '#1E293B');
      px(ctx, 0, 14, 16, 2, '#0F172A');
      px(ctx, 7, 10, 1, 3, '#293548');
      break;
    }
    case 'glass': {
      px(ctx, 0, 0, 16, 3, '#475569');
      ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
      ctx.fillRect(0, 3 * P, 16 * P, 10 * P);
      px(ctx, 2, 4, 2, 6, 'rgba(224, 242, 254, 0.55)');
      px(ctx, 5, 5, 1, 5, 'rgba(224, 242, 254, 0.45)');
      px(ctx, 0, 13, 16, 3, '#334155');
      px(ctx, 0, 15, 16, 1, '#0F172A');
      px(ctx, 0, 3, 1, 10, '#64748B');
      px(ctx, 15, 3, 1, 10, '#64748B');
      break;
    }
    case 'low-divider': {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
      ctx.fillRect(0, 12 * P, 16 * P, 4 * P);
      px(ctx, 0, 5, 16, 3, '#64748B');
      px(ctx, 0, 6, 16, 1, '#94A3B8');
      px(ctx, 0, 8, 16, 5, '#334155');
      px(ctx, 0, 12, 16, 1, '#1E293B');
      break;
    }
    case 'reinforced': {
      px(ctx, 0, 0, 16, 9, '#475569');
      px(ctx, 0, 0, 16, 2, '#64748B');
      px(ctx, 2, 3, 1, 1, '#94A3B8');
      px(ctx, 13, 3, 1, 1, '#94A3B8');
      px(ctx, 0, 9, 16, 7, '#1E293B');
      px(ctx, 0, 12, 16, 2, '#0F172A');
      px(ctx, 2, 10, 4, 1, '#22C55E');
      px(ctx, 10, 10, 4, 1, '#22C55E');
      break;
    }
  }

  wallCache.set(style, canvas);
  return canvas;
}

function drawMonitor(ctx: CanvasRenderingContext2D, ox: number, oy: number, screenColor: string, accentColor: string) {
  px(ctx, ox, oy, 7, 5, '#0F172A');
  px(ctx, ox + 1, oy + 1, 5, 3, screenColor);
  px(ctx, ox + 1, oy + 2, 3, 1, accentColor);
  px(ctx, ox + 3, oy + 5, 1, 1, '#475569');
}

function drawChair(ctx: CanvasRenderingContext2D, ox: number, oy: number, fabricColor: string, dir: 'up' | 'down') {
  px(ctx, ox + 4, oy + 4, 8, 8, '#0F172A');
  px(ctx, ox + 5, oy + 5, 6, 6, fabricColor);
  if (dir === 'up') {
    px(ctx, ox + 4, oy + 9, 8, 3, '#1E293B');
    px(ctx, ox + 5, oy + 10, 6, 1, fabricColor);
  } else {
    px(ctx, ox + 4, oy + 3, 8, 3, '#1E293B');
    px(ctx, ox + 5, oy + 4, 6, 1, fabricColor);
  }
}

export function getFurnitureSprite(obj: InteractiveObject): HTMLCanvasElement {
  const key = `${obj.type}-${obj.widthTiles}x${obj.heightTiles}-${obj.interactive ? 'i' : 'n'}`;
  const cached = furnitureCache.get(key);
  if (cached) return cached;

  const w = obj.widthTiles * TILE_SIZE;
  const h = obj.heightTiles * TILE_SIZE;
  const [rawCanvas, ctx] = createOffscreen(w, h);
  const W = obj.widthTiles * 16;
  const H = obj.heightTiles * 16;

  switch (obj.type) {
    case 'ceo-desk-h': {
      px(ctx, 0, 2, W, 12, '#4A2511');
      px(ctx, 1, 3, W - 2, 9, '#854622');
      px(ctx, 1, 3, W - 2, 2, '#A65A2E');
      px(ctx, 6, 6, 10, 5, '#1E293B');
      px(ctx, 48, 5, 6, 4, '#F8FAFC');
      px(ctx, 50, 6, 3, 1, '#94A3B8');
      break;
    }
    case 'ceo-desk-v': {
      px(ctx, 1, 0, 14, H - 1, '#4A2511');
      px(ctx, 2, 0, 12, H - 3, '#854622');
      px(ctx, 4, 4, 7, 8, '#E2E8F0');
      px(ctx, 5, 6, 5, 1, '#64748B');
      px(ctx, 5, 9, 4, 1, '#64748B');
      break;
    }
    case 'ceo-console': {
      px(ctx, 2, 3, 12, 9, '#0F172A');
      px(ctx, 3, 4, 10, 6, '#1E293B');
      px(ctx, 4, 5, 8, 4, '#F59E0B');
      px(ctx, 5, 6, 4, 1, '#FEF3C7');
      px(ctx, 5, 7, 6, 1, '#FFFBEB');
      px(ctx, 4, 11, 8, 1, '#475569');
      break;
    }
    case 'ceo-chair': {
      px(ctx, 3, 3, 10, 10, '#1C1917');
      px(ctx, 4, 4, 8, 8, '#78350F');
      px(ctx, 5, 5, 6, 5, '#92400E');
      px(ctx, 4, 2, 8, 3, '#451A03');
      break;
    }
    case 'bookshelf-trophy': {
      px(ctx, 0, 1, W, 14, '#3F2312');
      px(ctx, 1, 2, W - 2, 11, '#5C341C');
      px(ctx, 1, 7, W - 2, 1, '#3F2312');
      const bookColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899'];
      for (let bx = 3; bx < 34; bx += 4) {
        px(ctx, bx, 3, 3, 4, bookColors[bx % bookColors.length]);
        px(ctx, bx, 8, 3, 4, bookColors[(bx + 2) % bookColors.length]);
      }
      px(ctx, 40, 3, 4, 4, '#FACC15');
      px(ctx, 41, 6, 2, 1, '#CA8A04');
      px(ctx, 48, 3, 4, 4, '#FACC15');
      px(ctx, 55, 8, 4, 4, '#FBBF24');
      break;
    }
    case 'plant-tall': {
      px(ctx, 4, 10, 8, 5, '#9A3412');
      px(ctx, 3, 9, 10, 2, '#C2410C');
      px(ctx, 3, 2, 10, 8, '#15803D');
      px(ctx, 5, 1, 6, 7, '#16A34A');
      px(ctx, 4, 4, 4, 3, '#22C55E');
      px(ctx, 9, 3, 4, 3, '#4ADE80');
      break;
    }
    case 'plant-small': {
      px(ctx, 5, 10, 6, 4, '#B45309');
      px(ctx, 4, 5, 8, 6, '#16A34A');
      px(ctx, 6, 4, 4, 4, '#4ADE80');
      break;
    }
    case 'guest-chair': {
      drawChair(ctx, 0, 0, '#92400E', 'down');
      break;
    }
    case 'office-chair-down': {
      drawChair(ctx, 0, 0, '#475569', 'down');
      break;
    }
    case 'office-chair-up': {
      drawChair(ctx, 0, 0, '#475569', 'up');
      break;
    }
    case 'projector-screen': {
      px(ctx, 2, 2, W - 4, 12, '#0F172A');
      px(ctx, 3, 3, W - 6, 10, '#F8FAFC');
      px(ctx, 6, 9, 5, 3, '#3B82F6');
      px(ctx, 13, 7, 5, 5, '#10B981');
      px(ctx, 20, 5, 5, 7, '#F59E0B');
      px(ctx, 30, 5, 28, 2, '#CBD5E1');
      px(ctx, 30, 9, 20, 1, '#94A3B8');
      break;
    }
    case 'oval-table-left': {
      px(ctx, 2, 2, 14, H - 4, '#334155');
      px(ctx, 4, 3, 12, H - 6, '#94A3B8');
      px(ctx, 5, 4, 11, H - 8, '#CBD5E1');
      break;
    }
    case 'oval-table-mid': {
      px(ctx, 0, 2, W, H - 4, '#334155');
      px(ctx, 0, 3, W, H - 6, '#94A3B8');
      px(ctx, 0, 4, W, H - 8, '#CBD5E1');
      px(ctx, 10, 13, 12, 5, '#1E293B');
      px(ctx, 42, 13, 12, 5, '#1E293B');
      px(ctx, 30, 14, 16, 3, '#64748B');
      break;
    }
    case 'oval-table-right': {
      px(ctx, 0, 2, 14, H - 4, '#334155');
      px(ctx, 0, 3, 12, H - 6, '#94A3B8');
      px(ctx, 0, 4, 11, H - 8, '#CBD5E1');
      break;
    }
    case 'whiteboard': {
      px(ctx, 1, 2, W - 2, 12, '#64748B');
      px(ctx, 2, 3, W - 4, 10, '#F8FAFC');
      px(ctx, 4, 5, 8, 2, '#3B82F6');
      px(ctx, 15, 6, 10, 1, '#EF4444');
      px(ctx, 5, 9, 18, 1, '#10B981');
      break;
    }
    case 'water-cooler': {
      px(ctx, 4, 7, 8, 8, '#E2E8F0');
      px(ctx, 5, 1, 6, 6, '#38BDF8');
      px(ctx, 6, 2, 2, 3, '#BAE6FD');
      px(ctx, 6, 9, 4, 2, '#64748B');
      break;
    }
    case 'kanban-board': {
      px(ctx, 2, 1, W - 4, 14, '#1E293B');
      px(ctx, 3, 2, W - 6, 12, '#F1F5F9');
      px(ctx, 28, 3, 1, 10, '#CBD5E1');
      px(ctx, 58, 3, 1, 10, '#CBD5E1');
      px(ctx, 6, 4, 7, 4, '#F59E0B');
      px(ctx, 15, 4, 7, 4, '#F59E0B');
      px(ctx, 6, 9, 7, 3, '#EF4444');
      px(ctx, 32, 4, 8, 4, '#38BDF8');
      px(ctx, 42, 4, 8, 4, '#A855F7');
      px(ctx, 32, 9, 8, 3, '#38BDF8');
      px(ctx, 62, 4, 8, 4, '#10B981');
      px(ctx, 72, 4, 8, 4, '#10B981');
      break;
    }
    case 'coord-desk': {
      px(ctx, 1, 2, W - 2, 12, '#334155');
      px(ctx, 2, 3, W - 4, 10, '#E2E8F0');
      drawMonitor(ctx, 18, 4, '#0284C7', '#BAE6FD');
      px(ctx, 6, 7, 5, 4, '#F8FAFC');
      px(ctx, 34, 6, 4, 4, '#F59E0B');
      break;
    }
    case 'filing-cabinet': {
      px(ctx, 2, 2, W - 4, 13, '#475569');
      px(ctx, 3, 3, W - 6, 5, '#64748B');
      px(ctx, 3, 9, W - 6, 5, '#64748B');
      px(ctx, 6, 5, 4, 1, '#CBD5E1');
      px(ctx, 6, 11, 4, 1, '#CBD5E1');
      break;
    }
    case 'desk-admin': {
      px(ctx, 1, 2, W - 2, 12, '#334155');
      px(ctx, 2, 3, W - 4, 10, '#E2E8F0');
      drawMonitor(ctx, 6, 4, '#1E3A8A', '#93C5FD');
      px(ctx, 19, 6, 8, 5, '#F8FAFC');
      px(ctx, 20, 7, 5, 1, '#64748B');
      break;
    }
    case 'desk-backend': {
      px(ctx, 1, 2, W - 2, 12, '#1E293B');
      px(ctx, 2, 3, W - 4, 10, '#64748B');
      drawMonitor(ctx, 4, 4, '#052E16', '#4ADE80');
      drawMonitor(ctx, 18, 4, '#052E16', '#22C55E');
      px(ctx, 11, 10, 8, 2, '#0F172A');
      break;
    }
    case 'desk-frontend': {
      px(ctx, 1, 2, W - 2, 12, '#312E81');
      px(ctx, 2, 3, W - 4, 10, '#E2E8F0');
      drawMonitor(ctx, 5, 4, '#3B0764', '#E879F9');
      drawMonitor(ctx, 17, 4, '#083344', '#22D3EE');
      px(ctx, 11, 10, 7, 2, '#94A3B8');
      break;
    }
    case 'desk-marketing': {
      px(ctx, 1, 2, W - 2, 12, '#7C2D12');
      px(ctx, 2, 3, W - 4, 10, '#FED7AA');
      drawMonitor(ctx, 6, 4, '#431407', '#FB923C');
      px(ctx, 19, 5, 6, 5, '#FEF08A');
      px(ctx, 21, 7, 3, 1, '#EA580C');
      break;
    }
    case 'printer-8bit': {
      px(ctx, 2, 4, 12, 10, '#334155');
      px(ctx, 3, 5, 10, 7, '#CBD5E1');
      px(ctx, 5, 2, 6, 3, '#F8FAFC');
      px(ctx, 5, 11, 6, 3, '#F8FAFC');
      px(ctx, 10, 7, 2, 1, '#22C55E');
      break;
    }
    case 'mini-rack': {
      px(ctx, 3, 2, 10, 13, '#0F172A');
      px(ctx, 4, 3, 8, 11, '#1E293B');
      px(ctx, 5, 4, 6, 2, '#334155');
      px(ctx, 5, 7, 6, 2, '#334155');
      px(ctx, 5, 10, 6, 2, '#334155');
      px(ctx, 6, 5, 1, 1, '#22C55E');
      px(ctx, 6, 8, 1, 1, '#38BDF8');
      break;
    }
    case 'wireframe-board': {
      px(ctx, 2, 2, W - 4, 12, '#334155');
      px(ctx, 3, 3, W - 6, 10, '#0F172A');
      px(ctx, 5, 4, 10, 8, '#1E293B');
      px(ctx, 6, 5, 8, 2, '#22D3EE');
      px(ctx, 18, 4, 12, 8, '#1E293B');
      px(ctx, 19, 5, 10, 2, '#C084FC');
      px(ctx, 33, 4, 10, 8, '#1E293B');
      px(ctx, 34, 5, 8, 2, '#38BDF8');
      break;
    }
    case 'campaign-board': {
      px(ctx, 2, 2, W - 4, 12, '#78350F');
      px(ctx, 3, 3, W - 6, 10, '#D97706');
      px(ctx, 5, 4, 6, 4, '#FEF08A');
      px(ctx, 14, 5, 7, 4, '#FDBA74');
      px(ctx, 24, 4, 6, 4, '#FDE047');
      px(ctx, 33, 5, 8, 4, '#FECACA');
      break;
    }
    case 'qa-bench': {
      px(ctx, 1, 2, W - 2, 12, '#334155');
      px(ctx, 2, 3, W - 4, 10, '#94A3B8');
      drawMonitor(ctx, 5, 4, '#0F172A', '#38BDF8');
      drawMonitor(ctx, 18, 4, '#0F172A', '#22C55E');
      drawMonitor(ctx, 32, 4, '#450A0A', '#F87171');
      drawMonitor(ctx, 46, 4, '#0F172A', '#FBBF24');
      break;
    }
    case 'qa-magnifier': {
      px(ctx, 2, 3, 12, 11, '#475569');
      px(ctx, 3, 4, 10, 9, '#CBD5E1');
      px(ctx, 5, 5, 5, 5, '#0EA5E9');
      px(ctx, 6, 6, 3, 3, '#BAE6FD');
      px(ctx, 9, 9, 3, 3, '#1E293B');
      break;
    }
    case 'qa-siren': {
      px(ctx, 4, 3, 8, 10, '#1E293B');
      px(ctx, 5, 4, 6, 7, '#7F1D1D');
      px(ctx, 6, 5, 4, 4, '#991B1B');
      break;
    }
    case 'reception-counter': {
      px(ctx, 1, 2, W - 2, 13, '#1E293B');
      px(ctx, 2, 3, W - 4, 10, '#0F766E');
      px(ctx, 2, 3, W - 4, 3, '#F8FAFC');
      drawMonitor(ctx, 18, 4, '#0F172A', '#2DD4BF');
      px(ctx, 44, 5, 4, 3, '#FACC15');
      break;
    }
    case 'sofa-v': {
      px(ctx, 2, 1, 12, H - 2, '#1E293B');
      px(ctx, 3, 2, 10, H - 4, '#0D9488');
      px(ctx, 8, 2, 5, H - 4, '#115E59');
      break;
    }
    case 'sofa-h': {
      px(ctx, 1, 2, W - 2, 12, '#31102F');
      px(ctx, 2, 3, W - 4, 10, '#BE185D');
      px(ctx, 2, 10, W - 4, 3, '#831843');
      break;
    }
    case 'coffee-table': {
      px(ctx, 3, 3, 10, 10, '#451A03');
      px(ctx, 4, 4, 8, 8, '#B45309');
      px(ctx, 6, 6, 4, 3, '#F8FAFC');
      break;
    }
    case 'server-rack': {
      px(ctx, 2, 1, 12, 14, '#020617');
      px(ctx, 3, 2, 10, 12, '#1E293B');
      px(ctx, 4, 3, 8, 2, '#0F172A');
      px(ctx, 4, 6, 8, 2, '#0F172A');
      px(ctx, 4, 9, 8, 2, '#0F172A');
      px(ctx, 4, 12, 8, 1, '#334155');
      break;
    }
    case 'ac-unit': {
      px(ctx, 2, 2, W - 4, 10, '#94A3B8');
      px(ctx, 3, 3, W - 6, 8, '#F8FAFC');
      px(ctx, 5, 8, W - 10, 2, '#38BDF8');
      break;
    }
    case 'vault-terminal': {
      px(ctx, 3, 2, 10, 12, '#0F172A');
      px(ctx, 4, 3, 8, 8, '#22C55E');
      px(ctx, 5, 4, 6, 5, '#052E16');
      px(ctx, 6, 5, 4, 1, '#4ADE80');
      px(ctx, 6, 7, 3, 1, '#4ADE80');
      break;
    }
    case 'fridge': {
      px(ctx, 3, 1, 10, 14, '#64748B');
      px(ctx, 4, 2, 8, 12, '#E2E8F0');
      px(ctx, 4, 7, 8, 1, '#94A3B8');
      px(ctx, 10, 4, 1, 2, '#475569');
      px(ctx, 10, 9, 1, 3, '#475569');
      break;
    }
    case 'espresso-counter': {
      px(ctx, 1, 2, W - 2, 12, '#475569');
      px(ctx, 2, 3, W - 4, 10, '#E2E8F0');
      px(ctx, 6, 3, 10, 8, '#1E293B');
      px(ctx, 7, 4, 8, 4, '#B91C1C');
      px(ctx, 9, 9, 2, 2, '#F8FAFC');
      px(ctx, 20, 6, 6, 4, '#78350F');
      break;
    }
    case 'microwave-counter': {
      px(ctx, 1, 2, W - 2, 12, '#475569');
      px(ctx, 2, 3, W - 4, 10, '#E2E8F0');
      px(ctx, 5, 4, 10, 7, '#334155');
      px(ctx, 6, 5, 6, 5, '#0F172A');
      px(ctx, 13, 6, 1, 3, '#38BDF8');
      break;
    }
    case 'cafe-table': {
      px(ctx, 2, 2, 12, 12, '#78350F');
      px(ctx, 3, 3, 10, 10, '#F59E0B');
      px(ctx, 4, 4, 8, 8, '#FEF3C7');
      px(ctx, 6, 6, 2, 2, '#78350F');
      break;
    }
    case 'stool': {
      px(ctx, 5, 5, 6, 6, '#334155');
      px(ctx, 6, 6, 4, 4, '#94A3B8');
      break;
    }
    case 'arcade-cabinet': {
      px(ctx, 3, 1, 10, 14, '#1E1B4B');
      px(ctx, 4, 2, 8, 3, '#EC4899');
      px(ctx, 4, 5, 8, 5, '#0F172A');
      px(ctx, 4, 10, 8, 3, '#4F46E5');
      px(ctx, 5, 11, 1, 1, '#FACC15');
      px(ctx, 9, 11, 1, 1, '#EF4444');
      break;
    }
    case 'beanbag-cyan': {
      px(ctx, 3, 3, 10, 10, '#0E7490');
      px(ctx, 4, 4, 8, 8, '#06B6D4');
      px(ctx, 5, 5, 4, 4, '#67E8F9');
      break;
    }
    case 'beanbag-amber': {
      px(ctx, 3, 3, 10, 10, '#B45309');
      px(ctx, 4, 4, 8, 8, '#F59E0B');
      px(ctx, 5, 5, 4, 4, '#FDE68A');
      break;
    }
    case 'pingpong-table': {
      px(ctx, 2, 2, W - 4, H - 4, '#0F172A');
      px(ctx, 3, 3, W - 6, H - 6, '#15803D');
      px(ctx, 3, 3, W - 6, 1, '#F8FAFC');
      px(ctx, 3, H - 4, W - 6, 1, '#F8FAFC');
      px(ctx, 3, 3, 1, H - 6, '#F8FAFC');
      px(ctx, W - 4, 3, 1, H - 6, '#F8FAFC');
      px(ctx, 4, 15, W - 8, 1, '#F8FAFC');
      px(ctx, 23, 2, 2, H - 4, '#E2E8F0');
      px(ctx, 7, 10, 3, 3, '#EF4444');
      px(ctx, 38, 18, 3, 3, '#1E293B');
      break;
    }
    case 'sink-mirror': {
      px(ctx, 2, 1, W - 4, 4, '#38BDF8');
      px(ctx, 4, 2, 8, 2, '#E0F2FE');
      px(ctx, 18, 2, 8, 2, '#E0F2FE');
      px(ctx, 34, 2, 8, 2, '#E0F2FE');
      px(ctx, 2, 5, W - 4, 9, '#94A3B8');
      px(ctx, 5, 7, 7, 5, '#F8FAFC');
      px(ctx, 20, 7, 7, 5, '#F8FAFC');
      px(ctx, 35, 7, 7, 5, '#F8FAFC');
      break;
    }
    case 'toilet-stall': {
      px(ctx, 1, 1, 14, 14, '#475569');
      px(ctx, 2, 2, 12, 11, '#F1F5F9');
      px(ctx, 5, 4, 6, 7, '#FFFFFF');
      px(ctx, 2, 13, 12, 2, '#64748B');
      px(ctx, 11, 13, 2, 1, '#EF4444');
      break;
    }
    case 'locker': {
      px(ctx, 2, 1, 12, H - 2, '#334155');
      for (let ly = 2; ly < H - 3; ly += 15) {
        px(ctx, 3, ly, 10, 13, '#64748B');
        px(ctx, 5, ly + 2, 6, 1, '#1E293B');
        px(ctx, 11, ly + 6, 1, 2, '#FACC15');
      }
      break;
    }
  }

  // Apply 2.5D soft drop shadow under all furniture and crisp 1px dark outline on interactive furniture
  const styled = applyPixelDepthAndOutline(rawCanvas, obj.interactive, true);
  furnitureCache.set(key, styled);
  return styled;
}
