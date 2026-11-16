import { AgentSpriteVariant, Direction } from '../types/office';

const P = 2; // 2px per pixel block -> 16x20 pixel grid = 32x40 canvas
const SPRITE_W = 32;
const SPRITE_H = 40;

const avatarCache = new Map<string, HTMLCanvasElement>();

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * P, y * P, w * P, h * P);
}

interface SpritePalette {
  hair: string;
  hairHighlight: string;
  skin: string;
  skinShade: string;
  suit: string;
  suitDark: string;
  suitLight: string;
  shirt: string;
  accent: string; // tie or crachá/badge
  pants: string;
  glasses?: string;
}

function getPalette(variant: AgentSpriteVariant): SpritePalette {
  switch (variant) {
    case 'coord-team':
      return {
        hair: '#1E293B',
        hairHighlight: '#334155',
        skin: '#EBC09D',
        skinShade: '#C99670',
        suit: '#0E7490',
        suitDark: '#164E63',
        suitLight: '#06B6D4',
        shirt: '#F1F5F9',
        accent: '#38BDF8',
        pants: '#1E293B',
        glasses: '#BAE6FD',
      };
    case 'coord-finance':
      return {
        hair: '#7C2D12',
        hairHighlight: '#B45309',
        skin: '#F5CFB4',
        skinShade: '#D9A785',
        suit: '#065F46',
        suitDark: '#064E3B',
        suitLight: '#10B981',
        shirt: '#FFFFFF',
        accent: '#FACC15',
        pants: '#0F172A',
      };
    case 'backend':
      return {
        hair: '#0F172A',
        hairHighlight: '#334155',
        skin: '#DFB08C',
        skinShade: '#BA8863',
        suit: '#166534',
        suitDark: '#14532D',
        suitLight: '#22C55E',
        shirt: '#0F172A',
        accent: '#4ADE80',
        pants: '#1E293B',
        glasses: '#86EFAC',
      };
    case 'frontend':
      return {
        hair: '#4C1D95',
        hairHighlight: '#7C3AED',
        skin: '#F7D4BC',
        skinShade: '#DBA888',
        suit: '#6D28D9',
        suitDark: '#4C1D95',
        suitLight: '#A855F7',
        shirt: '#F8FAFC',
        accent: '#22D3EE',
        pants: '#1E1B4B',
      };
    case 'admin':
      return {
        hair: '#451A03',
        hairHighlight: '#78350F',
        skin: '#EBC09D',
        skinShade: '#C99670',
        suit: '#334155',
        suitDark: '#1E293B',
        suitLight: '#64748B',
        shirt: '#F8FAFC',
        accent: '#93C5FD',
        pants: '#0F172A',
      };
    case 'marketing':
      return {
        hair: '#9A3412',
        hairHighlight: '#EA580C',
        skin: '#F3C6A5',
        skinShade: '#D9A079',
        suit: '#C2410C',
        suitDark: '#9A3412',
        suitLight: '#F97316',
        shirt: '#FFFBEB',
        accent: '#FDE047',
        pants: '#292524',
      };
    case 'qa':
      return {
        hair: '#3F3F46',
        hairHighlight: '#71717A',
        skin: '#F3C6A5',
        skinShade: '#D9A079',
        suit: '#B91C1C',
        suitDark: '#7F1D1D',
        suitLight: '#EF4444',
        shirt: '#F8FAFC',
        accent: '#FCA5A5',
        pants: '#18181B',
      };
    case 'reception':
      return {
        hair: '#1E1B4B',
        hairHighlight: '#4338CA',
        skin: '#EBC09D',
        skinShade: '#C99670',
        suit: '#0F766E',
        suitDark: '#115E59',
        suitLight: '#14B8A6',
        shirt: '#F0FDFA',
        accent: '#5EEAD4',
        pants: '#134E4A',
      };
    case 'ceo':
    default:
      return {
        hair: '#291D16',
        hairHighlight: '#4A3427',
        skin: '#F3C6A5',
        skinShade: '#D9A079',
        suit: '#1E3A5F',
        suitDark: '#132640',
        suitLight: '#2D5282',
        shirt: '#F8FAFC',
        accent: '#F59E0B',
        pants: '#0F172A',
      };
  }
}

