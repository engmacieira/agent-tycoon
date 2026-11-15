import React from 'react';
import { Clock, Coins, Compass, Pause, Play, ShieldCheck, Users } from 'lucide-react';
import { useOffice } from '../context/OfficeContext';

function formatClockTime(minutesOfDay: number): { timeStr: string; shiftLabel: string } {
  const hours = Math.floor(minutesOfDay / 60) % 24;
  const mins = minutesOfDay % 60;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  let shiftLabel = 'Turno Noturno';
  if (hours >= 6 && hours < 12) shiftLabel = 'Turno Manhã';
  else if (hours >= 12 && hours < 18) shiftLabel = 'Turno Tarde';
  else if (hours >= 18 && hours < 22) shiftLabel = 'Turno Noite';

  return { timeStr, shiftLabel };
}

export const TopHud: React.FC = () => {
  const {
    clock,
    toggleClockPause,
    agents,
    totalTokensUsed,
    totalCostUsd,
    ceoCurrentRoomId,
    rooms,
    followCeo,
    centerOnCeo,
    selectRoom,
  } = useOffice();

  const { timeStr, shiftLabel } = formatClockTime(clock.minutesOfDay);
  const currentRoom = rooms.find((r) => r.id === ceoCurrentRoomId);

  return (
    <header className="h-14 w-full bg-[#0F172A]/95 border-b-2 border-slate-700/80 px-4 lg:px-6 flex items-center justify-between gap-4 z-30 select-none shrink-0">
      {/* Zone 1: Brand Wordmark & Shift Clock */}
      <div className="flex items-center gap-5 shrink-0">
        <button
          type="button"
          onClick={() => selectRoom('diretoria')}
          className="font-pixel text-sm lg:text-base tracking-tight text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap cursor-pointer"
          title="Abrir Sala da Diretoria"
        >
          PIXELHQ 8-BITS
        </button>

        <div className="h-5 w-px bg-slate-700 hidden sm:block" aria-hidden="true" />

        <div className="flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-mono font-semibold tabular-nums text-slate-100">{timeStr}</span>
          <span className="text-slate-500 hidden md:inline" aria-hidden="true">·</span>
          <span className="text-slate-400 hidden md:inline">Dia {clock.dayCount}</span>
          <span className="text-slate-500 hidden lg:inline" aria-hidden="true">·</span>
          <span className="text-slate-300 hidden lg:inline">{shiftLabel}</span>
          <button
            type="button"
            onClick={toggleClockPause}
            className="ml-1 p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title={clock.isPaused ? 'Retomar relógio do escritório' : 'Pausar relógio do escritório'}
            aria-label={clock.isPaused ? 'Retomar relógio' : 'Pausar relógio'}
          >
            {clock.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Zone 2: Clean Unboxed Tycoon Metrics */}
      <div className="hidden md:flex items-center gap-6 text-xs text-slate-300 whitespace-nowrap overflow-hidden">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-mono tabular-nums text-slate-100 font-semibold">{agents.length} ativo</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-400">Apenas CEO</span>
        </div>

        <div className="h-4 w-px bg-slate-800" aria-hidden="true" />

        <div className="flex items-center gap-2">
          <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-mono tabular-nums text-slate-100 font-semibold">
            {totalTokensUsed.toLocaleString('pt-BR')} tokens
          </span>
          <span className="text-slate-500" aria-hidden="true">/</span>
          <span className="font-mono tabular-nums text-emerald-400 font-semibold">
            ${totalCostUsd.toFixed(2)}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden xl:block" aria-hidden="true" />

        <div className="hidden xl:flex items-center gap-2 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>Modo Simulação</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-slate-300">0 Tokens</span>
        </div>
      </div>

      {/* Zone 3: CEO Location & Center Action */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:inline text-xs text-slate-400 whitespace-nowrap truncate max-w-[160px]">
          {currentRoom ? currentRoom.shortName : 'Corredor Principal'}
        </span>

        <button
          type="button"
          onClick={centerOnCeo}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
            followCeo
              ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 hover:bg-amber-500/25'
              : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
          }`}
          title="Centralizar câmera no CEO (Tecla C)"
        >
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span>{followCeo ? 'Seguindo CEO' : 'Centralizar CEO'}</span>
        </button>
      </div>
    </header>
  );
};
