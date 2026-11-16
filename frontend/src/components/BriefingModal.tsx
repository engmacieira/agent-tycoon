import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Inbox,
  Loader2,
  Send,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { useOffice } from '../context/OfficeContext';
import { isRealApiKeyConfigured } from '../engine/llmClient';
import { SubTaskStatus, TaskPriority } from '../types/office';

const PRIORITY_OPTIONS: Array<{ id: TaskPriority; label: string; color: string }> = [
  { id: 'baixa', label: 'Baixa', color: 'border-slate-600 text-slate-300' },
  { id: 'media', label: 'Média', color: 'border-sky-500/70 text-sky-300' },
  { id: 'alta', label: 'Alta', color: 'border-amber-500/80 text-amber-300' },
  { id: 'critica', label: 'Crítica', color: 'border-rose-500/80 text-rose-300' },
];

const EXAMPLE_BRIEFINGS = [
  'Criar API Backend de pacientes em FastAPI, Dashboard Frontend React e homologar no QA',
  'Criar esquema SQL para sistema de saúde e plano de testes',
  'Construir tela de dashboard financeiro em React e copy de lançamento',
  'Estruturar API FastAPI em Python para cadastro de pacientes e validação Pydantic',
];

function formatSubTaskStatus(status: SubTaskStatus): { label: string; cls: string } {
  switch (status) {
    case 'pending_hire':
      return { label: 'Vaga Pendente', cls: 'text-amber-400' };
    case 'queued':
      return { label: 'Na Fila', cls: 'text-sky-300' };
    case 'in_progress':
    case 'em_execucao':
      return { label: 'Em Execução', cls: 'text-emerald-300' };
    case 'qa_review':
      return { label: 'No Lab QA', cls: 'text-rose-300' };
    case 'delivered':
      return { label: 'Entregue', cls: 'text-emerald-400' };
    case 'paused_budget':
      return { label: 'Pausado FinOps', cls: 'text-rose-400' };
    case 'api_error':
      return { label: 'Erro na API', cls: 'text-rose-400 font-semibold' };
  }
}

