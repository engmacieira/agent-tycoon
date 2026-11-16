import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { useOffice } from '../context/OfficeContext';
import {
  DEFAULT_MODEL_ID,
  MODEL_OPTIONS,
  estimateCostPer1k,
  migrateLegacyModelId,
} from '../engine/llmClient';
import { AgentModelId } from '../types/office';

export const HiringModal: React.FC = () => {
  const {
    hiringModalOpen,
    closeHiringModal,
    pendingRequisitions,
    approveJobRequisition,
    rejectJobRequisition,
  } = useOffice();

  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AgentModelId>(DEFAULT_MODEL_ID);
  const [customModelMode, setCustomModelMode] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  const activeReq =
    pendingRequisitions.find((r) => r.id === selectedReqId) ?? pendingRequisitions[0] ?? null;

  useEffect(() => {
    if (activeReq) {
      const migrated = migrateLegacyModelId(activeReq.recommendedModel) as AgentModelId;
      const isPreset = MODEL_OPTIONS.some((m) => m.id === migrated);
      setSelectedModel(migrated);
      setCustomModelMode(!isPreset);
      setApiKeyInput('');
      setShowKey(false);
    }
  }, [activeReq?.id]);

  useEffect(() => {
    if (!hiringModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeHiringModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hiringModalOpen, closeHiringModal]);

  if (!hiringModalOpen) return null;

  const currentCost1k = estimateCostPer1k(selectedModel);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ritual de Contratação Dinâmica"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeHiringModal();
      }}
    >
      <div className="w-full max-w-2xl max-h-[88vh] bg-[#0F172A] border-2 border-amber-500/80 pixel-panel flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/80">
          <div>
            <div className="text-[11px] font-mono text-amber-400">
              PORTA DA DIRETORIA · ALERTA DE GARGALO (ATLAS + VEGA)
            </div>
            <h2 className="font-pixel text-sm sm:text-base text-white mt-0.5 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Aprovação de Contratação</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={closeHiringModal}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 cursor-pointer"
            aria-label="Fechar janela de contratação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-4 font-sans">
          {!activeReq ? (
            <div className="bg-slate-900/70 border border-slate-700 p-6 text-center space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <div className="text-sm font-semibold text-white">Nenhuma vaga pendente</div>
              <p className="text-xs text-slate-400">
                Todas as requisições de contratação foram processadas.
              </p>
            </div>
          ) : (
            <>
              {/* Queue selector if multiple vacancies */}
              {pendingRequisitions.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {pendingRequisitions.map((req, idx) => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => setSelectedReqId(req.id)}
                      className={`px-2.5 py-1 text-xs font-mono border shrink-0 cursor-pointer ${
                        req.id === activeReq.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Vaga {idx + 1}: {req.department}
                    </button>
                  ))}
                </div>
              )}

              {/* Atlas Proposal */}
              <section className="bg-slate-900/80 border border-slate-700 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-sky-400 font-semibold">
                    PROPOSTA DO ATLAS (TECH LEAD & RH)
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    Ilha {activeReq.department}
                  </span>
                </div>

                <div className="text-base font-bold text-white">{activeReq.title}</div>
                <p className="text-xs text-slate-300 leading-relaxed">{activeReq.justification}</p>

                <div className="bg-slate-950/70 border border-slate-800 p-2.5 space-y-1">
                  <div className="text-[11px] font-mono text-slate-400">
                    DNA Prompt gerado para o especialista:
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {activeReq.generatedDnaPrompt}
                  </p>
                </div>
              </section>

              {/* Vega FinOps Review */}
              <section className="bg-slate-900/80 border border-emerald-500/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" />
                    <span>PARECER DO VEGA (FINOPS)</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-emerald-300">
                    ~${currentCost1k.toFixed(4)} / 1k tokens
                  </span>
                </div>

                {activeReq.finopsReview.alertMessage ? (
                  <div className="flex flex-wrap items-start justify-between gap-3 bg-amber-500/10 border border-amber-500/40 p-2.5">
                    <div className="flex items-start gap-2 text-xs text-amber-200 flex-1 min-w-[220px]">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{activeReq.finopsReview.alertMessage}</span>
                    </div>
                    {selectedModel !== activeReq.finopsReview.recommendedBudgetModel && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomModelMode(false);
                          setSelectedModel(activeReq.finopsReview.recommendedBudgetModel);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        Usar {activeReq.finopsReview.recommendedBudgetModel}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-300">
                    Custo validado pelo FinOps. Modelo leve ideal para manter o orçamento controlado.
                  </p>
                )}
              </section>

              {/* Model Selection + .env Key Input */}
              <section className="bg-slate-900/80 border border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Credencial no Cofre .env</span>
                  </span>
                  <code className="font-mono text-emerald-300 font-semibold">
                    {activeReq.suggestedEnvVar}
                  </code>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="hire-model-select" className="block text-xs text-slate-300">
                    Modelo contratado
                  </label>
                  <select
                    id="hire-model-select"
                    value={customModelMode ? '__custom__' : selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setCustomModelMode(true);
                      } else {
                        setCustomModelMode(false);
                        setSelectedModel(val as AgentModelId);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                    <option value="__custom__">ID de Modelo Customizado...</option>
                  </select>

                  {customModelMode && (
                    <input
                      type="text"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value as AgentModelId)}
                      placeholder="Digite o ID do modelo customizado..."
                      aria-label="ID de Modelo Customizado"
                      className="w-full bg-slate-950 border border-amber-500/60 px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="hire-api-key" className="text-xs text-slate-300">
                      API Key para {activeReq.suggestedEnvVar}
                    </label>
                    {apiKeyInput.trim() === '' ? (
                      <button
                        type="button"
                        onClick={() => setApiKeyInput('FALLBACK_TEST_KEY')}
                        className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Modo Fallback (sem chave)</span>
                      </button>
                    ) : apiKeyInput === 'FALLBACK_TEST_KEY' ? (
                      <button
                        type="button"
                        onClick={() => setApiKeyInput('')}
                        className="text-[11px] font-mono text-amber-300 hover:text-amber-200 cursor-pointer"
                      >
                        Limpar Modo Fallback
                      </button>
                    ) : null}
                  </div>

                  <div className="relative">
                    <input
                      id="hire-api-key"
                      type={showKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Cole a API Key real (ou deixe vazio para Modo Fallback)..."
                      className="w-full bg-slate-950 border border-slate-700 pl-3 pr-9 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    {apiKeyInput === 'FALLBACK_TEST_KEY' || apiKeyInput.trim() === ''
                      ? 'Campo vazio / Modo Fallback: o agente executará em simulação local (0 tokens) sem chamar API externa.'
                      : 'Chave real informada: o agente executará requisições reais e reportará qualquer erro da API caso a chave ou modelo falhe.'}
                  </p>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        {activeReq && (
          <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => rejectJobRequisition(activeReq.id)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-rose-900/50 border border-slate-700 text-xs text-slate-300 hover:text-rose-200 transition-colors cursor-pointer"
            >
              Recusar Vaga
            </button>

            <button
              type="button"
              onClick={() => approveJobRequisition(activeReq.id, selectedModel, apiKeyInput)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Assinar Contrato & Contratar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
