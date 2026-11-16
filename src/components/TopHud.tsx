import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Coins,
  Compass,
  HelpCircle,
  Inbox,
  Pause,
  Play,
  PlusSquare,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
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

function formatUsdCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

const SHORTCUT_ITEMS = [
  { keys: 'WASD / Setas', desc: 'Mover avatar do Dono' },
  { keys: 'Clique', desc: 'Andar (piso) / Inspecionar (agente ou móvel)' },
  { keys: 'Arrastar', desc: 'Mover câmera (Modo Livre)' },
  { keys: 'Scroll / + -', desc: 'Aproximar ou afastar zoom' },
  { keys: 'Espaço', desc: 'Centralizar câmera no Dono' },
  { keys: 'ESC', desc: 'Fechar painel lateral ou modal' },
];

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
    focusAgent,
    pendingRequisitions,
    deliveredArtifacts,
    unreadDeliveriesCount,
    openBriefingModal,
    openHiringModal,
  } = useOffice();

  const [helpOpen, setHelpOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement | null>(null);
  const teamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) {
        setTeamOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelpOpen(false);
        setTeamOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const { timeStr, shiftLabel } = formatClockTime(clock.minutesOfDay);
  const currentRoom = rooms.find((r) => r.id === ceoCurrentRoomId);
  const activeIaCount = agents.filter((a) => a.id !== 'ceo').length;

  return (
    <header className="h-14 w-full bg-[#0F172A]/95 border-b-2 border-slate-700/80 px-3 lg:px-5 flex items-center justify-between gap-3 z-30 select-none shrink-0 relative">
      {/* Zone 1: Brand Wordmark & Shift Clock */}
      <div className="flex items-center gap-3 lg:gap-4 shrink-0">
        <button
          type="button"
          onClick={() => selectRoom('diretoria')}
          className="font-pixel text-sm lg:text-base tracking-tight text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap cursor-pointer"
          title="Abrir Sala da Diretoria"
        >
          PIXELHQ 8-BITS
        </button>

        <div className="h-5 w-px bg-slate-700 hidden sm:block" aria-hidden="true" />

        <div className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-mono font-semibold tabular-nums text-slate-100">{timeStr}</span>
          <span className="text-slate-500 hidden md:inline" aria-hidden="true">·</span>
          <span className="text-slate-400 hidden md:inline">Dia {clock.dayCount}</span>
          <span className="text-slate-500 hidden xl:inline" aria-hidden="true">·</span>
          <span className="text-slate-300 hidden xl:inline">{shiftLabel}</span>
          <button
            type="button"
            onClick={toggleClockPause}
            className="ml-0.5 p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title={clock.isPaused ? 'Retomar relógio do escritório' : 'Pausar relógio do escritório'}
            aria-label={clock.isPaused ? 'Retomar relógio' : 'Pausar relógio'}
          >
            {clock.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Zone 2: Live Team Roster, FinOps Token/Cost Counter & Mode */}
      <div className="hidden lg:flex items-center gap-4 text-xs text-slate-300 whitespace-nowrap">
        <div className="relative" ref={teamRef}>
          <button
            type="button"
            onClick={() => setTeamOpen((v) => !v)}
            className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            title="Ver e focar equipe ativa"
          >
            <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono tabular-nums text-slate-100 font-semibold">
              {agents.length} ativos
            </span>
            <span className="text-slate-500 hidden xl:inline" aria-hidden="true">·</span>
            <span className="text-slate-300 hidden xl:inline">CEO + {activeIaCount} IA</span>
          </button>

          {teamOpen && (
            <div className="absolute left-0 top-9 w-72 bg-[#0F172A] border-2 border-slate-600 p-2.5 pixel-panel z-50">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                <span className="font-pixel text-[10px] text-amber-400">
                  Equipe Ativa ({agents.length})
                </span>
                <button
                  type="button"
                  onClick={() => setTeamOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Fechar lista de equipe"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto custom-scroll divide-y divide-slate-800">
                {agents.map((ag) => (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => {
                      focusAgent(ag.id);
                      setTeamOpen(false);
                    }}
                    className="w-full py-2 px-1.5 flex items-center justify-between gap-2 text-left hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{ag.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{ag.role}</div>
                    </div>
                    <span className="font-mono text-[10px] text-sky-400 shrink-0">Focar</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-800" aria-hidden="true" />

        <div
          className="flex items-center gap-1.5"
          title="Consumo real acumulado da sessão (Vega FinOps)"
        >
          <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-mono tabular-nums text-slate-100 font-semibold">
            {totalTokensUsed.toLocaleString('pt-BR')} tokens
          </span>
          <span className="text-slate-500" aria-hidden="true">/</span>
          <span className="font-mono tabular-nums text-emerald-400 font-semibold">
            {formatUsdCost(totalCostUsd)}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden 2xl:block" aria-hidden="true" />

        <div className="hidden 2xl:flex items-center gap-1.5 text-slate-400">
          <ShieldCheck
            className={`w-3.5 h-3.5 shrink-0 ${
              totalTokensUsed > 0 ? 'text-emerald-400' : 'text-sky-400'
            }`}
          />
          <span>{totalTokensUsed > 0 ? 'Operação Real' : 'Modo Simulação'}</span>
        </div>
      </div>

      {/* Zone 3: Phase 3 Actions (Nova Demanda, Vagas, Outbox) + Camera + Shortcuts */}
      <div className="flex items-center gap-2 shrink-0">
        {pendingRequisitions.length > 0 && (
          <button
            type="button"
            onClick={openHiringModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
            title="Atlas aguarda aprovação de contratação na porta da Diretoria"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>Vagas ({pendingRequisitions.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => openBriefingModal('briefing')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          title="Enviar nova demanda para Atlas e equipe"
        >
          <PlusSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Nova Demanda</span>
        </button>

        {deliveredArtifacts.length > 0 && (
          <button
            type="button"
            onClick={() => openBriefingModal('outbox')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              unreadDeliveriesCount > 0
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 hover:bg-emerald-500/30'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Abrir Caixa de Saída da Diretoria"
          >
            <Inbox className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono tabular-nums">
              {unreadDeliveriesCount > 0 ? `+${unreadDeliveriesCount}` : deliveredArtifacts.length}
            </span>
          </button>
        )}

        <span className="hidden xl:inline text-xs text-slate-400 whitespace-nowrap truncate max-w-[110px] ml-1">
          {currentRoom ? currentRoom.shortName : 'Corredor'}
        </span>

        <button
          type="button"
          onClick={centerOnCeo}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
            followCeo
              ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 hover:bg-amber-500/25'
              : 'bg-slate-800 border-slate-500 text-white hover:bg-slate-700'
          }`}
          title="Centralizar câmera no Dono (Tecla Espaço)"
        >
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{followCeo ? 'Seguindo' : 'Centralizar'}</span>
        </button>

        {/* Controles & Atalhos (?) Popover */}
        <div className="relative" ref={helpRef}>
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            className={`p-1.5 border transition-colors cursor-pointer ${
              helpOpen
                ? 'bg-slate-700 border-sky-400 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Controles & Atalhos"
            aria-label="Controles e Atalhos"
            aria-expanded={helpOpen}
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {helpOpen && (
            <div className="absolute right-0 top-11 w-80 bg-[#0F172A] border-2 border-slate-600 p-3.5 pixel-panel z-50">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                <span className="font-pixel text-xs text-amber-400">Controles & Atalhos</span>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Fechar controles"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {SHORTCUT_ITEMS.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <kbd className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-100 whitespace-nowrap shrink-0">
                      {item.keys}
                    </kbd>
                    <span className="text-slate-300 text-right leading-tight">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
