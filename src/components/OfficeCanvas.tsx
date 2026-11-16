import React, { useEffect, useRef, useState } from 'react';
import {
  FURNITURE_OBJECTS,
  MAP_COLS,
  MAP_ROWS,
  OFFICE_GRID,
  TILE_SIZE,
} from '../data/officeLayout';
import { getAvatarSprite } from '../engine/avatarSprites';
import { getFloorSprite, getFurnitureSprite, getWallSprite } from '../engine/pixelArt';
import { InputKeysState, stepSimulation } from '../engine/simulationEngine';
import { useOffice } from '../context/OfficeContext';
import {
  Agent,
  InteractiveObject,
  RoomConfig,
  RoomId,
  SpeechBubble,
  TileCoord,
} from '../types/office';

const DRAG_THRESHOLD_PX = 5;

function buildStaticWorldCanvas(): HTMLCanvasElement {
  const w = MAP_COLS * TILE_SIZE;
  const h = MAP_ROWS * TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const floorSprite = getFloorSprite(OFFICE_GRID.floors[y][x]);
      ctx.drawImage(floorSprite, x * TILE_SIZE, y * TILE_SIZE);
    }
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
  for (let x = 5; x <= 7; x++) {
    ctx.fillRect(x * TILE_SIZE, 36 * TILE_SIZE + 8, TILE_SIZE, 20);
  }
  ctx.fillStyle = '#0F766E';
  ctx.fillRect(5 * TILE_SIZE + 6, 36 * TILE_SIZE + 12, TILE_SIZE * 3 - 12, 14);
  ctx.fillStyle = '#CCFBF1';
  ctx.font = 'bold 9px Silkscreen, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ENTRADA', 6.5 * TILE_SIZE, 36 * TILE_SIZE + 22);

  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const wall = OFFICE_GRID.walls[y][x];
      if (wall) {
        const wallSprite = getWallSprite(wall);
        ctx.drawImage(wallSprite, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
  }

  return canvas;
}

function drawRoomPlaque(
  ctx: CanvasRenderingContext2D,
  room: RoomConfig,
  isSelected: boolean,
  isHovered: boolean
) {
  const cx = (room.signTile.x + 0.5) * TILE_SIZE;
  const cy = room.signTile.y * TILE_SIZE + 10;

  ctx.font = 'bold 9px Silkscreen, monospace';
  const text = room.shortName.toUpperCase();
  const metrics = ctx.measureText(text);
  const padX = 6;
  const boxW = Math.ceil(metrics.width) + padX * 2;
  const boxH = 15;
  const bx = Math.round(cx - boxW / 2);
  const by = Math.round(cy - boxH / 2);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(bx + 2, by + 2, boxW, boxH);

  ctx.fillStyle = isSelected ? '#F59E0B' : isHovered ? '#1E293B' : '#0F172A';
  ctx.fillRect(bx, by, boxW, boxH);

  ctx.strokeStyle = isSelected ? '#FEF3C7' : isHovered ? '#F8FAFC' : room.accentColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

  ctx.fillStyle = isSelected ? '#0F172A' : '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(cx), Math.round(cy) + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawVacantSlotMarker(ctx: CanvasRenderingContext2D, tile: TileCoord) {
  const sx = tile.x * TILE_SIZE;
  const sy = tile.y * TILE_SIZE;

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(sx + 6.5, sy + 6.5, TILE_SIZE - 13, TILE_SIZE - 13);
  ctx.setLineDash([]);

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(sx + 15, sy + 11, 2, 10);
  ctx.fillRect(sx + 11, sy + 15, 10, 2);
  ctx.restore();
}

function wrapPixelLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  bubble: SpeechBubble,
  ambientTimer: number
) {
  const remaining = bubble.expiresAt - ambientTimer;
  if (remaining <= 0) return;

  const alpha = remaining < 0.8 ? Math.max(0, remaining / 0.8) : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '600 9px Plus Jakarta Sans, sans-serif';

  const maxTextW = 148;
  const lines = wrapPixelLines(ctx, bubble.text, maxTextW);
  let longest = 0;
  for (const line of lines) {
    longest = Math.max(longest, ctx.measureText(line).width);
  }

  const padX = 7;
  const padY = 5;
  const lineH = 11;
  const boxW = Math.ceil(longest) + padX * 2;
  const boxH = lines.length * lineH + padY * 2;

  const centerX = Math.round(agent.position.x * TILE_SIZE + TILE_SIZE / 2);
  const bx = Math.round(centerX - boxW / 2);
  const by = Math.round(agent.position.y * TILE_SIZE - 26 - boxH);

  // Pixel drop shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.fillRect(bx + 2, by + 2, boxW, boxH);

  // Bubble body
  ctx.fillStyle = '#FFFBEB';
  ctx.fillRect(bx, by, boxW, boxH);

  // Pixel border
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

  // Tail triangle
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(centerX - 3, by + boxH - 1, 6, 3);
  ctx.fillRect(centerX - 1, by + boxH + 2, 2, 2);
  ctx.fillStyle = '#FFFBEB';
  ctx.fillRect(centerX - 2, by + boxH - 1, 4, 2);

  // Text
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, by + padY + 8 + i * lineH);
  });

  ctx.restore();
}

