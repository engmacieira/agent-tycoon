import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  Brain,
  Check,
  CheckCircle2,
  Coffee,
  Copy,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  Footprints,
  GitBranch,
  Inbox,
  Info,
  KeyRound,
  Lock,
  MessageSquare,
  Monitor,
  PauseCircle,
  PlayCircle,
  RotateCw,
  ShieldCheck,
  Terminal,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { PLANNED_STAFF_ROSTER } from '../data/officeLayout';
import { useOffice } from '../context/OfficeContext';
import {
  DEFAULT_MODEL_ID,
  MODEL_OPTIONS,
  isRealApiKeyConfigured,
} from '../engine/llmClient';
import { AgentModelId, AgentState, RoomId } from '../types/office';

function formatUsd(val: number): string {
  if (val === 0) return '$0.00';
  if (val < 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(2)}`;
}

function formatAgentStateLabel(state: AgentState): string {
  switch (state) {
    case 'working':
      return 'Na Mesa';
    case 'indo_cafe':
      return 'Indo p/ Copa';
    case 'tomando_cafe':
      return 'Tomando Café';
    case 'auditando_infra':
      return 'Auditando CPD';
    case 'planejando':
      return 'Planejando / Ilhas';
    case 'walking':
      return 'Em Trânsito';
    case 'meeting':
      return 'Em Reunião';
    case 'em_reuniao':
      return 'Em Reunião (War Room)';
    case 'indo_reuniao':
      return 'Indo p/ War Room';
    case 'homologando_qa':
      return 'Homologando no Lab QA';
    case 'corrigindo_qa':
      return 'Corrigindo Apontamento QA';
    case 'break':
      return 'Em Pausa';
    case 'indo_diretoria_alerta':
      return 'Indo p/ Diretoria (!)';
    case 'aguardando_aprovacao':
      return 'Aguardando Aprovação';
    case 'indo_baia':
      return 'Indo p/ Baia';
    case 'indo_qa':
      return 'Validando no Lab QA';
    case 'entregando_diretoria':
      return 'Entregando na Diretoria';
    case 'pausado_orcamento':
      return 'Pausado (FinOps)';
    case 'idle':
    default:
      return 'Disponível';
  }
}

export const InspectorDrawer: React.FC = () => {
  const {
    rooms,
    agents,
    selectedRoomId,
    selectedObject,
    selectedAgentId,
    selectRoom,
    selectAgent,
    walkToRoom,
    focusRoom,
    apiKeysByVar,
    localSimLogs,
    qaSirenActive,
    qaSirenMode,
    toggleQaSiren,
    totalTokensUsed,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    briefings,
    activeWarRoomSession,
    warRoomSessions,
    pendingRequisitions,
    deliveredArtifacts,
    unreadDeliveriesCount,
    openBriefingModal,
    openHiringModal,
    updateAgentModel,
    updateAgentDnaPrompt,
    saveEnvApiKey,
    clearEnvApiKey,
    buildEnvExportText,
    toggleAgentBudgetPause,
    setAgentBudgetLimit,
    forceRetryPipeline,
  } = useOffice();

  const [ceoSubView, setCeoSubView] = useState<'none' | 'roster' | 'tokens'>('none');
  const [memoryTab, setMemoryTab] = useState<'dna' | 'short' | 'long'>('dna');
  const [keyInput, setKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [copiedFlag, setCopiedFlag] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<string | null>(null);
  const [customModelMode, setCustomModelMode] = useState<boolean>(false);
  const [customModelInput, setCustomModelInput] = useState<string>('');

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;
  const room = rooms.find((r) => r.id === selectedRoomId) ?? null;

  // Sync key input and custom model input whenever selectedAgent changes
  useEffect(() => {
    if (selectedAgent?.apiKeyEnvVar) {
      setKeyInput(apiKeysByVar[selectedAgent.apiKeyEnvVar] ?? '');
    } else {
      setKeyInput('');
    }
    const currentModel = selectedAgent?.model ?? DEFAULT_MODEL_ID;
    const isPreset = MODEL_OPTIONS.some((opt) => opt.id === currentModel);
    setCustomModelMode(!isPreset);
    setCustomModelInput(currentModel);
    setShowKey(false);
    setExportPreview(null);
    setCopiedFlag(null);
  }, [selectedAgent?.id, selectedAgent?.apiKeyEnvVar, selectedAgent?.model, apiKeysByVar]);

  // Clear export preview when switching rooms
  useEffect(() => {
    setExportPreview(null);
    setCopiedFlag(null);
  }, [selectedRoomId]);

  if (!selectedAgent && !room) return null;

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: preview still opens for manual copy
    }
    setExportPreview(text);
    setCopiedFlag(label);
    setTimeout(() => setCopiedFlag(null), 2500);
  };

  const handleDownloadEnv = (text: string, filename = '.env.agents') => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderFinopsSection = () => {
    const aiAgents = agents.filter((a) => a.id !== 'ceo');
    const islandGroups: Array<{ label: string; roomIds: RoomId[] }> = [
      { label: 'Gestão (Coordenadores)', roomIds: ['coordenadores'] },
      { label: 'Ilha Backend', roomIds: ['backend'] },
      { label: 'Ilha Frontend', roomIds: ['frontend'] },
      { label: 'Ilha Administrativo', roomIds: ['admin'] },
      { label: 'Ilha Marketing', roomIds: ['marketing'] },
      { label: 'Laboratório QA', roomIds: ['qa-lab'] },
    ];

    return (
      <section className="border-t border-slate-800 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-pixel text-xs text-emerald-400 flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5" />
            <span>FinOps em Tempo Real</span>
          </h3>
          <span className="font-mono text-xs tabular-nums text-emerald-300 font-semibold">
            {formatUsd(totalCostUsd)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-900/80 border border-slate-800 p-2.5 text-center">
          <div>
            <div className="text-[10px] text-slate-400">Input</div>
            <div className="font-mono text-xs tabular-nums text-slate-100 font-semibold">
              {totalInputTokens.toLocaleString('pt-BR')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">Output</div>
            <div className="font-mono text-xs tabular-nums text-slate-100 font-semibold">
              {totalOutputTokens.toLocaleString('pt-BR')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">Total</div>
            <div className="font-mono text-xs tabular-nums text-emerald-400 font-semibold">
              {totalTokensUsed.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>

        {/* Gasto por Ilha */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-300">Consumo por Ilha</div>
          <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
            {islandGroups.map((grp) => {
              const groupAgents = aiAgents.filter((a) => grp.roomIds.includes(a.departmentId));
              const grpTokens = groupAgents.reduce((acc, a) => acc + a.tokensUsed, 0);
              const grpCost = groupAgents.reduce((acc, a) => acc + a.estimatedCostUsd, 0);
              return (
                <div
                  key={grp.label}
                  className="px-2.5 py-1.5 flex items-center justify-between text-xs"
                >
                  <span className="text-slate-300 truncate">{grp.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-200 shrink-0">
                    {grpTokens.toLocaleString('pt-BR')} tok ·{' '}
                    <span className="text-emerald-400">{formatUsd(grpCost)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Controle & Teto por Agente */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-300">
            Controle por Agente (Teto USD)
          </div>
          <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
            {aiAgents.map((ag) => (
              <div key={ag.id} className="p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {ag.name}{' '}
                      <span className="text-[11px] font-normal text-slate-400">
                        ({ag.model ?? 'flash'})
                      </span>
                    </div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-400">
                      {(ag.inputTokens ?? 0).toLocaleString('pt-BR')} in /{' '}
                      {(ag.outputTokens ?? 0).toLocaleString('pt-BR')} out ·{' '}
                      <span className="text-emerald-400">{formatUsd(ag.estimatedCostUsd)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleAgentBudgetPause(ag.id)}
                    className={`px-2 py-1 text-[11px] font-semibold flex items-center gap-1 border shrink-0 cursor-pointer ${
                      ag.isPausedByBudget
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 hover:bg-emerald-600/30'
                        : 'bg-rose-950/50 border-rose-500/50 text-rose-300 hover:bg-rose-900/50'
                    }`}
                  >
                    {ag.isPausedByBudget ? (
                      <>
                        <PlayCircle className="w-3 h-3" />
                        <span>Retomar</span>
                      </>
                    ) : (
                      <>
                        <PauseCircle className="w-3 h-3" />
                        <span>Pausar Agente</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>Teto de orçamento ($ USD):</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.1}
                    value={ag.budgetLimitUsd ?? 1.0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) setAgentBudgetLimit(ag.id, v);
                    }}
                    className="w-20 bg-slate-900 border border-slate-700 px-2 py-0.5 text-right font-mono text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderPipelineTimelineSection = () => {
    const activeBriefing =
      briefings.find((b) => b.status !== 'completed' && b.status !== 'error') ??
      briefings[0] ??
      null;

    if (!activeBriefing) {
      return (
        <section className="border-t border-slate-800 pt-4 space-y-2">
          <h3 className="font-pixel text-xs text-sky-400 flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Pipeline Multi-Agente</span>
          </h3>
          <div className="bg-slate-900/60 border border-dashed border-slate-700 p-3 text-xs text-slate-400">
            Nenhum pipeline ativo no momento. Despache um briefing na Diretoria para acompanhar a War Room, execução em DAG e homologação no Lab QA.
          </div>
        </section>
      );
    }

    const steps = [...(activeBriefing.pipelineSteps ?? [])].sort(
      (a, b) => a.stepOrder - b.stepOrder
    );
    const matchingWarSession =
      warRoomSessions.find((w) => w.briefingId === activeBriefing.id) ??
      (activeWarRoomSession?.briefingId === activeBriefing.id ? activeWarRoomSession : null);

    const warBadge = !activeBriefing.requiresWarRoom
      ? '⏭️ Direto'
      : matchingWarSession?.status === 'completed'
      ? '✅ War Room'
      : activeBriefing.status === 'war_room' ||
        matchingWarSession?.status === 'convening' ||
        matchingWarSession?.status === 'aligning'
      ? '🔄 War Room'
      : '⏳ War Room';

    const qaBadge = activeBriefing.qaAudit
      ? activeBriefing.qaAudit.approved
        ? '✅ Lab QA'
        : '🔁 Retrabalho QA'
      : activeBriefing.status === 'qa_homologation'
      ? '🔄 Lab QA'
      : activeBriefing.status === 'rework'
      ? '🔁 Correção QA'
      : activeBriefing.status === 'completed'
      ? '✅ Lab QA'
      : '⏳ Lab QA';

    return (
      <section className="border-t border-slate-800 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-pixel text-xs text-sky-400 flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Pipeline em Tempo Real</span>
          </h3>
          <span className="font-mono text-[10px] text-amber-300 uppercase">
            {activeBriefing.status === 'war_room'
              ? 'War Room'
              : activeBriefing.status === 'qa_homologation'
              ? 'Lab QA'
              : activeBriefing.status === 'rework'
              ? 'Retrabalho 1/1'
              : activeBriefing.status === 'completed'
              ? 'Concluído'
              : activeBriefing.status === 'error'
              ? 'Erro API'
              : activeBriefing.status === 'awaiting_hires'
              ? 'Vagas'
              : 'Executando'}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-2.5 space-y-2">
          <div className="text-xs font-semibold text-white truncate">{activeBriefing.title}</div>

          {/* Flow chips */}
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 text-sky-300">
              {warBadge}
            </span>
            {steps.map((st) => {
              const ag = st.assignedAgentId
                ? agents.find((a) => a.id === st.assignedAgentId)
                : null;
              const icon =
                st.status === 'completed'
                  ? '✅'
                  : st.status === 'in_progress' ||
                    st.status === 'em_execucao' ||
                    st.status === 'qa_audit'
                  ? '🔄'
                  : st.status === 'rework'
                  ? '🔁'
                  : st.status === 'api_error' || st.status === 'paused_budget'
                  ? '⚠️'
                  : '⏳';
              return (
                <React.Fragment key={st.id}>
                  <span className="text-slate-600">→</span>
                  <span
                    className={`px-1.5 py-0.5 bg-slate-950 border ${
                      st.status === 'completed'
                        ? 'border-emerald-600/60 text-emerald-300'
                        : st.status === 'in_progress' ||
                          st.status === 'em_execucao' ||
                          st.status === 'rework'
                        ? 'border-amber-500/70 text-amber-300'
                        : st.status === 'api_error'
                        ? 'border-rose-500/70 text-rose-300'
                        : 'border-slate-700 text-slate-300'
                    }`}
                  >
                    {icon} {st.department}
                    {ag ? ` (${ag.name})` : ''}
                  </span>
                </React.Fragment>
              );
            })}
            <span className="text-slate-600">→</span>
            <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 text-rose-300">
              {qaBadge}
            </span>
          </div>

          {/* Per-step token & cost breakdown */}
          {steps.length > 0 && (
            <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
              {steps.map((st) => {
                const ag = st.assignedAgentId
                  ? agents.find((a) => a.id === st.assignedAgentId)
                  : null;
                const stepTokens = st.inputTokens + st.outputTokens;
                return (
                  <div
                    key={st.id}
                    className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="text-slate-200 truncate">
                        <span className="font-mono text-slate-500 mr-1">#{st.stepOrder}</span>
                        {st.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {st.department}
                        {ag ? ` · ${ag.name}` : ' · Pendente'}
                        {st.reworkCount > 0 ? ` · Retrabalho ${st.reworkCount}/1` : ''}
                        {st.wasTruncated ? ' · ⚠️ Truncado' : ''}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] text-slate-300 tabular-nums shrink-0 text-right">
                      <div>{stepTokens.toLocaleString('pt-BR')} tok</div>
                      <div className="text-emerald-400">{formatUsd(st.estimatedCostUsd)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeBriefing.status !== 'completed' && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => forceRetryPipeline(activeBriefing.id)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-mono text-amber-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Forçar reexecução caso alguma etapa tenha travado ou sofrido timeout"
              >
                <RotateCw className="w-3 h-3" />
                <span>Destravar / Reprocessar Etapa</span>
              </button>
            </div>
          )}
        </div>
      </section>
    );
  };

  // ================= VIEW 1: FICHA TÉCNICA DO AGENTE =================
  if (selectedAgent) {
    const isCeo = selectedAgent.id === 'ceo';
    const envVar = selectedAgent.apiKeyEnvVar;
    const storedKey = envVar ? apiKeysByVar[envVar] : undefined;
    const hasRealKey = isRealApiKeyConfigured(storedKey);
    const isExplicitFallback = storedKey === 'FALLBACK_TEST_KEY';
    const agentLogs = localSimLogs.filter((l) => l.agentId === selectedAgent.id).slice(0, 6);
    const agentDeliveries = deliveredArtifacts.filter((d) => d.agentId === selectedAgent.id);

    return (
      <aside
        className="w-full sm:w-96 bg-[#0F172A]/95 border-l-2 border-slate-700/90 h-full flex flex-col z-20 pixel-panel shrink-0"
        aria-label="Ficha Técnica do Agente"
      >
        {/* Cabeçalho da Ficha */}
        <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-sans">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                <UserCheck
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: selectedAgent.badgeColor ?? '#F59E0B' }}
                />
                <span>{formatAgentStateLabel(selectedAgent.state)}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-slate-400">
                {selectedAgent.tokensUsed.toLocaleString('pt-BR')} tokens
              </span>
            </div>
            <h2 className="font-pixel text-base text-white leading-snug">{selectedAgent.name}</h2>
            <p className="text-xs text-slate-300">{selectedAgent.role}</p>
          </div>

          <button
            type="button"
            onClick={() => selectAgent(null)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/70 transition-colors cursor-pointer shrink-0"
            title="Fechar ficha (ESC)"
            aria-label="Fechar ficha (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-5 font-sans">
          {/* Diagnóstico explícito de erro na última chamada real da API */}
          {selectedAgent.lastApiError && (
            <div className="bg-rose-950/70 border border-rose-500 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Erro na Chamada Real da API</span>
              </div>
              <div className="font-mono text-[11px] text-rose-100 break-all leading-relaxed">
                {selectedAgent.lastApiError}
              </div>
              <p className="text-[11px] text-rose-300/90">
                Corrija a API Key ou o modelo abaixo. O fallback automático permanece bloqueado enquanto houver uma chave preenchida.
              </p>
            </div>
          )}

          {/* Alerta rápido de contratação se Atlas estiver aguardando */}
          {selectedAgent.id === 'coord-team' && pendingRequisitions.length > 0 && (
            <div className="bg-amber-500/15 border border-amber-400 p-3 flex items-center justify-between gap-2">
              <div className="text-xs text-amber-200 font-medium">
                {pendingRequisitions.length} vaga(s) aguardando assinatura do CEO
              </div>
              <button
                type="button"
                onClick={openHiringModal}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Abrir</span>
              </button>
            </div>
          )}

          {/* Barras de Necessidade (Agentes IA) */}
          {!isCeo && (
            <section className="space-y-2.5 bg-slate-900/70 border border-slate-800 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Necessidades Autônomas</span>
                <span className="font-mono text-[10px] text-slate-400">0 Tokens</span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>Café / Energia</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {Math.round(selectedAgent.needs.cafe)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 border border-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        selectedAgent.needs.cafe < 30 ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.round(selectedAgent.needs.cafe)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Cpu className="w-3.5 h-3.5 text-sky-400" />
                      <span>Rotina / Inspeção</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {Math.round(selectedAgent.needs.rotina)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 border border-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        selectedAgent.needs.rotina < 35 ? 'bg-amber-500' : 'bg-sky-400'
                      }`}
                      style={{ width: `${Math.round(selectedAgent.needs.rotina)}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Seletor de Modelo & Vinculação .env (Coordenadores / Agentes IA) */}
          {!isCeo && envVar && (
            <section className="border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-xs text-emerald-400 flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Modelo & Chave .env</span>
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                    selectedAgent.lastApiError
                      ? 'text-rose-400'
                      : hasRealKey
                      ? 'text-emerald-400'
                      : isExplicitFallback
                      ? 'text-sky-300'
                      : 'text-amber-400'
                  }`}
                >
                  {selectedAgent.lastApiError ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Erro na API</span>
                    </>
                  ) : hasRealKey ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>API Real Ativa</span>
                    </>
                  ) : isExplicitFallback ? (
                    <>
                      <Info className="w-3.5 h-3.5" />
                      <span>Modo Fallback</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Sem Chave</span>
                    </>
                  )}
                </span>
              </div>

              {/* Seletor de Modelo + Custom ID */}
              <div className="space-y-1.5">
                <label
                  htmlFor="agent-model-select"
                  className="block text-xs font-medium text-slate-300"
                >
                  Modelo de IA Padrão
                </label>
                <select
                  id="agent-model-select"
                  value={customModelMode ? '__custom__' : selectedAgent.model ?? DEFAULT_MODEL_ID}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setCustomModelMode(true);
                      setCustomModelInput(selectedAgent.model ?? '');
                    } else {
                      setCustomModelMode(false);
                      updateAgentModel(selectedAgent.id, val as AgentModelId);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 px-2.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-400"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="__custom__">ID de Modelo Customizado...</option>
                </select>

                {customModelMode && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customModelInput.trim()) {
                            updateAgentModel(
                              selectedAgent.id,
                              customModelInput.trim() as AgentModelId
                            );
                          }
                        }}
                        placeholder="Digite o ID do modelo (ex: gemini-3.1-pro-preview)"
                        aria-label="ID de Modelo Customizado"
                        className="flex-1 bg-slate-950 border border-sky-500/60 px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customModelInput.trim()) {
                            updateAgentModel(
                              selectedAgent.id,
                              customModelInput.trim() as AgentModelId
                            );
                          }
                        }}
                        disabled={!customModelInput.trim()}
                        className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Ativo: <span className="text-sky-300">{selectedAgent.model ?? DEFAULT_MODEL_ID}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Campo de Vinculação .env */}
              <div className="space-y-2 bg-slate-900/70 border border-slate-800 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Variável vinculada</span>
                  <code className="font-mono text-emerald-300 font-semibold">{envVar}</code>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Cole a API key de sessão..."
                      className="w-full bg-slate-950 border border-slate-700 pl-2.5 pr-8 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => saveEnvApiKey(envVar, keyInput)}
                    disabled={!keyInput.trim()}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Salvar
                  </button>

                  {(hasRealKey || isExplicitFallback) && (
                    <button
                      type="button"
                      onClick={() => {
                        clearEnvApiKey(envVar);
                        setKeyInput('');
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-rose-900/60 border border-slate-700 text-slate-300 hover:text-rose-200 transition-colors cursor-pointer"
                      title="Remover chave da sessão"
                      aria-label="Remover chave"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Botão Modo Fallback exibido APENAS quando o campo de API Key estiver explicitamente vazio */}
                {keyInput.trim() === '' && (
                  <button
                    type="button"
                    onClick={() => {
                      saveEnvApiKey(envVar, 'FALLBACK_TEST_KEY');
                      setKeyInput('FALLBACK_TEST_KEY');
                    }}
                    className="w-full py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 border border-sky-500/40 text-[11px] font-mono text-sky-300 transition-colors cursor-pointer"
                  >
                    Ativar Modo Fallback (campo vazio · 0 tokens)
                  </button>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyText(buildEnvExportText(envVar), envVar)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    {copiedFlag === envVar ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Exportar bloco .env</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => focusRoom('cpd')}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
                    title="Abrir Cofre do CPD"
                  >
                    Ver CPD
                  </button>
                </div>

                {exportPreview && (
                  <div className="mt-2 bg-slate-950 border border-slate-700 p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Pronto para colar no .env</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadEnv(exportPreview)}
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Baixar</span>
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre-wrap break-all">
                      {exportPreview}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Visualizador de Memória em 3 Camadas */}
          <section className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel text-xs text-sky-400 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5" />
                <span>Memória (3 Camadas)</span>
              </h3>
            </div>

            {isCeo ? (
              <div className="bg-slate-900/70 border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed">
                O Dono (CEO) é controlado diretamente por você via teclado (WASD/Setas) ou Pathfinding A*. Clique em Atlas ou Vega na Sala dos Coordenadores para editar suas memórias de IA.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setMemoryTab('dna')}
                    className={`py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                      memoryTab === 'dna'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    DNA / Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemoryTab('short')}
                    className={`py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                      memoryTab === 'short'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Curto Prazo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemoryTab('long')}
                    className={`py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                      memoryTab === 'long'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Longo Prazo
                  </button>
                </div>

                {memoryTab === 'dna' && (
                  <div className="space-y-2">
                    {selectedAgent.personality && (
                      <div className="bg-slate-900/70 border border-slate-800 p-2.5 text-xs text-slate-300">
                        <span className="font-semibold text-slate-200">Personalidade: </span>
                        {selectedAgent.personality}
                      </div>
                    )}
                    <label
                      htmlFor="agent-dna-prompt"
                      className="block text-xs font-medium text-slate-400"
                    >
                      DNA Prompt (editável)
                    </label>
                    <textarea
                      id="agent-dna-prompt"
                      rows={5}
                      value={selectedAgent.dnaPrompt ?? ''}
                      onChange={(e) => updateAgentDnaPrompt(selectedAgent.id, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 p-2.5 text-xs font-sans text-slate-100 leading-relaxed focus:outline-none focus:border-sky-400 resize-y"
                    />
                  </div>
                )}

                {memoryTab === 'short' && (
                  selectedAgent.shortTermMemory.length === 0 ? (
                    <div className="bg-slate-900/70 border border-dashed border-slate-700 p-3 text-xs text-slate-300 space-y-1">
                      <div className="font-semibold text-slate-200">
                        Memória de Curto Prazo (0 itens)
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        Limpa automaticamente após a entrega para economizar tokens. Armazena apenas o contexto imediato durante uma subtarefa ativa.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-900/60">
                      {selectedAgent.shortTermMemory.map((item) => (
                        <div key={item.id} className="p-2.5 text-xs text-sky-200 leading-relaxed">
                          {item.content}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {memoryTab === 'long' && (
                  <div className="space-y-3">
                    <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-900/60">
                      {selectedAgent.longTermMemory.map((fact) => (
                        <div key={fact.id} className="p-2.5 text-xs text-slate-200 leading-relaxed">
                          {fact.content}
                        </div>
                      ))}
                    </div>

                    {agentLogs.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" />
                          <span>Últimas falas locais</span>
                        </div>
                        <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
                          {agentLogs.map((log) => (
                            <div key={log.id} className="px-2.5 py-1.5 text-[11px] text-slate-300">
                              <span className="font-mono text-slate-500 mr-1.5 tabular-nums">
                                {log.timeStr}
                              </span>
                              <span>{log.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Entregas & Diagnóstico Recentes do Agente */}
          {agentDeliveries.length > 0 && (
            <section className="border-t border-slate-800 pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-xs text-amber-400 flex items-center gap-2">
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Entregas ({agentDeliveries.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => openBriefingModal('outbox')}
                  className="text-[11px] font-mono text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Abrir Caixa de Saída
                </button>
              </div>
              <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
                {agentDeliveries.slice(0, 4).map((del) => (
                  <div key={del.id} className="p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100 truncate">{del.title}</span>
                      <span
                        className={`font-mono text-[10px] shrink-0 ${
                          del.apiError
                            ? 'text-rose-400'
                            : del.usedFallback
                            ? 'text-sky-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {del.apiError ? 'ERRO API' : del.usedFallback ? 'Fallback' : 'API Real'}
                      </span>
                    </div>
                    {del.apiError ? (
                      <div className="font-mono text-[11px] text-rose-300 bg-rose-950/50 border border-rose-500/40 p-1.5 break-all">
                        {del.apiError}
                      </div>
                    ) : (
                      <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {del.inputTokens} in / {del.outputTokens} out · {formatUsd(del.estimatedCostUsd)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Painel FinOps completo ao inspecionar Vega */}
          {selectedAgent.id === 'coord-finance' && renderFinopsSection()}
        </div>
      </aside>
    );
  }

  // ================= VIEW 2: INSPETOR DA SALA =================
  if (!room) return null;

  const occupiedSlots = room.deskSlots.filter((s) => s.occupiedByAgentId !== null).length;
  const capacityText =
    room.capacity > 0
      ? `${occupiedSlots}/${room.capacity} ${room.capacity === 1 ? 'Baia' : 'Baias'}`
      : 'Área Comum / Infra';
  const contractedAgents = agents.filter((a) => Boolean(a.apiKeyEnvVar));
  const configuredKeysCount = contractedAgents.filter((a) =>
    isRealApiKeyConfigured(apiKeysByVar[a.apiKeyEnvVar!])
  ).length;
  const activeCount = agents.length;

  return (
    <aside
      className="w-full sm:w-96 bg-[#0F172A]/95 border-l-2 border-slate-700/90 h-full flex flex-col z-20 pixel-panel shrink-0"
      aria-label="Inspetor de Sala"
    >
      {/* BLOCO 1: CABEÇALHO DA SALA */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-sans">
            <span>Ala {room.wing}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-slate-200 font-medium">
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{capacityText}</span>
            </span>
          </div>
          <h2 className="font-pixel text-base text-white leading-snug">{room.name}</h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setCeoSubView('none');
            selectRoom(null, null);
          }}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/70 transition-colors cursor-pointer shrink-0"
          title="Fechar painel (ESC)"
          aria-label="Fechar painel (ESC)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* CORPO COM SCROLL */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-5 font-sans">
        {selectedObject && (
          <div className="bg-slate-900/90 border border-amber-500/50 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
              <span>Objeto Inspecionado</span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                ({selectedObject.anchor.x}, {selectedObject.anchor.y})
              </span>
            </div>
            <div className="text-sm font-semibold text-white">{selectedObject.label}</div>
            <p className="text-xs text-slate-300 leading-relaxed">{selectedObject.description}</p>
          </div>
        )}

        {/* BLOCO 2: FUNÇÃO OPERACIONAL */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 tracking-wide">Função Operacional</h3>
          <p className="text-sm text-slate-200 leading-relaxed">{room.roleDescription}</p>

          <button
            type="button"
            onClick={() => walkToRoom(room.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Footprints className="w-4 h-4" />
            <span>Caminhar até {room.shortName}</span>
          </button>
        </section>

        {/* BLOCO 3A: TERMINAL DE DIRETORIA */}
        {room.id === 'diretoria' && (
          <section className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel text-xs text-amber-400 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" />
                <span>Terminal de Diretoria</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">Operacional</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => openBriefingModal('briefing')}
                className="w-full flex items-center justify-between px-3 py-2.5 border bg-emerald-600/20 border-emerald-500/60 hover:bg-emerald-600/30 text-left text-emerald-100 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-xs font-semibold">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nova Demanda (Briefing)</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-300">Abrir</span>
              </button>

              <button
                type="button"
                onClick={() => openBriefingModal('outbox')}
                className="w-full flex items-center justify-between px-3 py-2.5 border bg-slate-900 border-slate-700 hover:border-slate-500 text-left text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Inbox className="w-3.5 h-3.5 text-sky-400" />
                  <span>Caixa de Saída ({deliveredArtifacts.length})</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-sky-400">
                  {unreadDeliveriesCount > 0 ? `${unreadDeliveriesCount} nova(s)` : 'Ler'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCeoSubView((v) => (v === 'roster' ? 'none' : 'roster'))}
                className={`w-full flex items-center justify-between px-3 py-2.5 border text-left transition-colors cursor-pointer ${
                  ceoSubView === 'roster'
                    ? 'bg-slate-800 border-sky-400 text-white'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>Quadro de Funcionários ({activeCount}/14)</span>
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
                  <span>Relatório de Tokens ({formatUsd(totalCostUsd)})</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-emerald-400">Detalhes</span>
              </button>
            </div>

            {ceoSubView === 'roster' && (
              <div className="bg-slate-900/90 border border-slate-700 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>Organograma do Escritório</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {activeCount}/14 ativos
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto custom-scroll divide-y divide-slate-800">
                  {PLANNED_STAFF_ROSTER.map((slot) => {
                    const hiredInRoom = agents.filter(
                      (a) => a.departmentId === slot.roomId && a.id !== 'ceo' && a.id !== 'coord-team' && a.id !== 'coord-finance'
                    );
                    const matchedRoom = rooms.find((r) => r.id === slot.roomId);
                    const isFilled =
                      slot.status === 'active' ||
                      (matchedRoom?.deskSlots.some(
                        (ds) => ds.roleTitle === slot.title && ds.occupiedByAgentId !== null
                      ) ?? false);
                    const occupantSlot = matchedRoom?.deskSlots.find(
                      (ds) => ds.roleTitle === slot.title && ds.occupiedByAgentId !== null
                    );
                    const occupantAgent = occupantSlot?.occupiedByAgentId
                      ? agents.find((a) => a.id === occupantSlot.occupiedByAgentId)
                      : hiredInRoom[0];

                    return (
                      <div
                        key={slot.slotNumber}
                        className="py-1.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="text-slate-200 truncate">
                            <span className="font-mono text-slate-500 mr-1.5 tabular-nums">
                              {String(slot.slotNumber).padStart(2, '0')}
                            </span>
                            {slot.agentName
                              ? `${slot.agentName} · ${slot.title}`
                              : isFilled && occupantAgent
                              ? `${occupantAgent.name} · ${occupantAgent.role}`
                              : slot.title}
                          </div>
                          <div className="text-[11px] text-slate-500">{slot.roomName}</div>
                        </div>
                        <span
                          className={`text-[11px] font-mono shrink-0 ${
                            isFilled ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {isFilled ? 'Ativo' : 'Vago'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {ceoSubView === 'tokens' && (
              <div className="bg-slate-900/90 border border-slate-700 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-200 font-semibold">
                  <span>Auditoria de Consumo (Vega FinOps)</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    {formatUsd(totalCostUsd)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Input / Output</span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {totalInputTokens.toLocaleString('pt-BR')} /{' '}
                    {totalOutputTokens.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total acumulado</span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {totalTokensUsed.toLocaleString('pt-BR')} tokens
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estado do motor</span>
                  <span className="font-mono text-sky-400">
                    {totalTokensUsed > 0
                      ? 'Execução Real + Idle Gratuito'
                      : 'Simulação Autônoma (0 Tokens)'}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* BLOCO 3A-2: PIPELINE ATIVO NA DIRETORIA */}
        {room.id === 'diretoria' && renderPipelineTimelineSection()}

        {/* BLOCO 3A-3: WAR ROOM — CONTRATO COMPARTILHADO & PIPELINE */}
        {room.id === 'war-room' && (
          <>
            <section className="border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-xs text-sky-400 flex items-center gap-2">
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Contrato da War Room</span>
                </h3>
                {activeWarRoomSession && (
                  <span className="font-mono text-[11px] text-amber-300">
                    {activeWarRoomSession.status === 'convening'
                      ? 'Reunindo Squad...'
                      : activeWarRoomSession.status === 'aligning'
                      ? 'Alinhando API...'
                      : 'Alinhado'}
                  </span>
                )}
              </div>

              {!activeWarRoomSession ? (
                <div className="bg-slate-900/70 border border-dashed border-slate-700 p-3 text-xs text-slate-400 leading-relaxed">
                  Nenhuma reunião tática realizada ainda. Quando uma demanda envolver 2 ou mais ilhas, Atlas e os especialistas sentam à mesa oval para definir o contrato técnico compartilhado.
                </div>
              ) : (
                <div className="bg-slate-900/80 border border-slate-700 p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white truncate">
                      {activeWarRoomSession.briefingTitle}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {activeWarRoomSession.startedAt}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {activeWarRoomSession.participantAgentIds.map((pid) => {
                      const pAgent = agents.find((a) => a.id === pid);
                      return (
                        <span
                          key={pid}
                          className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 text-[10px] font-mono text-sky-200"
                        >
                          {pAgent?.name ?? pid}
                        </span>
                      );
                    })}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-2.5 text-[11px] font-mono text-emerald-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scroll">
                    {activeWarRoomSession.sharedContract ||
                      'Aguardando especialistas ocuparem as cadeiras para o alinhamento de Atlas...'}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>
                      {activeWarRoomSession.usedFallback
                        ? 'Modo Fallback (0 tokens)'
                        : `${(
                            activeWarRoomSession.inputTokens + activeWarRoomSession.outputTokens
                          ).toLocaleString('pt-BR')} tokens`}
                    </span>
                    <span className="text-emerald-400">
                      {formatUsd(activeWarRoomSession.estimatedCostUsd)}
                    </span>
                  </div>
                </div>
              )}
            </section>
            {renderPipelineTimelineSection()}
          </>
        )}

        {/* BLOCO 3B: COFRE .ENV NO CPD */}
        {room.id === 'cpd' && (
          <section className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel text-xs text-emerald-400 flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Cofre de Variáveis .env</span>
              </h3>
              <span className="text-[11px] font-mono tabular-nums text-slate-300">
                {configuredKeysCount}/{contractedAgents.length} configuradas
              </span>
            </div>

            {configuredKeysCount === 0 && (
              <div className="bg-slate-900/80 border border-dashed border-slate-700 p-3 flex items-start gap-2.5 text-xs text-slate-300">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-slate-300">
                  Nenhuma chave de API preenchida nesta sessão ainda. Clique em um agente abaixo para vincular sua variável ou exporte o bloco .env consolidado.
                </p>
              </div>
            )}

            <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
              {contractedAgents.map((ag) => {
                const keyName = ag.apiKeyEnvVar!;
                const rawVal = apiKeysByVar[keyName];
                const realConfigured = isRealApiKeyConfigured(rawVal);
                const fallbackConfigured = rawVal === 'FALLBACK_TEST_KEY';
                return (
                  <div
                    key={ag.id}
                    className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-900/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">{ag.name}</span>
                        <span className="text-[11px] text-slate-400 truncate">· {ag.model}</span>
                      </div>
                      <div className="font-mono text-[11px] text-emerald-300 truncate mt-0.5">
                        {keyName}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                          ag.lastApiError
                            ? 'text-rose-400'
                            : realConfigured
                            ? 'text-emerald-400'
                            : fallbackConfigured
                            ? 'text-sky-300'
                            : 'text-amber-400'
                        }`}
                      >
                        {ag.lastApiError ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Erro API</span>
                          </>
                        ) : realConfigured ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>API Real</span>
                          </>
                        ) : fallbackConfigured ? (
                          <>
                            <Info className="w-3.5 h-3.5" />
                            <span>Fallback</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Sem Chave</span>
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => selectAgent(ag.id)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] text-slate-200 cursor-pointer"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Exportação Consolidada */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyText(buildEnvExportText(), 'ALL')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedFlag === 'ALL' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Bloco .env Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Exportar .env Consolidado</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadEnv(buildEnvExportText(), '.env.pixelhq')}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
                title="Baixar arquivo .env"
                aria-label="Baixar arquivo .env"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {exportPreview && (
              <pre className="bg-slate-950 border border-slate-700 p-2.5 text-[11px] font-mono text-emerald-300 whitespace-pre-wrap break-all">
                {exportPreview}
              </pre>
            )}
          </section>
        )}

        {/* BLOCO 3B-2: AUDITORIA FINOPS NO CPD */}
        {room.id === 'cpd' && renderFinopsSection()}

        {/* BLOCO 3C: SIRENE & HOMOLOGAÇÃO NO LAB QA */}
        {room.id === 'qa-lab' && (
          <>
            <section className="border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-xs text-rose-400 flex items-center gap-2">
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Sirene de Homologação</span>
                </h3>
                <span
                  className={`text-[11px] font-mono font-semibold ${
                    qaSirenMode === 'approved'
                      ? 'text-emerald-400'
                      : qaSirenMode === 'warning'
                      ? 'text-amber-400'
                      : qaSirenMode === 'test' || qaSirenActive
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {qaSirenMode === 'approved'
                    ? 'Verde · Homologado'
                    : qaSirenMode === 'warning'
                    ? 'Âmbar · Retrabalho'
                    : qaSirenMode === 'test' || qaSirenActive
                    ? 'Ligada (Teste)'
                    : 'Desligada'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Acende em <span className="text-emerald-400 font-semibold">verde</span> quando o QA homologa o pacote integrado e em <span className="text-amber-400 font-semibold">âmbar</span> quando solicita correção (trava FinOps: máx. 1 ciclo de retrabalho).
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

              {(() => {
                const latestQaBrief = briefings.find((b) => Boolean(b.qaAudit));
                const audit = latestQaBrief?.qaAudit;
                if (!audit) return null;
                return (
                  <div className="bg-slate-900/80 border border-slate-700 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <ShieldCheck
                          className={`w-3.5 h-3.5 ${
                            audit.approved ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        />
                        <span>Última Auditoria ({audit.reviewerName})</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {audit.verdict ? `${audit.verdict} · ` : ''}Ciclo {audit.reworkCycleUsed}/1
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-2 text-[11px] font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scroll">
                      {audit.findings}
                    </div>
                  </div>
                );
              })()}
            </section>
            {renderPipelineTimelineSection()}
          </>
        )}

        {/* BLOCO 3D: AÇÕES & SLOTS DAS BAIAS */}
        {room.deskSlots.length > 0 && (
          <section className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                <span>Ações & Slots</span>
              </h3>
              <span className="font-mono text-xs tabular-nums text-slate-400">
                {occupiedSlots}/{room.deskSlots.length} ocupadas
              </span>
            </div>

            {occupiedSlots === 0 && (
              <div className="bg-slate-900/70 border border-dashed border-slate-700 p-3 flex items-start gap-2.5 text-xs text-slate-300">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-slate-300">
                  Sala pronta e sem agentes ativos. Quando novas vagas forem abertas pelo Atlas, os funcionários ocuparão automaticamente as baias abaixo.
                </p>
              </div>
            )}

            <div className="divide-y divide-slate-800/80 border border-slate-800 bg-slate-900/50">
              {room.deskSlots.map((slot) => {
                const occupant = slot.occupiedByAgentId
                  ? agents.find((a) => a.id === slot.occupiedByAgentId)
                  : null;
                return (
                  <div
                    key={slot.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 truncate">{slot.label}</div>
                      <div className="text-[11px] text-slate-400 truncate">{slot.roleTitle}</div>
                    </div>
                    {occupant ? (
                      <button
                        type="button"
                        onClick={() => selectAgent(occupant.id)}
                        className="font-mono text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0 cursor-pointer"
                      >
                        {occupant.name} (Ver)
                      </button>
                    ) : (
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        Disponível (+)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* BLOCO 3E: LOG LOCAL DA SIMULAÇÃO (0 TOKENS) */}
        <section className="border-t border-slate-800 pt-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Registro Autônomo</span>
            </h3>
            <span className="font-mono text-[10px] text-emerald-400">[0 tokens]</span>
          </div>
          <div className="max-h-40 overflow-y-auto custom-scroll divide-y divide-slate-800/80 border border-slate-800 bg-slate-950/60">
            {localSimLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="px-2.5 py-2 text-[11px] leading-relaxed">
                <div className="flex items-center justify-between text-slate-400 mb-0.5">
                  <span className="font-semibold text-slate-200">{log.agentName}</span>
                  <span className="font-mono text-[10px] tabular-nums">
                    {log.timeStr} · [0 tokens]
                  </span>
                </div>
                <div className="text-slate-300">{log.text}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
};