export function getAvatarSprite(
  variant: AgentSpriteVariant,
  direction: Direction,
  frame: number,
  isWalking: boolean
): HTMLCanvasElement {
  const animFrame = isWalking ? frame % 4 : frame % 2;
  const key = `${variant}-${direction}-${isWalking ? 'w' : 'i'}-${animFrame}`;
  const cached = avatarCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W;
  canvas.height = SPRITE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const pal = getPalette(variant);
  const OUTLINE = '#0F172A';
  const SHOES = '#1C1917';

  const bobY = isWalking ? (animFrame === 1 || animFrame === 3 ? -1 : 0) : animFrame === 1 ? 1 : 0;

  // Soft 2.5D ground drop shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
  ctx.fillRect(3 * P, 17 * P, 10 * P, 2 * P);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
  ctx.fillRect(4 * P, 17 * P, 8 * P, 2 * P);

  const leftStep = isWalking ? (animFrame === 0 ? -1 : animFrame === 2 ? 1 : 0) : 0;
  const rightStep = isWalking ? (animFrame === 2 ? -1 : animFrame === 0 ? 1 : 0) : 0;

  if (direction === 'down') {
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 3, pal.hair);
    px(ctx, 6, 2 + bobY, 3, 1, pal.hairHighlight);
    px(ctx, 4, 3 + bobY, 1, 2, pal.hair);
    px(ctx, 11, 3 + bobY, 1, 2, pal.hair);
    if (variant === 'coord-finance') {
      // Longer side hair silhouette for Vega
      px(ctx, 4, 5 + bobY, 1, 3, pal.hair);
      px(ctx, 11, 5 + bobY, 1, 3, pal.hair);
    }

    // Face
    px(ctx, 5, 4 + bobY, 6, 4, pal.skin);
    px(ctx, 5, 7 + bobY, 6, 1, pal.skinShade);
    // Eyes
    px(ctx, 6, 5 + bobY, 1, 2, OUTLINE);
    px(ctx, 9, 5 + bobY, 1, 2, OUTLINE);
    if (pal.glasses) {
      px(ctx, 5, 5 + bobY, 3, 1, pal.glasses);
      px(ctx, 8, 5 + bobY, 3, 1, pal.glasses);
    }

    // Torso
    px(ctx, 3, 9 + bobY, 10, 6, OUTLINE);
    px(ctx, 4, 9 + bobY, 8, 5, pal.suit);
    px(ctx, 4, 9 + bobY, 2, 5, pal.suitLight);
    px(ctx, 10, 9 + bobY, 2, 5, pal.suitDark);
    px(ctx, 7, 9 + bobY, 2, 4, pal.shirt);

    if (variant === 'ceo') {
      px(ctx, 7, 10 + bobY, 2, 3, pal.accent);
    } else {
      // Visible crachá badge on chest for coordinators
      px(ctx, 9, 10 + bobY, 2, 2, pal.accent);
      px(ctx, 9, 10 + bobY, 1, 1, '#FFFFFF');
    }

    // Arms
    px(ctx, 3, 9 + bobY + (leftStep > 0 ? 1 : 0), 1, 4, pal.suitDark);
    px(ctx, 3, 13 + bobY + (leftStep > 0 ? 1 : 0), 1, 1, pal.skin);
    px(ctx, 12, 9 + bobY + (rightStep > 0 ? 1 : 0), 1, 4, pal.suitDark);
    px(ctx, 12, 13 + bobY + (rightStep > 0 ? 1 : 0), 1, 1, pal.skin);

    // Legs & Shoes
    px(ctx, 5, 14 + bobY, 2, 3 + (leftStep < 0 ? -1 : 0), pal.pants);
    px(ctx, 9, 14 + bobY, 2, 3 + (rightStep < 0 ? -1 : 0), pal.pants);
    px(ctx, 5, 17 + leftStep, 2, 1, SHOES);
    px(ctx, 9, 17 + rightStep, 2, 1, SHOES);
  } else if (direction === 'up') {
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 6, pal.hair);
    px(ctx, 6, 3 + bobY, 4, 2, pal.hairHighlight);

    px(ctx, 3, 9 + bobY, 10, 6, OUTLINE);
    px(ctx, 4, 9 + bobY, 8, 5, pal.suit);
    px(ctx, 5, 10 + bobY, 6, 3, pal.suitLight);
    px(ctx, 7, 12 + bobY, 2, 2, pal.suitDark);

    px(ctx, 3, 9 + bobY + (leftStep > 0 ? 1 : 0), 1, 4, pal.suitDark);
    px(ctx, 12, 9 + bobY + (rightStep > 0 ? 1 : 0), 1, 4, pal.suitDark);

    px(ctx, 5, 14 + bobY, 2, 3 + (leftStep < 0 ? -1 : 0), pal.pants);
    px(ctx, 9, 14 + bobY, 2, 3 + (rightStep < 0 ? -1 : 0), pal.pants);
    px(ctx, 5, 17 + leftStep, 2, 1, SHOES);
    px(ctx, 9, 17 + rightStep, 2, 1, SHOES);
  } else if (direction === 'left') {
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 3, pal.hair);
    px(ctx, 7, 4 + bobY, 4, 4, pal.hair);
    px(ctx, 5, 4 + bobY, 3, 4, pal.skin);
    px(ctx, 5, 5 + bobY, 1, 2, OUTLINE);
    if (pal.glasses) px(ctx, 5, 5 + bobY, 2, 1, pal.glasses);

    px(ctx, 5, 9 + bobY, 6, 6, OUTLINE);
    px(ctx, 6, 9 + bobY, 4, 5, pal.suit);
    px(ctx, 5, 10 + bobY, 1, 2, pal.shirt);
    px(ctx, 5, 11 + bobY, 1, 2, pal.accent);

    const armShift = isWalking ? (animFrame === 0 ? -1 : animFrame === 2 ? 1 : 0) : 0;
    px(ctx, 7 + armShift, 10 + bobY, 2, 3, pal.suitLight);
    px(ctx, 7 + armShift, 13 + bobY, 2, 1, pal.skin);

    px(ctx, 6 + leftStep, 14 + bobY, 2, 3, pal.pants);
    px(ctx, 8 + rightStep, 14 + bobY, 2, 3, pal.pants);
    px(ctx, 5 + leftStep, 17, 3, 1, SHOES);
    px(ctx, 8 + rightStep, 17, 3, 1, SHOES);
  } else {
    px(ctx, 4, 1 + bobY, 8, 8, OUTLINE);
    px(ctx, 5, 2 + bobY, 6, 3, pal.hair);
    px(ctx, 5, 4 + bobY, 4, 4, pal.hair);
    px(ctx, 8, 4 + bobY, 3, 4, pal.skin);
    px(ctx, 10, 5 + bobY, 1, 2, OUTLINE);
    if (pal.glasses) px(ctx, 9, 5 + bobY, 2, 1, pal.glasses);

    px(ctx, 5, 9 + bobY, 6, 6, OUTLINE);
    px(ctx, 6, 9 + bobY, 4, 5, pal.suit);
    px(ctx, 10, 10 + bobY, 1, 2, pal.shirt);
    px(ctx, 10, 11 + bobY, 1, 2, pal.accent);

    const armShift = isWalking ? (animFrame === 0 ? 1 : animFrame === 2 ? -1 : 0) : 0;
    px(ctx, 7 + armShift, 10 + bobY, 2, 3, pal.suitLight);
    px(ctx, 7 + armShift, 13 + bobY, 2, 1, pal.skin);

    px(ctx, 6 + leftStep, 14 + bobY, 2, 3, pal.pants);
    px(ctx, 8 + rightStep, 14 + bobY, 2, 3, pal.pants);
    px(ctx, 6 + leftStep, 17, 3, 1, SHOES);
    px(ctx, 8 + rightStep, 17, 3, 1, SHOES);
  }

  avatarCache.set(key, canvas);
  return canvas;
}

export function getCeoAvatarSprite(
  direction: Direction,
  frame: number,
  isWalking: boolean
): HTMLCanvasElement {
  return getAvatarSprite('ceo', direction, frame, isWalking);
}
