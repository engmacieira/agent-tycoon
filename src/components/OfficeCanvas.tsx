import React, { useEffect, useRef, useState } from 'react';
import {
  FURNITURE_OBJECTS,
  MAP_COLS,
  MAP_ROWS,
  OFFICE_GRID,
  TILE_SIZE,
} from '../data/officeLayout';
import { getCeoAvatarSprite } from '../engine/avatarSprites';
import { getFloorSprite, getFurnitureSprite, getWallSprite } from '../engine/pixelArt';
import { InputKeysState, stepSimulation } from '../engine/simulationEngine';
import { useOffice } from '../context/OfficeContext';
import { InteractiveObject, RoomConfig, RoomId, TileCoord } from '../types/office';

function buildStaticWorldCanvas(): HTMLCanvasElement {
  const w = MAP_COLS * TILE_SIZE;
  const h = MAP_ROWS * TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // 1. Draw all floor tiles
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const floorSprite = getFloorSprite(OFFICE_GRID.floors[y][x]);
      ctx.drawImage(floorSprite, x * TILE_SIZE, y * TILE_SIZE);
    }
  }

  // 2. Subtle doorway threshold strips & Main Building Entrance Mat
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

  // 3. Draw all walls
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

  // Drop shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
  ctx.fillRect(bx + 2, by + 2, boxW, boxH);

  // Plaque body
  ctx.fillStyle = isSelected ? '#F59E0B' : isHovered ? '#1E293B' : '#0F172A';
  ctx.fillRect(bx, by, boxW, boxH);

  // Crisp pixel border
  ctx.strokeStyle = isSelected ? '#FEF3C7' : isHovered ? '#F8FAFC' : room.accentColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

  // Text
  ctx.fillStyle = isSelected ? '#0F172A' : '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(cx), Math.round(cy) + 1);
  ctx.textBaseline = 'alphabetic';
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
    hoveredRoomId,
    hoveredObject,
    qaSirenActive,
    clock,
    selectRoom,
    setHoverTarget,
    moveCeoToTile,
    centerOnCeo,
    adjustZoom,
    setFollowCeo,
    advanceClockMinute,
    syncCeoRoomIndicator,
  } = useOffice();

  const [hoverSignRoom, setHoverSignRoom] = useState<RoomId | null>(null);

  // Keep latest state accessible to RAF loop without restarting RAF
  const stateRef = useRef({
    selectedRoomId,
    selectedObject,
    hoveredRoomId,
    hoveredObject,
    qaSirenActive,
    clockPaused: clock.isPaused,
    hoverSignRoom,
  });
  stateRef.current = {
    selectedRoomId,
    selectedObject,
    hoveredRoomId,
    hoveredObject,
    qaSirenActive,
    clockPaused: clock.isPaused,
    hoverSignRoom,
  };

  // Pre-build static world canvas once
  useEffect(() => {
    staticWorldRef.current = buildStaticWorldCanvas();
  }, []);

  // Keyboard Listeners (WASD / Arrows / C / + / - / Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
    let roomSyncTimer = 0;

    const sortedFurniture = [...FURNITURE_OBJECTS].sort((a, b) => a.anchor.y - b.anchor.y);

    const frame = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const runtime = simulationRuntimeRef.current;
      const st = stateRef.current;

      // 1. Step 60 FPS Simulation
      stepSimulation(
        dt,
        agentsRef.current,
        keysRef.current,
        runtime,
        st.clockPaused,
        advanceClockMinute
      );

      // Sync HUD current room indicator every ~200ms
      roomSyncTimer += dt;
      if (roomSyncTimer >= 0.2) {
        roomSyncTimer = 0;
        syncCeoRoomIndicator();
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

          // Clear backdrop
          ctx.fillStyle = '#0B101B';
          ctx.fillRect(0, 0, rectW, rectH);

          ctx.save();
          // Apply camera transform
          ctx.translate(Math.round(rectW / 2), Math.round(rectH / 2));
          ctx.scale(cam.zoom, cam.zoom);
          ctx.translate(Math.round(-cam.x), Math.round(-cam.y));

          // Drop shadow under entire office building
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(10, 12, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

          // Draw static world (floors + walls)
          ctx.drawImage(worldCanvas, 0, 0);

          // Highlight hovered or selected room floor tint
          for (const room of rooms) {
            const isSelected = room.id === st.selectedRoomId;
            const isHovered = room.id === st.hoveredRoomId;
            if (isSelected || isHovered) {
              const rx = room.bounds.x * TILE_SIZE;
              const ry = room.bounds.y * TILE_SIZE;
              const rw = room.bounds.w * TILE_SIZE;
              const rh = room.bounds.h * TILE_SIZE;
              ctx.fillStyle = isSelected ? `${room.accentColor}24` : `${room.accentColor}14`;
              ctx.fillRect(rx, ry, rw, rh);
              ctx.strokeStyle = isSelected ? room.accentColor : `${room.accentColor}88`;
              ctx.lineWidth = 2;
              ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
            }
          }

          // Draw A* Path Breadcrumbs & Target Tile
          if (runtime.ceoPath.length > 0) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
            for (const step of runtime.ceoPath) {
              ctx.fillRect(step.x * TILE_SIZE + 13, step.y * TILE_SIZE + 13, 6, 6);
            }
          }
          if (runtime.ceoTargetTile) {
            const tx = runtime.ceoTargetTile.x * TILE_SIZE;
            const ty = runtime.ceoTargetTile.y * TILE_SIZE;
            const pulse = Math.sin(runtime.ambientTimer * 7) * 2;
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2;
            ctx.strokeRect(tx + 4 - pulse / 2, ty + 4 - pulse / 2, TILE_SIZE - 8 + pulse, TILE_SIZE - 8 + pulse);
          }

          // Draw Furniture & Animated Props
          const t = runtime.ambientTimer;
          const blinkTick = Math.floor(t * 3);

          for (const obj of sortedFurniture) {
            const sprite = getFurnitureSprite(obj);
            const ox = obj.anchor.x * TILE_SIZE;
            const oy = obj.anchor.y * TILE_SIZE;
            ctx.drawImage(sprite, ox, oy);

            // Animated overlays per object type
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
              // Cool breeze pixels
              const drift = Math.floor((t * 14) % 10);
              ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
              ctx.fillRect(ox + 12, oy + 24 + drift, 4, 2);
              ctx.fillRect(ox + 34, oy + 22 + ((drift + 5) % 10), 4, 2);
            } else if (obj.type === 'espresso-counter') {
              // Tiny rising steam pixels
              const steamY = Math.floor((t * 8) % 8);
              ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
              ctx.fillRect(ox + 18, oy + 10 - steamY, 2, 2);
              ctx.fillRect(ox + 22, oy + 12 - ((steamY + 4) % 8), 2, 2);
            } else if (obj.type === 'arcade-cabinet') {
              // Animated arcade pixel screen
              const colors = ['#22D3EE', '#F472B6', '#FACC15', '#4ADE80'];
              ctx.fillStyle = colors[blinkTick % colors.length];
              ctx.fillRect(ox + 10 + (blinkTick % 4) * 2, oy + 12, 4, 4);
              ctx.fillStyle = colors[(blinkTick + 1) % colors.length];
              ctx.fillRect(ox + 18 - (blinkTick % 3) * 2, oy + 15, 3, 3);
            } else if (obj.type === 'ceo-console') {
              // Subtle amber pulse on CEO Console de Ordens
              if (Math.floor(t * 2) % 2 === 0) {
                ctx.fillStyle = '#FEF08A';
                ctx.fillRect(ox + 10, oy + 12, 6, 2);
              }
            } else if (obj.type === 'qa-siren') {
              if (st.qaSirenActive) {
                const flash = Math.floor(t * 8) % 2 === 0;
                ctx.fillStyle = flash ? '#EF4444' : '#F97316';
                ctx.fillRect(ox + 10, oy + 8, 12, 10);
                ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.32)' : 'rgba(249, 115, 22, 0.18)';
                ctx.fillRect(ox + 2, oy + 2, 28, 28);
              }
            }

            // Highlight hovered or selected interactive object
            const isObjSelected = st.selectedObject?.id === obj.id;
            const isObjHovered = st.hoveredObject?.id === obj.id;
            if (isObjSelected || isObjHovered) {
              ctx.strokeStyle = isObjSelected ? '#F59E0B' : '#F8FAFC';
              ctx.lineWidth = 2;
              ctx.strokeRect(
                ox + 1,
                oy + 1,
                obj.widthTiles * TILE_SIZE - 2,
                obj.heightTiles * TILE_SIZE - 2
              );
            }
          }

          // Draw CEO Avatar
          if (ceo) {
            const ax = ceo.position.x * TILE_SIZE;
            const ay = ceo.position.y * TILE_SIZE;

            // Player indicator ring on floor
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
            ctx.lineWidth = 2;
            ctx.strokeRect(ax + 5, ay + 18, TILE_SIZE - 10, 12);

            const sprite = getCeoAvatarSprite(
              ceo.direction,
              runtime.walkFrame,
              ceo.state === 'walking'
            );
            // Draw 32x40 sprite slightly offset up so feet align inside tile
            ctx.drawImage(sprite, Math.round(ax), Math.round(ay - 8));

            // Crisp floating name tag
            ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
            const tag = 'Dono (CEO)';
            const tw = ctx.measureText(tag).width + 10;
            const tx = Math.round(ax + TILE_SIZE / 2 - tw / 2);
            const ty = Math.round(ay - 22);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            ctx.fillRect(tx, ty, tw, 14);
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 13);
            ctx.fillStyle = '#FEF3C7';
            ctx.textAlign = 'center';
            ctx.fillText(tag, Math.round(ax + TILE_SIZE / 2), ty + 10);
          }

          // Draw Room Sign Plaques on Top Layer
          for (const room of rooms) {
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
  }, [rooms, agentsRef, simulationRuntimeRef, cameraRef, advanceClockMinute, syncCeoRoomIndicator]);

  // Convert mouse event clientX/Y into world coordinates & tile coordinates
  const screenToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0, tx: -1, ty: -1 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = cameraRef.current;
    const wx = (sx - rect.width / 2) / cam.zoom + cam.x;
    const wy = (sy - rect.height / 2) / cam.zoom + cam.y;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    return { wx, wy, tx, ty };
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
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        setFollowCeo(false);
      }
      if (drag.moved) {
        cameraRef.current.x = drag.camStartX - dx / cameraRef.current.zoom;
        cameraRef.current.y = drag.camStartY - dy / cameraRef.current.zoom;
        return;
      }
    }

    // Hover detection
    const { wx, wy, tx, ty } = screenToWorld(e.clientX, e.clientY);
    const signRoom = getSignAtWorldPos(wx, wy, rooms);
    setHoverSignRoom(signRoom ? signRoom.id : null);

    if (tx >= 0 && ty >= 0 && tx < MAP_COLS && ty < MAP_ROWS) {
      const obj = OFFICE_GRID.objectAtTile[ty][tx];
      const roomId = signRoom ? signRoom.id : OFFICE_GRID.roomAtTile[ty][tx];
      setHoverTarget(roomId, obj && obj.interactive ? obj : null);
    } else {
      setHoverTarget(null, null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    const wasClick = drag.isDown && !drag.moved;
    drag.isDown = false;

    if (!wasClick || e.button !== 0) return;

    const { wx, wy, tx, ty } = screenToWorld(e.clientX, e.clientY);

    // 1. Check if clicked a Room Sign Plaque
    const signRoom = getSignAtWorldPos(wx, wy, rooms);
    if (signRoom) {
      selectRoom(signRoom.id, null);
      return;
    }

    if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return;

    // 2. Check if clicked an interactive furniture object
    const obj: InteractiveObject | null = OFFICE_GRID.objectAtTile[ty][tx];
    if (obj && obj.interactive) {
      selectRoom(obj.roomId, obj);
      return;
    }

    // 3. If clicked walkable floor tile -> A* Click-to-Move!
    const tile: TileCoord = { x: tx, y: ty };
    if (OFFICE_GRID.walkable[ty][tx]) {
      moveCeoToTile(tile);
    } else {
      // If clicked non-interactive wall or solid prop inside a room, inspect that room
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

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden bg-[#0B101B]">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragStateRef.current.isDown = false;
          setHoverTarget(null, null);
          setHoverSignRoom(null);
        }}
        onWheel={handleWheel}
        className={`pixel-canvas block w-full h-full ${
          hoveredObject || hoverSignRoom ? 'cursor-pointer' : 'cursor-crosshair'
        }`}
      />

      {/* Compact Floating Hover Inspector (Top-Left, non-blocking) */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5 max-w-xs z-10">
        {hoveredRoom && (
          <div className="bg-[#0F172A]/92 border-2 border-slate-700 px-3 py-2 pixel-panel">
            <div className="flex items-center justify-between gap-3">
              <span className="font-pixel text-xs text-white truncate">{hoveredRoom.shortName}</span>
              <span className="font-mono text-[11px] tabular-nums text-slate-300 shrink-0">
                {hoveredRoom.capacity > 0
                  ? `${hoveredRoom.deskSlots.filter((s) => s.occupiedByAgentId).length}/${hoveredRoom.capacity} ocupadas`
                  : `Ala ${hoveredRoom.wing}`}
              </span>
            </div>
            {hoveredObject ? (
              <div className="text-[11px] text-amber-300 mt-1 truncate">
                Clique para inspecionar: {hoveredObject.label}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 mt-1">
                Clique no piso para andar · Clique na placa para abrir
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtle Controls Legend (Top-Right when drawer is closed) */}
      {!selectedRoomId && (
        <div className="pointer-events-none hidden lg:flex absolute top-3 right-3 bg-[#0F172A]/88 border border-slate-700/80 px-3 py-1.5 text-[11px] text-slate-300 items-center gap-3 z-10">
          <span>WASD / Setas: Mover CEO</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>Clique piso: A* Auto</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>Arrastar: Câmera</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>Clique móveis/placas: Inspecionar</span>
        </div>
      )}
    </div>
  );
};