export const BriefingModal: React.FC = () => {
  const {
    briefingModalOpen,
    briefingModalTab,
    openBriefingModal,
    closeBriefingModal,
    submitBriefing,
    isAnalyzingBriefing,
    briefings,
    pendingRequisitions,
    openHiringModal,
    deliveredArtifacts,
    unreadDeliveriesCount,
    markArtifactRead,
    apiKeysByVar,
    agents,
  } = useOffice();

  const [promptText, setPromptText] = useState<string>(
    'Criar API Backend de pacientes em FastAPI, Dashboard Frontend React e homologar no QA'
  );
  const [priority, setPriority] = useState<TaskPriority>('alta');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!briefingModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeBriefingModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [briefingModalOpen, closeBriefingModal]);

  useEffect(() => {
    if (briefingModalTab === 'outbox' && deliveredArtifacts.length > 0 && !selectedArtifactId) {
      const first = deliveredArtifacts[0];
      setSelectedArtifactId(first.id);
      if (!first.readByCeo) markArtifactRead(first.id);
    }
  }, [briefingModalTab, deliveredArtifacts, selectedArtifactId, markArtifactRead]);

  const activeArtifact =
    deliveredArtifacts.find((a) => a.id === selectedArtifactId) ?? deliveredArtifacts[0] ?? null;

  useEffect(() => {
    if (activeArtifact?.sections && activeArtifact.sections.length > 0) {
      setSelectedSectionId(activeArtifact.sections[0].id);
    } else {
      setSelectedSectionId(null);
    }
  }, [activeArtifact?.id]);

  if (!briefingModalOpen) return null;

  const atlasHasKey = isRealApiKeyConfigured(apiKeysByVar['AGENT_TEAM_LEAD_KEY']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || isAnalyzingBriefing) return;
    await submitBriefing(promptText, priority);
  };

  const handleCopyMarkdown = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard fallback ignored
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleDownloadMarkdown = (title: string, content: string) => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'entrega-pixelhq'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Terminal da Diretoria"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeBriefingModal();
      }}
    >
      <div className="w-full max-w-3xl max-h-[88vh] bg-[#0F172A] border-2 border-slate-600 pixel-panel flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/70">
          <div>
            <div className="text-[11px] font-mono text-amber-400">
              SALA DA DIRETORIA · CONSOLE DE ORDENS
            </div>
            <h2 className="font-pixel text-sm sm:text-base text-white mt-0.5">
              Terminal Executivo do CEO
            </h2>
          </div>

          <button
            type="button"
            onClick={closeBriefingModal}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 cursor-pointer"
            aria-label="Fechar Terminal da Diretoria"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/40">
          <button
            type="button"
            onClick={() => openBriefingModal('briefing')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              briefingModalTab === 'briefing'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Nova Demanda & Fila</span>
          </button>

          <button
            type="button"
            onClick={() => openBriefingModal('outbox')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              briefingModalTab === 'outbox'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Caixa de Saída ({deliveredArtifacts.length})</span>
            {unreadDeliveriesCount > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold">
                {unreadDeliveriesCount} nova{unreadDeliveriesCount > 1 ? 's' : ''}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-5 font-sans">
          {briefingModalTab === 'briefing' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">
                    Descreva o briefing para o Coordenador de Equipe (Atlas)
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      atlasHasKey ? 'text-emerald-400' : 'text-sky-300'
                    }`}
                  >
                    {atlasHasKey
                      ? 'API Real Ativa (AGENT_TEAM_LEAD_KEY)'
                      : 'Modo Simulação/Fallback pronto (0 tokens)'}
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Ex: Criar esquema SQL para sistema de saúde e plano de testes..."
                  className="w-full bg-slate-950 border border-slate-700 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 resize-y"
                />

                {/* Exemplos rápidos */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Sugestões de briefing:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_BRIEFINGS.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setPromptText(ex)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 text-left transition-colors cursor-pointer"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 mr-1">Prioridade:</span>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPriority(opt.id)}
                        className={`px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                          priority === opt.id
                            ? `${opt.color} bg-slate-800`
                            : 'border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!promptText.trim() || isAnalyzingBriefing}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isAnalyzingBriefing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Atlas analisando escopo...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Despachar para Atlas</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Pending hiring callout */}
              {pendingRequisitions.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold text-amber-200">
                        Atlas detectou gargalo operacional ({pendingRequisitions.length} vaga
                        {pendingRequisitions.length > 1 ? 's' : ''} pendente
                        {pendingRequisitions.length > 1 ? 's' : ''})
                      </div>
                      <p className="text-slate-300 mt-0.5">
                        Aprove as contratações para que os novos especialistas cheguem pela Recepção e executem as subtarefas.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeBriefingModal();
                      openHiringModal();
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Revisar Contratações</span>
                  </button>
                </div>
              )}

              {/* Active Briefings Queue */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-pixel text-xs text-slate-200">
                    Fila de Demandas ({briefings.length})
                  </h3>
                </div>

                {briefings.length === 0 ? (
                  <div className="bg-slate-900/60 border border-dashed border-slate-700 p-4 text-xs text-slate-400">
                    Nenhuma demanda enviada ainda. Despache o briefing acima para Atlas quebrar em subtarefas por ilha.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {briefings.map((brief) => (
                      <div
                        key={brief.id}
                        className="bg-slate-900/80 border border-slate-700 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">
                              {brief.title}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {brief.createdAt} · Prioridade {brief.priority.toUpperCase()}
                            </div>
                          </div>
                          <span
                            className={`font-mono text-[11px] shrink-0 ${
                              brief.status === 'error'
                                ? 'text-rose-400 font-semibold'
                                : brief.status === 'completed'
                                ? 'text-emerald-400 font-semibold'
                                : brief.status === 'rework'
                                ? 'text-amber-300 font-semibold'
                                : 'text-sky-300'
                            }`}
                          >
                            {brief.status === 'analyzing'
                              ? 'Analisando...'
                              : brief.status === 'awaiting_hires'
                              ? 'Aguardando Vagas'
                              : brief.status === 'war_room'
                              ? 'War Room (Alinhando)'
                              : brief.status === 'executing'
                              ? 'Executando DAG'
                              : brief.status === 'qa_homologation'
                              ? 'Lab QA (Auditando)'
                              : brief.status === 'rework'
                              ? 'Retrabalho QA (1/1)'
                              : brief.status === 'error'
                              ? 'Erro na API'
                              : 'Concluído'}
                          </span>
                        </div>

                        {brief.sharedContract && (
                          <div className="bg-slate-950/70 border border-sky-500/30 p-2 text-[11px] text-sky-200 space-y-0.5">
                            <div className="font-mono text-[10px] text-sky-400 uppercase">
                              Contrato da War Room
                            </div>
                            <div className="line-clamp-2 whitespace-pre-wrap">
                              {brief.sharedContract}
                            </div>
                          </div>
                        )}

                        {brief.apiError && (
                          <div className="bg-rose-950/60 border border-rose-500/70 p-2.5 text-xs text-rose-200 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <div className="font-semibold text-rose-100">
                                Falha na requisição real do Atlas (Fallback desativado)
                              </div>
                              <div className="font-mono text-[11px] break-all">{brief.apiError}</div>
                            </div>
                          </div>
                        )}

                        {brief.subTasks.length > 0 && (
                          <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/60">
                            {brief.subTasks.map((st) => {
                              const badge = formatSubTaskStatus(st.status);
                              const assignee = st.assignedAgentId
                                ? agents.find((a) => a.id === st.assignedAgentId)
                                : null;
                              const pStep = brief.pipelineSteps?.find((p) => p.id === st.id);
                              const depStep = st.dependsOnStepId
                                ? brief.pipelineSteps?.find((p) => p.id === st.dependsOnStepId)
                                : null;
                              const stepTokens =
                                (pStep?.inputTokens ?? st.inputTokens ?? 0) +
                                (pStep?.outputTokens ?? st.outputTokens ?? 0);
                              return (
                                <div
                                  key={st.id}
                                  className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="text-slate-200 truncate">
                                      {st.stepOrder ? (
                                        <span className="font-mono text-slate-500 mr-1.5">
                                          Passo {st.stepOrder} ·
                                        </span>
                                      ) : null}
                                      {st.title}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      Ilha {st.department}
                                      {assignee ? ` · ${assignee.name}` : ' · Sem especialista'}
                                      {depStep ? ` · dep. Passo ${depStep.stepOrder}` : ''}
                                      {stepTokens > 0
                                        ? ` · ${stepTokens.toLocaleString('pt-BR')} tok`
                                        : ''}
                                    </div>
                                    {st.apiError && (
                                      <div className="font-mono text-[11px] text-rose-300 mt-0.5 break-all">
                                        {st.apiError}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`font-mono text-[11px] shrink-0 ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {brief.qaAudit && (
                          <div className="bg-slate-950/70 border border-emerald-500/30 p-2 text-[11px] text-slate-300 flex items-center justify-between gap-2">
                            <span className="truncate">
                              <span className="font-mono text-emerald-400 mr-1.5">
                                Lab QA ({brief.qaAudit.reviewerName}):
                              </span>
                              {brief.qaAudit.findings}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              {brief.qaAudit.verdict ? `${brief.qaAudit.verdict} · ` : ''}Ciclo{' '}
                              {brief.qaAudit.reworkCycleUsed}/1
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* TAB 2: CAIXA DE SAÍDA (DELIVERED ARTIFACTS) */
            <div className="space-y-4">
              {deliveredArtifacts.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-700 p-6 text-center space-y-2">
                  <Inbox className="w-6 h-6 text-slate-500 mx-auto" />
                  <div className="text-sm font-semibold text-slate-200">
                    Caixa de Saída vazia
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Quando um agente concluir sua subtarefa, ele passará pelo Laboratório de QA e caminhará até a mesa da Diretoria para depositar o artefato aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Lista de entregas */}
                  <div className="space-y-1.5 border border-slate-800 bg-slate-950/60 p-2 max-h-[55vh] overflow-y-auto custom-scroll">
                    {deliveredArtifacts.map((art) => {
                      const isSel = activeArtifact?.id === art.id;
                      return (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => {
                            setSelectedArtifactId(art.id);
                            if (!art.readByCeo) markArtifactRead(art.id);
                          }}
                          className={`w-full text-left p-2.5 border transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-slate-800 border-emerald-400 text-white'
                              : 'bg-slate-900/70 border-slate-800 hover:border-slate-600 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`font-mono text-[10px] ${
                                art.apiError ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {art.apiError ? `${art.department} · ERRO` : art.department}
                            </span>
                            {!art.readByCeo && (
                              <span className="font-mono text-[10px] text-amber-300 font-bold">
                                NOVA
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold truncate mt-0.5">{art.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {art.agentName} · {art.deliveredAt}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Leitor Markdown Multi-Setor */}
                  {activeArtifact && (() => {
                    const sections = activeArtifact.sections ?? [];
                    const activeSection =
                      sections.find((s) => s.id === selectedSectionId) ?? sections[0] ?? null;
                    const displayedMarkdown = activeSection
                      ? activeSection.markdownContent
                      : activeArtifact.markdownContent;

                    return (
                      <div className="md:col-span-2 border border-slate-700 bg-slate-950/80 flex flex-col max-h-[55vh]">
                        <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/70">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {activeArtifact.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                              {activeArtifact.apiError ? (
                                <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                                  <AlertTriangle className="w-3 h-3" />
                                  Erro na API (Não Homologado)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  QA Homologado
                                </span>
                              )}
                              <span>·</span>
                              <span>{activeSection ? activeSection.model : activeArtifact.model}</span>
                              <span>·</span>
                              <span>
                                {activeArtifact.usedFallback
                                  ? 'Simulação (0 tokens)'
                                  : activeArtifact.apiError
                                  ? '0 tokens faturados'
                                  : `${(
                                      activeArtifact.inputTokens + activeArtifact.outputTokens
                                    ).toLocaleString('pt-BR')} tokens (${activeArtifact.inputTokens} in / ${activeArtifact.outputTokens} out · $${activeArtifact.estimatedCostUsd.toFixed(
                                      4
                                    )})`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyMarkdown(activeArtifact.id, displayedMarkdown)
                              }
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === activeArtifact.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar .md</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadMarkdown(
                                  activeArtifact.title,
                                  activeArtifact.markdownContent
                                )
                              }
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>
                                {sections.length > 0
                                  ? 'Exportar Pacote Completo (.md)'
                                  : 'Baixar (.md)'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {sections.length > 0 && (
                          <div className="px-3 pt-2 border-b border-slate-800 flex items-center gap-1 overflow-x-auto custom-scroll bg-slate-900/40 shrink-0">
                            {sections.map((sec) => {
                              const isSecActive = activeSection?.id === sec.id;
                              return (
                                <button
                                  key={sec.id}
                                  type="button"
                                  onClick={() => setSelectedSectionId(sec.id)}
                                  className={`px-2.5 py-1.5 text-[11px] font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                                    isSecActive
                                      ? 'border-emerald-400 text-emerald-300 bg-slate-800/70'
                                      : 'border-transparent text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {sec.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {activeSection && (
                          <div className="px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/30 flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
                            <span>
                              Autor: <span className="text-slate-200">{activeSection.agentName}</span>
                            </span>
                            <span>
                              {(activeSection.inputTokens + activeSection.outputTokens).toLocaleString(
                                'pt-BR'
                              )}{' '}
                              tokens · ${activeSection.estimatedCostUsd.toFixed(4)}
                            </span>
                          </div>
                        )}

                        {activeArtifact.apiError && (
                          <div className="mx-3 mt-3 bg-rose-950/70 border border-rose-500/80 p-2.5 text-xs text-rose-200 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="font-mono text-[11px] break-all">
                              {activeArtifact.apiError}
                            </div>
                          </div>
                        )}

                        <pre className="flex-1 overflow-y-auto custom-scroll p-3.5 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {displayedMarkdown}
                        </pre>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
