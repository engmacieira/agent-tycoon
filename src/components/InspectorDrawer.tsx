import React, { useState } from 'react';
import {
  BellRing,
  Cpu,
  Footprints,
  KeyRound,
  Lock,
  Monitor,
  Terminal,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { PLANNED_STAFF_ROSTER } from '../data/officeLayout';
import { useOffice } from '../context/OfficeContext';

export const InspectorDrawer: React.FC = () => {
  const {
    rooms,
    selectedRoomId,
    selectedObject,
    selectRoom,
    walkToRoom,
    envVaultSlots,
    qaSirenActive,
    toggleQaSiren,
    totalTokensUsed,
    totalCostUsd,
  } = useOffice();

  const [ceoSubView, setCeoSubView] = useState<'none' | 'roster' | 'tokens' | 'demand'>('none');

  const room = rooms.find((r) => r.id === selectedRoomId);
  if (!room) return null;

  const occupiedSlots = room.deskSlots.filter((s) => s.occupiedByAgentId !== null).length;
  const capacityText =
    room.capacity > 0
      ? `${occupiedSlots}/${room.capacity} ocupadas`
      : 'Área de infraestrutura / convivência';

  return (
    <aside
      className="w-full sm:w-96 bg-[#0F172A]/95 border-l-2 border-slate-700/90 h-full flex flex-col z-20 pixel-panel shrink-0"
      aria-label="Inspetor de Sala"
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Ala {room.wing}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">{capacityText}</span>
          </div>
          <h2 className="font-pixel text-base text-white mt-1 leading-snug">{room.name}</h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setCeoSubView('none');
            selectRoom(null, null);
          }}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/70 transition-colors cursor-pointer shrink-0"
          aria-label="Fechar painel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-5">
        {/* Selected Interactive Object Spotlight */}
        {selectedObject && (
          <div className="bg-slate-900/90 border border-amber-500/50 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
              <span>Objeto Selecionado</span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                ({selectedObject.anchor.x}, {selectedObject.anchor.y})
              </span>
            </div>
            <div className="text-sm font-semibold text-white">{selectedObject.label}</div>
            <p className="text-xs text-slate-300 leading-relaxed">{selectedObject.description}</p>
          </div>
        )}

        {/* Walk CEO Action + Operational Role */}
        <div className="space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">{room.roleDescription}</p>

          <button
            type="button"
            onClick={() => walkToRoom(room.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Footprints className="w-4 h-4" />
            <span>Caminhar até {room.shortName}</span>
          </button>
        </div>

        {/* SPECIAL PANEL 1: SALA DA DIRETORIA — TERMINAL DE DIRETORIA */}
        {room.id === 'diretoria' && (
          <section className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel text-xs text-amber-400 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" />
                <span>Terminal de Diretoria</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">Fase 1</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setCeoSubView((v) => (v === 'demand' ? 'none' : 'demand'))}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-left transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>Nova Demanda</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">Fase 2</span>
              </button>

              <button
                type="button"
                onClick={() => setCeoSubView((v) => (v === 'roster' ? 'none' : 'roster'))}
                className={`w-full flex items-center justify-between px-3 py-2.5 border text-left transition-colors cursor-pointer ${
                  ceoSubView === 'roster'
                    ? 'bg-slate-800 border-amber-400 text-white'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>Quadro de Funcionários (1/14)</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-sky-400">Ver vagas</span>
              </button>

              <button
                type="button"
                onClick={() => setCeoSubView((v) => (v === 'tokens' ? 'none' : 'tokens'))}
                className={`w-full flex items-center justify-between px-3 py-2.5 border text-left transition-colors cursor-pointer ${
                  ceoSubView === 'tokens'
                    ? 'bg-slate-800 border-emerald-400 text-white'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Relatório de Tokens (${totalCostUsd.toFixed(2)})</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-emerald-400">Detalhes</span>
              </button>
            </div>

            {ceoSubView === 'demand' && (
              <div className="bg-slate-900/90 border border-slate-700 p-3 text-xs text-slate-300 space-y-1.5">
                <div className="font-semibold text-amber-300">Despacho de Demandas (Em Breve)</div>
                <p className="text-slate-400 leading-relaxed">
                  Na Fase 2, o CEO poderá enviar prompts e objetivos estratégicos aqui para os Coordenadores distribuírem às ilhas operacionais.
                </p>
              </div>
            )}

            {ceoSubView === 'roster' && (
              <div className="bg-slate-900/90 border border-slate-700 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>Organograma Previsto</span>
                  <span className="font-mono tabular-nums text-amber-400">1/14 ativos</span>
                </div>
                <div className="max-h-52 overflow-y-auto custom-scroll divide-y divide-slate-800">
                  {PLANNED_STAFF_ROSTER.map((slot) => (
                    <div key={slot.slotNumber} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-slate-200 truncate">
                          <span className="font-mono text-slate-500 mr-1.5 tabular-nums">
                            {String(slot.slotNumber).padStart(2, '0')}
                          </span>
                          {slot.title}
                        </div>
                        <div className="text-[11px] text-slate-500">{slot.roomName}</div>
                      </div>
                      <span
                        className={`text-[11px] font-mono shrink-0 ${
                          slot.status === 'active' ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {slot.status === 'active' ? 'Ativo' : 'Vago'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ceoSubView === 'tokens' && (
              <div className="bg-slate-900/90 border border-slate-700 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-200 font-semibold">
                  <span>Auditoria de Consumo</span>
                  <span className="font-mono tabular-nums text-emerald-400">${totalCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tokens consumidos nesta sessão</span>
                  <span className="font-mono tabular-nums text-slate-200">{totalTokensUsed}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estado do motor</span>
                  <span className="font-mono text-sky-400">Simulação Local (60 FPS)</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SPECIAL PANEL 2: CPD / SALA DE SERVIDORES — COFRE .ENV */}
        {room.id === 'cpd' && (
          <section className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel text-xs text-emerald-400 flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Cofre de Variáveis .env</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">0/4 vinculadas</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Repositório preparado para associar variáveis de ambiente aos agentes de cada ilha na Fase 2. Nenhuma chave está ativa no momento.
            </p>

            <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
              {envVaultSlots.map((slot) => (
                <div key={slot.keyName} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-emerald-300 truncate">{slot.keyName}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {slot.provider} · {slot.scope}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 shrink-0">
                    <Lock className="w-3 h-3" />
                    <span>Vazio</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SPECIAL PANEL 3: LABORATÓRIO DE QA — SIRENE */}
        {room.id === 'qa-lab' && (
          <section className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel text-xs text-rose-400 flex items-center gap-2">
                <BellRing className="w-3.5 h-3.5" />
                <span>Sirene de Homologação</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-300">
                {qaSirenActive ? 'Ligada (Teste)' : 'Desligada'}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Permanece desligada por padrão. Será acionada automaticamente caso um agente de QA detecte falha crítica em entregas futuras.
            </p>
            <button
              type="button"
              onClick={toggleQaSiren}
              className={`w-full px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                qaSirenActive
                  ? 'bg-rose-600 border-rose-400 text-white hover:bg-rose-500'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {qaSirenActive ? 'Desligar Sirene na Parede' : 'Testar Sirene na Parede'}
            </button>
          </section>
        )}

        {/* DESK SLOTS LIST */}
        {room.deskSlots.length > 0 && (
          <section className="border-t border-slate-800 pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                <span>Estações de Trabalho</span>
              </h3>
              <span className="font-mono text-xs tabular-nums text-slate-400">
                {occupiedSlots}/{room.deskSlots.length}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 border border-slate-800 bg-slate-900/50">
              {room.deskSlots.map((slot) => {
                const isOccupied = slot.occupiedByAgentId !== null;
                return (
                  <div key={slot.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 truncate">{slot.label}</div>
                      <div className="text-[11px] text-slate-400 truncate">{slot.roleTitle}</div>
                    </div>
                    <span
                      className={`font-mono text-[11px] shrink-0 ${
                        isOccupied ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    >
                      {isOccupied ? 'Ocupada' : 'Disponível'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};
