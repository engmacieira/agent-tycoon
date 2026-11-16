import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Minus, Plus, User } from 'lucide-react';
import { useOffice } from '../context/OfficeContext';
import { WingId } from '../types/office';

const WINGS: Array<'Todas' | WingId> = ['Todas', 'Norte', 'Central', 'Sul'];

export const RoomQuickBar: React.FC = () => {
  const {
    rooms,
    selectedRoomId,
    ceoCurrentRoomId,
    focusRoom,
    zoomDisplay,
    adjustZoom,
  } = useOffice();
  const [wingFilter, setWingFilter] = useState<'Todas' | WingId>('Todas');
  const [expanded, setExpanded] = useState<boolean>(true);

  const visibleRooms = wingFilter === 'Todas' ? rooms : rooms.filter((r) => r.wing === wingFilter);

  return (
    <div className="flex flex-col gap-1.5 min-w-0 max-w-full select-none">
      {/* Row 1: Zoom Controls + Wing Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center bg-[#0F172A]/95 border-2 border-slate-700/90 pixel-panel shrink-0">
          <button
            type="button"
            onClick={() => adjustZoom(-0.2)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Diminuir zoom (-)"
            aria-label="Diminuir zoom"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-mono text-xs text-slate-200 tabular-nums border-x border-slate-700/80">
            {Math.round(zoomDisplay * 100)}%
          </span>
          <button
            type="button"
            onClick={() => adjustZoom(0.2)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Aumentar zoom (+)"
            aria-label="Aumentar zoom"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center bg-[#0F172A]/95 border-2 border-slate-700/90 pixel-panel shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Salas ({rooms.length})</span>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {expanded && (
            <div className="hidden md:flex items-center border-l border-slate-700/80 px-1 gap-0.5">
              {WINGS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWingFilter(w)}
                  className={`px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    wingFilter === w
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                  }`}
                >
                  {w === 'Todas' ? 'Todas' : `Ala ${w}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Compact Horizontal Smooth-Scroll Room Strip */}
      {expanded && (
        <div className="bg-[#0F172A]/95 border-2 border-slate-700/90 p-1.5 pixel-panel overflow-x-auto custom-scroll">
          <div className="flex items-center gap-1 w-max">
            {visibleRooms.map((room) => {
              const isSelected = selectedRoomId === room.id;
              const isCeoHere = ceoCurrentRoomId === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => focusRoom(room.id)}
                  title={
                    isCeoHere
                      ? `${room.name} (Dono está aqui)`
                      : `${room.name} — Ala ${room.wing}`
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 text-white border-sky-400'
                      : isCeoHere
                      ? 'bg-amber-500/15 text-amber-200 border-amber-500/70 hover:bg-amber-500/25'
                      : 'bg-slate-900/80 text-slate-300 border-slate-700/70 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {isCeoHere && <User className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span>{room.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
