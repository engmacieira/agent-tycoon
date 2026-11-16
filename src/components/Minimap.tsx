import React, { useEffect, useRef, useState } from 'react';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../data/officeLayout';
import { useOffice } from '../context/OfficeContext';

const SCALE = 3.2; // 54 * 3.2 = 173px wide, 38 * 3.2 = 122px tall
const MINI_W = Math.round(MAP_COLS * SCALE);
const MINI_H = Math.round(MAP_ROWS * SCALE);

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const { rooms, agentsRef, cameraRef, selectedRoomId, ceoCurrentRoomId, setFollowCeo } =
    useOffice();

  useEffect(() => {
    let rafId = 0;

    const renderMini = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;

          // Background (corridors)
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(0, 0, MINI_W, MINI_H);

          // Draw rooms
          for (const room of rooms) {
            const rx = room.bounds.x * SCALE;
            const ry = room.bounds.y * SCALE;
            const rw = room.bounds.w * SCALE;
            const rh = room.bounds.h * SCALE;

            const isSelected = room.id === selectedRoomId;
            const isCeoHere = room.id === ceoCurrentRoomId;

            ctx.fillStyle = isSelected
              ? `${room.accentColor}88`
              : isCeoHere
              ? `${room.accentColor}55`
              : `${room.accentColor}33`;
            ctx.fillRect(rx, ry, rw, rh);

            ctx.strokeStyle = isSelected
              ? '#F8FAFC'
              : isCeoHere
              ? '#F59E0B'
              : `${room.accentColor}AA`;
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
          }

          // Draw camera viewport rectangle
          const cam = cameraRef.current;
          const viewW = (window.innerWidth / cam.zoom / TILE_SIZE) * SCALE;
          const viewH = ((window.innerHeight - 56) / cam.zoom / TILE_SIZE) * SCALE;
          const vx = (cam.x / TILE_SIZE) * SCALE - viewW / 2;
          const vy = (cam.y / TILE_SIZE) * SCALE - viewH / 2;

          ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
          ctx.lineWidth = 1;
          ctx.strokeRect(vx, vy, viewW, viewH);

          // Draw all active agents (Dono, Atlas, Vega)
          for (const agent of agentsRef.current) {
            const ax = (agent.position.x + 0.5) * SCALE;
            const ay = (agent.position.y + 0.5) * SCALE;
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(ax - 3, ay - 3, 6, 6);
            ctx.fillStyle = agent.badgeColor ?? '#F59E0B';
            ctx.fillRect(ax - 2, ay - 2, 4, 4);
          }
        }
      }
      rafId = requestAnimationFrame(renderMini);
    };

    rafId = requestAnimationFrame(renderMini);
    return () => cancelAnimationFrame(rafId);
  }, [rooms, agentsRef, cameraRef, selectedRoomId, ceoCurrentRoomId]);

  const jumpCameraToMinimapPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = Math.max(0, Math.min(MINI_W, clientX - rect.left));
    const my = Math.max(0, Math.min(MINI_H, clientY - rect.top));
    const tileX = mx / SCALE;
    const tileY = my / SCALE;

    setFollowCeo(false);
    cameraRef.current.x = tileX * TILE_SIZE;
    cameraRef.current.y = tileY * TILE_SIZE;
  };

  return (
    <div className="bg-[#0F172A]/95 border-2 border-slate-700/90 p-2 pixel-panel select-none">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="font-pixel text-[10px] text-slate-200 tracking-wide">MAPA GERAL</span>
        <span className="font-mono text-[10px] text-slate-400">Clique p/ mover</span>
      </div>
      <canvas
        ref={canvasRef}
        width={MINI_W}
        height={MINI_H}
        onPointerDown={(e) => {
          setIsScrubbing(true);
          jumpCameraToMinimapPos(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (isScrubbing) jumpCameraToMinimapPos(e.clientX, e.clientY);
        }}
        onPointerUp={() => setIsScrubbing(false)}
        onPointerLeave={() => setIsScrubbing(false)}
        className="pixel-canvas block border border-slate-700 cursor-pointer"
        title="Clique ou arraste no minimapa para centralizar a câmera instantaneamente"
      />
    </div>
  );
};