function getSignAtWorldPos(wx: number, wy: number, rooms: RoomConfig[]): RoomConfig | null {
  for (const room of rooms) {
    const cx = (room.signTile.x + 0.5) * TILE_SIZE;
    const cy = room.signTile.y * TILE_SIZE + 10;
    const halfW = 54;
    const halfH = 12;
    if (wx >= cx - halfW && wx <= cx + halfW && wy >= cy - halfH && wy <= cy + halfH) {
      return room;
    }
  }
  return null;
}

function getAgentAtWorldPos(wx: number, wy: number, agents: Agent[]): Agent | null {
  // Check front-to-back (higher Y first)
  const sorted = [...agents].sort((a, b) => b.position.y - a.position.y);
  for (const agent of sorted) {
    const ax = agent.position.x * TILE_SIZE;
    const ay = agent.position.y * TILE_SIZE - 8;
    if (wx >= ax - 2 && wx <= ax + TILE_SIZE + 2 && wy >= ay - 4 && wy <= ay + 42) {
      return agent;
    }
  }
  return null;
}

export const OfficeCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const staticWorldRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<InputKeysState>({ up: false, down: false, left: false, right: false });

  const dragStateRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
    moved: boolean;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    camStartX: 0,
    camStartY: 0,
    moved: false,
  });

  const {
    rooms,
    agentsRef,
    simulationRuntimeRef,
    cameraRef,
    selectedRoomId,
    selectedObject,
    selectedAgentId,
    hoveredRoomId,
    hoveredObject,
    hoveredAgentId,
    qaSirenActive,
    qaSirenMode,
    activeWarRoomSession,
    clock,
    pendingRequisitions,
    deliveredArtifacts,
    unreadDeliveriesCount,
    selectRoom,
    selectAgent,
    setHoverTarget,
    moveCeoToTile,
    centerOnCeo,
    adjustZoom,
    setFollowCeo,
    advanceClockMinute,
    syncUiSnapshot,
    addLocalSimLog,
    handleDeliveryArrived,
    handleNewHireSeated,
    handleWarRoomSeatArrived,
    handleQaBenchArrived,
    openBriefingModal,
    openHiringModal,
  } = useOffice();

  const [hoverSignRoom, setHoverSignRoom] = useState<RoomId | null>(null);
  const [cursorTooltipPos, setCursorTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const warRoomActive =
    activeWarRoomSession?.status === 'convening' || activeWarRoomSession?.status === 'aligning';

  const stateRef = useRef({
    rooms,
    selectedRoomId,
    selectedObject,
    selectedAgentId,
    hoveredRoomId,
    hoveredObject,
    hoveredAgentId,
    qaSirenActive,
    qaSirenMode,
    warRoomActive,
    clockPaused: clock.isPaused,
    hoverSignRoom,
    pendingReqsCount: pendingRequisitions.length,
    deliveredCount: deliveredArtifacts.length,
    unreadCount: unreadDeliveriesCount,
  });
  stateRef.current = {
    rooms,
    selectedRoomId,
    selectedObject,
    selectedAgentId,
    hoveredRoomId,
    hoveredObject,
    hoveredAgentId,
    qaSirenActive,
    qaSirenMode,
    warRoomActive,
    clockPaused: clock.isPaused,
    hoverSignRoom,
    pendingReqsCount: pendingRequisitions.length,
    deliveredCount: deliveredArtifacts.length,
    unreadCount: unreadDeliveriesCount,
  };

  useEffect(() => {
    staticWorldRef.current = buildStaticWorldCanvas();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      switch (e.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
          keysRef.current.up = true;
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          keysRef.current.down = true;
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          keysRef.current.left = true;
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          keysRef.current.right = true;
          break;
        case ' ':
          e.preventDefault();
          centerOnCeo();
          break;
        case 'c':
        case 'C':
          centerOnCeo();
          break;
        case '=':
        case '+':
          adjustZoom(0.2);
          break;
        case '-':
        case '_':
          adjustZoom(-0.2);
          break;
        case 'Escape':
          selectRoom(null, null);
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
          keysRef.current.up = false;
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          keysRef.current.down = false;
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          keysRef.current.left = false;
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          keysRef.current.right = false;
          break;
      }
    };

    const onBlur = () => {
      keysRef.current = { up: false, down: false, left: false, right: false };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [adjustZoom, centerOnCeo, selectRoom]);

  // 60 FPS Simulation & Render Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let uiSyncTimer = 0;

    const sortedFurniture = [...FURNITURE_OBJECTS].sort((a, b) => a.anchor.y - b.anchor.y);

    const vacantSlotRoomIds = new Set<RoomId>([
      'coordenadores',
      'admin',
      'backend',
      'frontend',
      'marketing',
      'qa-lab',
      'recepcao',
    ]);

    const frame = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const runtime = simulationRuntimeRef.current;
      const st = stateRef.current;

      // 1. Step 60 FPS Simulation (CEO + Coordinators + Specialists + Missions)
      stepSimulation(
        dt,
        agentsRef.current,
        keysRef.current,
        runtime,
        st.clockPaused,
        {
          onMinuteTick: advanceClockMinute,
          onSpeechLogged: addLocalSimLog,
          onDeliveryArrived: handleDeliveryArrived,
          onNewHireSeated: handleNewHireSeated,
          onWarRoomSeatArrived: handleWarRoomSeatArrived,
          onQaBenchArrived: handleQaBenchArrived,
        }
      );

      // Sync HUD & live agent meters ~3x/sec
      uiSyncTimer += dt;
      if (uiSyncTimer >= 0.35) {
        uiSyncTimer = 0;
        syncUiSnapshot();
      }

      // 2. Smooth Camera Follow CEO
      const ceo = agentsRef.current.find((a) => a.id === 'ceo');
      const cam = cameraRef.current;
      if (cam.followCeo && ceo) {
        const targetX = (ceo.position.x + 0.5) * TILE_SIZE;
        const targetY = (ceo.position.y + 0.5) * TILE_SIZE;
        const lerp = 1 - Math.exp(-9 * Math.min(dt, 0.05));
        cam.x += (targetX - cam.x) * lerp;
        cam.y += (targetY - cam.y) * lerp;
      }

      // 3. Render Canvas
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const worldCanvas = staticWorldRef.current;

      if (canvas && container && worldCanvas) {
        const dpr = window.devicePixelRatio || 1;
        const rectW = container.clientWidth;
        const rectH = container.clientHeight;
        const targetW = Math.floor(rectW * dpr);
        const targetH = Math.floor(rectH * dpr);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = false;

          ctx.fillStyle = '#0B101B';
          ctx.fillRect(0, 0, rectW, rectH);

          ctx.save();
          ctx.translate(Math.round(rectW / 2), Math.round(rectH / 2));
          ctx.scale(cam.zoom, cam.zoom);
          ctx.translate(Math.round(-cam.x), Math.round(-cam.y));

          // Drop shadow under entire office building
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(10, 12, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

          // Static floor + walls
          ctx.drawImage(worldCanvas, 0, 0);

          // Room hover/selection tint & dashed hover frame
          for (const room of st.rooms) {
            const isSelected = room.id === st.selectedRoomId;
            const isHovered = room.id === st.hoveredRoomId;
            if (isSelected || isHovered) {
              const rx = room.bounds.x * TILE_SIZE;
              const ry = room.bounds.y * TILE_SIZE;
              const rw = room.bounds.w * TILE_SIZE;
              const rh = room.bounds.h * TILE_SIZE;
              ctx.fillStyle = isSelected ? `${room.accentColor}20` : `${room.accentColor}12`;
              ctx.fillRect(rx, ry, rw, rh);

              ctx.save();
              ctx.strokeStyle = isSelected ? room.accentColor : `${room.accentColor}CC`;
              ctx.lineWidth = isSelected ? 2.5 : 2;
              if (!isSelected && isHovered) {
                ctx.setLineDash([6, 4]);
              }
              ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
              ctx.restore();
            }
          }

          // A* Path Breadcrumbs & Animated Destination Marker
          const t = runtime.ambientTimer;
          if (runtime.ceoPath.length > 0) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.65)';
            for (const step of runtime.ceoPath) {
              ctx.fillRect(step.x * TILE_SIZE + 14, step.y * TILE_SIZE + 14, 4, 4);
            }
          }
          if (runtime.ceoTargetTile) {
            const tx = runtime.ceoTargetTile.x * TILE_SIZE;
            const ty = runtime.ceoTargetTile.y * TILE_SIZE;
            const pulse = Math.sin(t * 8) * 2.5;
            const arrowBounce = Math.round(Math.sin(t * 9) * 3);

            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2;
            ctx.strokeRect(
              Math.round(tx + 5 - pulse / 2),
              Math.round(ty + 5 - pulse / 2),
              Math.round(TILE_SIZE - 10 + pulse),
              Math.round(TILE_SIZE - 10 + pulse)
            );
            ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
            ctx.fillRect(tx + 6, ty + 6, TILE_SIZE - 12, TILE_SIZE - 12);

            const ax = tx + 16;
            const ay = ty - 6 + arrowBounce;
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(ax - 5, ay - 9, 10, 6);
            ctx.fillStyle = '#FBBF24';
            ctx.fillRect(ax - 3, ay - 8, 6, 4);
            ctx.fillRect(ax - 4, ay - 4, 8, 2);
            ctx.fillRect(ax - 2, ay - 2, 4, 2);
            ctx.fillRect(ax - 1, ay, 2, 2);
          }

          // Furniture & Animated Props
          const blinkTick = Math.floor(t * 3);

          for (const obj of sortedFurniture) {
            const sprite = getFurnitureSprite(obj);
            const ox = obj.anchor.x * TILE_SIZE;
            const oy = obj.anchor.y * TILE_SIZE;
            ctx.drawImage(sprite, ox, oy);

            if (obj.type === 'server-rack') {
              const seed = obj.anchor.x * 7 + obj.anchor.y * 13;
              const leds = ['#22C55E', '#38BDF8', '#F59E0B', '#22C55E'];
              for (let row = 0; row < 3; row++) {
                const on = (blinkTick + seed + row) % 3 !== 0;
                ctx.fillStyle = on ? leds[(seed + row) % leds.length] : '#0F172A';
                ctx.fillRect(ox + 10 + row * 4, oy + 8 + row * 6, 3, 2);
              }
            } else if (obj.type === 'mini-rack') {
              ctx.fillStyle = blinkTick % 2 === 0 ? '#4ADE80' : '#052E16';
              ctx.fillRect(ox + 16, oy + 10, 3, 2);
              ctx.fillStyle = blinkTick % 3 === 0 ? '#38BDF8' : '#082F49';
              ctx.fillRect(ox + 16, oy + 16, 3, 2);
            } else if (obj.type === 'ac-unit') {
              const drift = Math.floor((t * 14) % 10);
              ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
              ctx.fillRect(ox + 12, oy + 24 + drift, 4, 2);
              ctx.fillRect(ox + 34, oy + 22 + ((drift + 5) % 10), 4, 2);
            } else if (obj.type === 'espresso-counter') {
              const steamY = Math.floor((t * 8) % 8);
              ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
              ctx.fillRect(ox + 18, oy + 10 - steamY, 2, 2);
              ctx.fillRect(ox + 22, oy + 12 - ((steamY + 4) % 8), 2, 2);
            } else if (obj.type === 'arcade-cabinet') {
              const colors = ['#22D3EE', '#F472B6', '#FACC15', '#4ADE80'];
              ctx.fillStyle = colors[blinkTick % colors.length];
              ctx.fillRect(ox + 10 + (blinkTick % 4) * 2, oy + 12, 4, 4);
              ctx.fillStyle = colors[(blinkTick + 1) % colors.length];
              ctx.fillRect(ox + 18 - (blinkTick % 3) * 2, oy + 15, 3, 3);
            } else if (obj.type === 'ceo-console') {
              if (Math.floor(t * 2) % 2 === 0) {
                ctx.fillStyle = '#FEF08A';
                ctx.fillRect(ox + 10, oy + 12, 6, 2);
              }
            } else if (obj.type === 'qa-siren') {
              const mode = st.qaSirenMode !== 'off' ? st.qaSirenMode : st.qaSirenActive ? 'test' : 'off';
              if (mode !== 'off') {
                const flash = Math.floor(t * 8) % 2 === 0;
                const primaryColor =
                  mode === 'approved'
                    ? flash
                      ? '#22C55E'
                      : '#4ADE80'
                    : mode === 'warning'
                    ? flash
                      ? '#F59E0B'
                      : '#FACC15'
                    : flash
                    ? '#EF4444'
                    : '#F97316';
                const haloColor =
                  mode === 'approved'
                    ? flash
                      ? 'rgba(34, 197, 94, 0.34)'
                      : 'rgba(74, 222, 128, 0.18)'
                    : mode === 'warning'
                    ? flash
                      ? 'rgba(245, 158, 11, 0.34)'
                      : 'rgba(250, 204, 21, 0.18)'
                    : flash
                    ? 'rgba(239, 68, 68, 0.32)'
                    : 'rgba(249, 115, 22, 0.18)';
                ctx.fillStyle = primaryColor;
                ctx.fillRect(ox + 10, oy + 8, 12, 10);
                ctx.fillStyle = haloColor;
                ctx.fillRect(ox + 2, oy + 2, 28, 28);
              }
            }

            const isObjSelected = st.selectedObject?.id === obj.id;
            const isObjHovered = st.hoveredObject?.id === obj.id;
            if (isObjSelected || isObjHovered) {
              ctx.save();
              ctx.strokeStyle = isObjSelected ? '#F59E0B' : '#FEF08A';
              ctx.lineWidth = 2;
              if (!isObjSelected && isObjHovered) {
                ctx.setLineDash([4, 3]);
              }
              ctx.strokeRect(
                ox + 1,
                oy + 1,
                obj.widthTiles * TILE_SIZE - 2,
                obj.heightTiles * TILE_SIZE - 2
              );
              ctx.restore();
            }
          }

          // War Room Tactical Glow when convening / aligning contract
          if (st.warRoomActive) {
            const pulseAlpha = 0.18 + Math.sin(t * 6) * 0.08;
            ctx.fillStyle = `rgba(56, 189, 248, ${pulseAlpha.toFixed(2)})`;
            ctx.fillRect(24 * TILE_SIZE, 5 * TILE_SIZE, 6 * TILE_SIZE, 2 * TILE_SIZE);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(24 * TILE_SIZE + 2, 5 * TILE_SIZE + 2, 6 * TILE_SIZE - 4, 2 * TILE_SIZE - 4);
            // Projector screen illumination
            ctx.fillStyle = `rgba(14, 165, 233, ${(pulseAlpha + 0.12).toFixed(2)})`;
            ctx.fillRect(24 * TILE_SIZE + 8, 1 * TILE_SIZE + 6, 6 * TILE_SIZE - 16, 18);
          }

          // Diretoria Desk Outbox Tray & Unread Delivery Indicator (x=6, y=3)
          if (st.deliveredCount > 0) {
            const bx = 6 * TILE_SIZE + 8;
            const by = 3 * TILE_SIZE + 8;
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(bx, by, 16, 12);
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(bx + 2, by + 2, 12, 8);
            ctx.fillStyle = '#10B981';
            ctx.fillRect(bx + 4, by + 4, 8, 2);
            ctx.fillRect(bx + 4, by + 7, 5, 2);

            if (st.unreadCount > 0) {
              const pulseUp = Math.round(Math.sin(t * 7) * 2);
              const badgeX = 6 * TILE_SIZE + 16;
              const badgeY = 3 * TILE_SIZE - 4 + pulseUp;
              ctx.fillStyle = '#10B981';
              ctx.fillRect(badgeX - 11, badgeY - 12, 22, 12);
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 1;
              ctx.strokeRect(badgeX - 10.5, badgeY - 11.5, 21, 11);
              ctx.fillStyle = '#052E16';
              ctx.font = 'bold 8px Silkscreen, monospace';
              ctx.textAlign = 'center';
              ctx.fillText(`+${st.unreadCount}`, badgeX, badgeY - 3);
            }
          }

          // Vacant (+) markers on empty desks
          for (const room of st.rooms) {
            if (!vacantSlotRoomIds.has(room.id)) continue;
            for (const slot of room.deskSlots) {
              if (slot.occupiedByAgentId === null) {
                drawVacantSlotMarker(ctx, slot.seatTile);
              }
            }
          }

          // Monitor Glow & Code Sparkles on desks where an agent is actively executing a SubTask
          for (const agent of agentsRef.current) {
            if (
              !agent.activeSubTaskId ||
              (agent.state !== 'working' && agent.state !== 'corrigindo_qa')
            ) {
              continue;
            }
            const auto = runtime.autonomous[agent.id];
            if (!auto || auto.phase !== 'at_desk') continue;
            const agentRoom = st.rooms.find((r) => r.id === agent.departmentId);
            const slot = agentRoom?.deskSlots.find((s) => s.id === agent.assignedDeskId);
            if (!slot) continue;

            const dx = slot.deskTile.x * TILE_SIZE;
            const dy = slot.deskTile.y * TILE_SIZE;
            const glowAlpha = 0.28 + Math.sin(t * 8) * 0.14;
            ctx.fillStyle = `rgba(56, 189, 248, ${glowAlpha.toFixed(2)})`;
            ctx.fillRect(dx + 4, dy + 4, TILE_SIZE - 8, TILE_SIZE - 12);

            // Animated pixel sparkles rising from monitor
            for (let p = 0; p < 3; p++) {
              const rise = ((t * 18 + p * 7) % 16);
              const px = dx + 10 + p * 6 + Math.round(Math.sin(t * 5 + p) * 2);
              const py = dy + 12 - rise;
              ctx.fillStyle = p % 2 === 0 ? '#38BDF8' : '#34D399';
              ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
            }
          }

          // Render All Active Agents (Sorted by Y for 2.5D overlap)
          const sortedAgents = [...agentsRef.current].sort((a, b) => a.position.y - b.position.y);
          for (const agent of sortedAgents) {
            const ax = agent.position.x * TILE_SIZE;
            const ay = agent.position.y * TILE_SIZE;
            const isCeo = agent.id === 'ceo';
            const isAgentSelected = st.selectedAgentId === agent.id;
            const isAgentHovered = st.hoveredAgentId === agent.id;
            const badgeColor = agent.badgeColor ?? '#F59E0B';

            // Floor indicator ring
            if (isCeo || isAgentSelected || isAgentHovered) {
              ctx.strokeStyle = isAgentSelected
                ? '#F8FAFC'
                : isAgentHovered
                ? '#FEF08A'
                : `${badgeColor}CC`;
              ctx.lineWidth = isAgentSelected || isAgentHovered ? 2.5 : 1.5;
              ctx.strokeRect(ax + 5, ay + 18, TILE_SIZE - 10, 12);
            }

            let animFrame = 0;
            let isWalking = false;
            if (isCeo) {
              animFrame = runtime.walkFrame;
              isWalking = agent.state === 'walking';
            } else {
              const auto = runtime.autonomous[agent.id];
              if (auto) {
                animFrame = auto.walkFrame;
                isWalking =
                  auto.phase === 'going_to_target' ||
                  auto.phase === 'returning_home' ||
                  auto.phase === 'mission_walking';
              }
            }

            const sprite = getAvatarSprite(
              agent.spriteVariant,
              agent.direction,
              animFrame,
              isWalking
            );
            ctx.drawImage(sprite, Math.round(ax), Math.round(ay - 8));

            // Identifiable crachá / name tag above sprite
            ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
            const deptShort =
              agent.departmentId === 'backend'
                ? 'Back'
                : agent.departmentId === 'frontend'
                ? 'Front'
                : agent.departmentId === 'admin'
                ? 'Adm'
                : agent.departmentId === 'marketing'
                ? 'Mkt'
                : agent.departmentId === 'qa-lab'
                ? 'QA'
                : 'IA';
            const tag = isCeo
              ? 'Dono (CEO)'
              : agent.id === 'coord-team'
              ? 'Atlas · Eq.'
              : agent.id === 'coord-finance'
              ? 'Vega · FinOps'
              : `${agent.name} · ${deptShort}`;
            const tw = ctx.measureText(tag).width + 10;
            const tx = Math.round(ax + TILE_SIZE / 2 - tw / 2);
            const ty = Math.round(ay - 22);

            ctx.fillStyle = isAgentSelected ? badgeColor : 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(tx, ty, tw, 14);
            ctx.strokeStyle = isAgentSelected ? '#FFFFFF' : badgeColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 13);
            ctx.fillStyle = isAgentSelected ? '#0F172A' : '#F8FAFC';
            ctx.textAlign = 'center';
            ctx.fillText(tag, Math.round(ax + TILE_SIZE / 2), ty + 10);

            // Pulsing Yellow '!' Badge above Atlas when awaiting hiring approval
            if (
              agent.id === 'coord-team' &&
              (agent.state === 'aguardando_aprovacao' ||
                agent.state === 'indo_diretoria_alerta' ||
                st.pendingReqsCount > 0)
            ) {
              const bounce = Math.round(Math.sin(t * 9) * 3);
              const ex = Math.round(ax + TILE_SIZE / 2);
              const ey = ty - 18 + bounce;
              ctx.fillStyle = '#FACC15';
              ctx.fillRect(ex - 7, ey, 14, 15);
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(ex - 7, ey, 14, 15);
              ctx.fillStyle = '#0F172A';
              ctx.font = 'bold 11px Silkscreen, monospace';
              ctx.textAlign = 'center';
              ctx.fillText('!', ex, ey + 11);
            }

            // Red FinOps Pause Indicator if paused by budget
            if (agent.state === 'pausado_orcamento') {
              const px = Math.round(ax + TILE_SIZE / 2);
              const py = ty - 15;
              ctx.fillStyle = '#EF4444';
              ctx.fillRect(px - 14, py, 28, 12);
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 1;
              ctx.strokeRect(px - 14, py, 28, 12);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 8px Silkscreen, monospace';
              ctx.textAlign = 'center';
              ctx.fillText('PAUSA', px, py + 9);
            } else if (
              agent.state === 'em_reuniao' ||
              agent.state === 'homologando_qa' ||
              agent.state === 'corrigindo_qa'
            ) {
              const px = Math.round(ax + TILE_SIZE / 2);
              const py = ty - 14;
              const pillText =
                agent.state === 'em_reuniao'
                  ? 'WAR'
                  : agent.state === 'homologando_qa'
                  ? 'QA'
                  : 'FIX';
              ctx.fillStyle =
                agent.state === 'em_reuniao'
                  ? '#0284C7'
                  : agent.state === 'homologando_qa'
                  ? '#DC2626'
                  : '#D97706';
              ctx.fillRect(px - 12, py, 24, 11);
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 1;
              ctx.strokeRect(px - 12, py, 24, 11);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 8px Silkscreen, monospace';
              ctx.textAlign = 'center';
              ctx.fillText(pillText, px, py + 8);
            }
          }

          // Render Active 8-bit Speech Bubbles (on top of characters)
          for (const bubble of runtime.speechBubbles) {
            const speaker = agentsRef.current.find((a) => a.id === bubble.agentId);
            if (speaker) {
              drawSpeechBubble(ctx, speaker, bubble, t);
            }
          }

          // Room Sign Plaques on Top Layer
          for (const room of st.rooms) {
            drawRoomPlaque(
              ctx,
              room,
              room.id === st.selectedRoomId,
              room.id === st.hoverSignRoom || room.id === st.hoveredRoomId
            );
          }

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [
    agentsRef,
    simulationRuntimeRef,
    cameraRef,
    advanceClockMinute,
    syncUiSnapshot,
    addLocalSimLog,
    handleDeliveryArrived,
    handleNewHireSeated,
    handleWarRoomSeatArrived,
    handleQaBenchArrived,
  ]);

  const screenToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0, tx: -1, ty: -1, sx: 0, sy: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = cameraRef.current;
    const wx = (sx - rect.width / 2) / cam.zoom + cam.x;
    const wy = (sy - rect.height / 2) / cam.zoom + cam.y;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    return { wx, wy, tx, ty, sx, sy };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragStateRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: cameraRef.current.x,
      camStartY: cameraRef.current.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (drag.isDown) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
        setFollowCeo(false);
        setCursorTooltipPos(null);
      }
      if (drag.moved) {
        cameraRef.current.x = drag.camStartX - dx / cameraRef.current.zoom;
        cameraRef.current.y = drag.camStartY - dy / cameraRef.current.zoom;
        return;
      }
    }

    const { wx, wy, tx, ty, sx, sy } = screenToWorld(e.clientX, e.clientY);

    // 1. Check Agent Hover first
    const hitAgent = getAgentAtWorldPos(wx, wy, agentsRef.current);
    if (hitAgent) {
      setHoverSignRoom(null);
      setHoverTarget(null, null, hitAgent.id);
      setCursorTooltipPos({ x: sx, y: sy });
      return;
    }

    // 2. Check Sign Plaque & Furniture/Room Hover
    const signRoom = getSignAtWorldPos(wx, wy, rooms);
    setHoverSignRoom(signRoom ? signRoom.id : null);

    if (tx >= 0 && ty >= 0 && tx < MAP_COLS && ty < MAP_ROWS) {
      const obj = OFFICE_GRID.objectAtTile[ty][tx];
      const roomId = signRoom ? signRoom.id : OFFICE_GRID.roomAtTile[ty][tx];
      const activeObj = obj && obj.interactive ? obj : null;
      setHoverTarget(roomId, activeObj, null);
      if (roomId || activeObj) {
        setCursorTooltipPos({ x: sx, y: sy });
      } else {
        setCursorTooltipPos(null);
      }
    } else {
      setHoverTarget(null, null, null);
      setCursorTooltipPos(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    const wasClick = drag.isDown && !drag.moved;
    drag.isDown = false;

    if (!wasClick || e.button !== 0) return;

    const { wx, wy, tx, ty } = screenToWorld(e.clientX, e.clientY);

    // 1. Check if clicked an Agent Avatar (opens HiringModal if Atlas has '!' alert, else Ficha Técnica)
    const hitAgent = getAgentAtWorldPos(wx, wy, agentsRef.current);
    if (hitAgent) {
      if (
        hitAgent.id === 'coord-team' &&
        pendingRequisitions.length > 0 &&
        (hitAgent.state === 'aguardando_aprovacao' || hitAgent.state === 'indo_diretoria_alerta')
      ) {
        openHiringModal();
      } else {
        selectAgent(hitAgent.id);
      }
      return;
    }

    // 2. Check if clicked a Room Sign Plaque
    const signRoom = getSignAtWorldPos(wx, wy, rooms);
    if (signRoom) {
      selectRoom(signRoom.id, null);
      return;
    }

    if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return;

    // 3. Check if clicked an interactive furniture object
    const obj: InteractiveObject | null = OFFICE_GRID.objectAtTile[ty][tx];
    if (obj && obj.interactive) {
      selectRoom(obj.roomId, obj);
      if (obj.specialAction === 'ceo-console') {
        openBriefingModal('briefing');
      } else if (obj.id === 'dir-desk-h' && unreadDeliveriesCount > 0) {
        openBriefingModal('outbox');
      } else if (obj.id === 'dir-desk-h') {
        openBriefingModal('briefing');
      }
      return;
    }

    // 4. If clicked walkable floor tile -> A* Click-to-Move!
    const tile: TileCoord = { x: tx, y: ty };
    if (OFFICE_GRID.walkable[ty][tx]) {
      moveCeoToTile(tile);
    } else {
      const roomId = OFFICE_GRID.roomAtTile[ty][tx];
      if (roomId) {
        selectRoom(roomId, null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    adjustZoom(delta);
  };

  const hoveredRoom = rooms.find((r) => r.id === hoveredRoomId);
  const hoveredAgent = agentsRef.current.find((a) => a.id === hoveredAgentId);

  const containerW = containerRef.current?.clientWidth ?? 1200;
  const containerH = containerRef.current?.clientHeight ?? 800;
  const tooltipLeft = cursorTooltipPos
    ? Math.min(cursorTooltipPos.x + 14, containerW - 240)
    : 0;
  const tooltipTop = cursorTooltipPos
    ? Math.max(12, Math.min(cursorTooltipPos.y - 44, containerH - 72))
    : 0;

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden bg-[#0B101B]">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragStateRef.current.isDown = false;
          setHoverTarget(null, null, null);
          setHoverSignRoom(null);
          setCursorTooltipPos(null);
        }}
        onWheel={handleWheel}
        className={`pixel-canvas block w-full h-full ${
          dragStateRef.current.moved
            ? 'cursor-grabbing'
            : hoveredAgent || hoveredObject || hoverSignRoom
            ? 'cursor-pointer'
            : 'cursor-crosshair'
        }`}
      />

      {/* Compact Cursor-Adjacent Tooltip on Hover */}
      {(hoveredAgent || hoveredRoom || hoveredObject) && cursorTooltipPos && (
        <div
          style={{ transform: `translate3d(${tooltipLeft}px, ${tooltipTop}px, 0)` }}
          className="pointer-events-none absolute top-0 left-0 z-20 max-w-[235px] bg-[#0F172A]/95 border border-slate-600 px-2.5 py-1.5 pixel-panel"
        >
          {hoveredAgent ? (
            <>
              <div className="font-pixel text-[10px] text-white truncate">
                {hoveredAgent.name}
              </div>
              <div className="text-[11px] text-amber-300 truncate mt-0.5">
                {hoveredAgent.role} · Clique p/ Ficha
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-[10px] text-white truncate">
                  {hoveredObject ? hoveredObject.label : hoveredRoom?.shortName}
                </span>
                {hoveredRoom && hoveredRoom.capacity > 0 && (
                  <span className="font-mono text-[10px] tabular-nums text-slate-400 shrink-0">
                    {hoveredRoom.deskSlots.filter((s) => s.occupiedByAgentId).length}/
                    {hoveredRoom.capacity}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                {hoveredObject
                  ? `${hoveredRoom?.shortName ?? ''} · Clique para abrir`
                  : 'Clique no piso para andar'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
