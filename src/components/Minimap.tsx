import React, { useEffect, useRef } from 'react';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../data/officeLayout';
import { useOffice } from '../context/OfficeContext';

const SCALE = 3.5; // 54 * 3.5 = 189px wide, 38 * 3.5 = 133px tall
const MINI_W = Math.round(MAP_COLS * SCALE);
const MINI_H = Math.round(MAP_ROWS * SCALE);

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { rooms, agentsRef, cameraRef, selectedRoomId, focusRoom, setFollowCeo } = useOffice();

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

            ctx.fillStyle = room.id === selectedRoomId ? room.accentColor : `${room.accentColor}44`;
            ctx.fillRect(rx, ry, rw, rh);

            ctx.strokeStyle = room.id === selectedRoomId ? '#F8FAFC' : `${room.accentColor}AA`;
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
          }

          // Draw camera viewport box
          const cam = cameraRef.current;
          const viewW = (window.innerWidth / cam.zoom / TILE_SIZE) * SCALE;
          const viewH = ((window.innerHeight - 56) / cam.zoom / TILE_SIZE) * SCALE;
          const vx = (cam.x / TILE_SIZE) * SCALE - viewW / 2;
          const vy = (cam.y / TILE_SIZE) * SCALE - viewH / 2;

          ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
          ctx.lineWidth = 1;
          ctx.strokeRect(vx, vy, viewW, viewH);

          // Draw CEO position dot
          const ceo = agentsRef.current.find((a) => a.id === 'ceo');
          if (ceo) {
            const cx = (ceo.position.x + 0.5) * SCALE;
            const cy = (ceo.position.y + 0.5) * SCALE;
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(cx - 3, cy - 3, 6, 6);
            ctx.fillStyle = '#F59E0B';
            ctx.fillRect(cx - 2, cy - 2, 4, 4);
          }
        }
      }
      rafId = requestAnimationFrame(renderMini);
    };

    rafId = requestAnimationFrame(renderMini);
    return () => cancelAnimationFrame(rafId);
  }, [rooms, agentsRef, cameraRef, selectedRoomId]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const tileX = mx / SCALE;
    const tileY = my / SCALE;

    // Check if user clicked inside a specific room
    const clickedRoom = rooms.find(
      (r) =>
        tileX >= r.bounds.x &&
        tileX < r.bounds.x + r.bounds.w &&
        tileY >= r.bounds.y &&
        tileY < r.bounds.y + r.bounds.h
    );

    if (clickedRoom) {
      focusRoom(clickedRoom.id);
    } else {
      setFollowCeo(false);
      cameraRef.current.x = tileX * TILE_SIZE;
      cameraRef.current.y = tileY * TILE_SIZE;
    }
  };

  return (
    <div className="bg-[#0F172A]/95 border-2 border-slate-700/90 p-2 pixel-panel select-none">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="font-pixel text-[10px] text-slate-300 tracking-wide">PLANTA BAIXA</span>
        <span className="font-mono text-[10px] text-slate-400 tabular-nums">54×38</span>
      </div>
      <canvas
        ref={canvasRef}
        width={MINI_W}
        height={MINI_H}
        onClick={handleMinimapClick}
        className="pixel-canvas block border border-slate-700 cursor-pointer"
        title="Clique em uma sala no minimapa para focar a câmera"
      />
    </div>
  );
};
