import { Direction } from '../types/office';

const P = 2; // 2px per pixel block -> 16x20 pixel grid = 32x40 canvas
const SPRITE_W = 32;
const SPRITE_H = 40;

const avatarCache = new Map<string, HTMLCanvasElement>();

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * P, y * P, w * P, h * P);
}

export function getCeoAvatarSprite(
  direction: Direction,
  frame: number,
  isWalking: boolean
): HTMLCanvasElement {
  const animFrame = isWalking ? frame % 4 : frame % 2;
  const key = `ceo-${direction}-${isWalking ? 'w' : 'i'}-${animFrame}`;
  const cached = avatarCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W;
  canvas.height = SPRITE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Palette for CEO (Dono)
  const OUTLINE = '#0F172A';
  const HAIR = '#291D16';
  const HAIR_HIGHLIGHT = '#4A3427';
  const SKIN = '#F3C6A5';
  const SKIN_SHADE = '#D9A079';
  const SUIT = '#1E3A5F';
  const SUIT_DARK = '#132640';
  const SUIT_LIGHT = '#2D5282';
  const SHIRT = '#F8FAFC';
  const TIE = '#F59E0B';
  const PANTS = '#0F172A';
  const SHOES = '#1C1917';

  // Idle breathing bob (1px drop on frame 1) or walk bounce
  const bobY = isWalking ? (animFrame === 1 || animFrame === 3 ? -1 : 0) : animFrame === 1 ? 1 : 0;

  // Ground shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
  ctx.fillRect(4 * P, 17 * P, 8 * P, 2 * P);

  // Leg & arm offsets for walk cycle
  const leftStep = isWalking ? (animFrame === 0 ? -1 : animFrame === 2 ? 1 : 0) : 0;
  const rightStep = isWalking ? (animFrame === 2 ? -1 : animFrame === 0 ? 1 : 0) : 0;

  if (direction === 'down') {
    // Head outline & hair
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 3, HAIR);
    px(ctx, 6, 2 + bobY, 3, 1, HAIR_HIGHLIGHT);
    px(ctx, 4, 3 + bobY, 1, 2, HAIR);
    px(ctx, 11, 3 + bobY, 1, 2, HAIR);
    // Face
    px(ctx, 5, 4 + bobY, 6, 4, SKIN);
    px(ctx, 5, 7 + bobY, 6, 1, SKIN_SHADE);
    // Eyes
    px(ctx, 6, 5 + bobY, 1, 2, OUTLINE);
    px(ctx, 9, 5 + bobY, 1, 2, OUTLINE);

    // Torso (Suit + White Shirt + Amber Tie)
    px(ctx, 3, 9 + bobY, 10, 6, OUTLINE);
    px(ctx, 4, 9 + bobY, 8, 5, SUIT);
    px(ctx, 4, 9 + bobY, 2, 5, SUIT_LIGHT);
    px(ctx, 10, 9 + bobY, 2, 5, SUIT_DARK);
    px(ctx, 7, 9 + bobY, 2, 4, SHIRT);
    px(ctx, 7, 10 + bobY, 2, 3, TIE);

    // Arms
    px(ctx, 3, 9 + bobY + (leftStep > 0 ? 1 : 0), 1, 4, SUIT_DARK);
    px(ctx, 3, 13 + bobY + (leftStep > 0 ? 1 : 0), 1, 1, SKIN);
    px(ctx, 12, 9 + bobY + (rightStep > 0 ? 1 : 0), 1, 4, SUIT_DARK);
    px(ctx, 12, 13 + bobY + (rightStep > 0 ? 1 : 0), 1, 1, SKIN);

    // Legs & Shoes
    px(ctx, 5, 14 + bobY, 2, 3 + (leftStep < 0 ? -1 : 0), PANTS);
    px(ctx, 9, 14 + bobY, 2, 3 + (rightStep < 0 ? -1 : 0), PANTS);
    px(ctx, 5, 17 + leftStep, 2, 1, SHOES);
    px(ctx, 9, 17 + rightStep, 2, 1, SHOES);
  } else if (direction === 'up') {
    // Head back (full hair)
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 6, HAIR);
    px(ctx, 6, 3 + bobY, 4, 2, HAIR_HIGHLIGHT);

    // Suit back
    px(ctx, 3, 9 + bobY, 10, 6, OUTLINE);
    px(ctx, 4, 9 + bobY, 8, 5, SUIT);
    px(ctx, 5, 10 + bobY, 6, 3, SUIT_LIGHT);
    px(ctx, 7, 12 + bobY, 2, 2, SUIT_DARK);

    // Arms
    px(ctx, 3, 9 + bobY + (leftStep > 0 ? 1 : 0), 1, 4, SUIT_DARK);
    px(ctx, 12, 9 + bobY + (rightStep > 0 ? 1 : 0), 1, 4, SUIT_DARK);

    // Legs & Shoes
    px(ctx, 5, 14 + bobY, 2, 3 + (leftStep < 0 ? -1 : 0), PANTS);
    px(ctx, 9, 14 + bobY, 2, 3 + (rightStep < 0 ? -1 : 0), PANTS);
    px(ctx, 5, 17 + leftStep, 2, 1, SHOES);
    px(ctx, 9, 17 + rightStep, 2, 1, SHOES);
  } else if (direction === 'left') {
    // Side profile facing left
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 3, HAIR);
    px(ctx, 7, 4 + bobY, 4, 4, HAIR);
    px(ctx, 5, 4 + bobY, 3, 4, SKIN);
    px(ctx, 5, 5 + bobY, 1, 2, OUTLINE); // Eye

    // Suit side
    px(ctx, 5, 9 + bobY, 6, 6, OUTLINE);
    px(ctx, 6, 9 + bobY, 4, 5, SUIT);
    px(ctx, 5, 10 + bobY, 1, 2, SHIRT);
    px(ctx, 5, 11 + bobY, 1, 2, TIE);

    // Swinging arm
    const armShift = isWalking ? (animFrame === 0 ? -1 : animFrame === 2 ? 1 : 0) : 0;
    px(ctx, 7 + armShift, 10 + bobY, 2, 3, SUIT_LIGHT);
    px(ctx, 7 + armShift, 13 + bobY, 2, 1, SKIN);

    // Stepping legs
    px(ctx, 6 + leftStep, 14 + bobY, 2, 3, PANTS);
    px(ctx, 8 + rightStep, 14 + bobY, 2, 3, PANTS);
    px(ctx, 5 + leftStep, 17, 3, 1, SHOES);
    px(ctx, 8 + rightStep, 17, 3, 1, SHOES);
  } else {
    // Side profile facing right
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 3, HAIR);
    px(ctx, 5, 4 + bobY, 4, 4, HAIR);
    px(ctx, 8, 4 + bobY, 3, 4, SKIN);
    px(ctx, 10, 5 + bobY, 1, 2, OUTLINE); // Eye

    // Suit side
    px(ctx, 5, 9 + bobY, 6, 6, OUTLINE);
    px(ctx, 6, 9 + bobY, 4, 5, SUIT);
    px(ctx, 10, 10 + bobY, 1, 2, SHIRT);
    px(ctx, 10, 11 + bobY, 1, 2, TIE);

    // Swinging arm
    const armShift = isWalking ? (animFrame === 0 ? 1 : animFrame === 2 ? -1 : 0) : 0;
    px(ctx, 7 + armShift, 10 + bobY, 2, 3, SUIT_LIGHT);
    px(ctx, 7 + armShift, 13 + bobY, 2, 1, SKIN);

    // Stepping legs
    px(ctx, 6 + leftStep, 14 + bobY, 2, 3, PANTS);
    px(ctx, 8 + rightStep, 14 + bobY, 2, 3, PANTS);
    px(ctx, 6 + leftStep, 17, 3, 1, SHOES);
    px(ctx, 8 + rightStep, 17, 3, 1, SHOES);
  }

  avatarCache.set(key, canvas);
  return canvas;
}
