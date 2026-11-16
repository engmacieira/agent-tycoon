import {
  Agent,
  AgentModelId,
  DepartmentIsland,
  FinopsReview,
  KnownAgentModelId,
  QaVerdict,
  RoomId,
  SubTask,
  TaskPriority,
} from '../types/office';

export const DEPARTMENT_TO_ROOM: Record<DepartmentIsland, RoomId> = {
  Backend: 'backend',
  Frontend: 'frontend',
  Administrativo: 'admin',
  Marketing: 'marketing',
  QA: 'qa-lab',
};

export const DEFAULT_MODEL_ID: KnownAgentModelId = 'gemini-3-flash-preview';

export const LEGACY_MODEL_MIGRATION_MAP: Record<string, KnownAgentModelId> = {
  'gemini-2.5-pro': 'gemini-3.1-pro-preview',
  'gemini-2.5-flash': 'gemini-3-flash-preview',
  'gemini-2.5-flash-lite': 'gemini-3.1-flash-lite-preview',
  'claude-sonnet': 'claude-sonnet-4-5',
};

export function migrateLegacyModelId(model?: string | null): string {
  const trimmed = typeof model === 'string' ? model.trim() : '';
  if (!trimmed) return DEFAULT_MODEL_ID;
  return LEGACY_MODEL_MIGRATION_MAP[trimmed] ?? trimmed;
}

export const MODEL_OPTIONS: Array<{ id: KnownAgentModelId; label: string }> = [
  { id: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview (Raciocínio & Arquitetura)' },
  { id: 'gemini-3-flash-preview', label: 'gemini-3-flash-preview (Velocidade & Qualidade)' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'gemini-3.1-flash-lite-preview (Ultra-rápido & Econômico)' },
  { id: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5 (Código & Texto Anthropic)' },
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini (Rápido OpenAI)' },
];

export const MODEL_PRICING_PER_1M: Record<
  string,
  { inputPer1MUsd: number; outputPer1MUsd: number }
> = {
  'gemini-3.1-pro-preview': { inputPer1MUsd: 2.0, outputPer1MUsd: 12.0 },
  'gemini-3-flash-preview': { inputPer1MUsd: 0.5, outputPer1MUsd: 3.0 },
  'gemini-3.1-flash-lite-preview': { inputPer1MUsd: 0.1, outputPer1MUsd: 0.4 },
  'claude-sonnet-4-5': { inputPer1MUsd: 3.0, outputPer1MUsd: 15.0 },
  'gpt-4o-mini': { inputPer1MUsd: 0.15, outputPer1MUsd: 0.6 },
};

export const MODEL_PRICING_PER_1K: Record<
  string,
  { inputUsd: number; outputUsd: number; avg1kUsd: number }
> = Object.fromEntries(
  Object.entries(MODEL_PRICING_PER_1M).map(([modelId, rates]) => {
    const inputUsd = rates.inputPer1MUsd / 1000;
    const outputUsd = rates.outputPer1MUsd / 1000;
    const avg1kUsd = Number(((inputUsd + outputUsd) / 2).toFixed(6));
    return [modelId, { inputUsd, outputUsd, avg1kUsd }];
  })
);

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const normalized = migrateLegacyModelId(model);
  const rate = MODEL_PRICING_PER_1K[normalized] ?? MODEL_PRICING_PER_1K[DEFAULT_MODEL_ID];
  const cost = (inputTokens / 1000) * rate.inputUsd + (outputTokens / 1000) * rate.outputUsd;
  return Number(cost.toFixed(6));
}

export function estimateCostPer1k(model: string): number {
  const normalized = migrateLegacyModelId(model);
  return (MODEL_PRICING_PER_1K[normalized] ?? MODEL_PRICING_PER_1K[DEFAULT_MODEL_ID]).avg1kUsd;
}

interface UsageMetadataPayload {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface ProxyLlmResponse {
  ok: boolean;
  text?: string;
  finishReason?: string;
  usageMetadata?: UsageMetadataPayload;
  inputTokens?: number;
  outputTokens?: number;
  fallbackRecommended?: boolean;
  status?: number;
  apiError?: string;
  error?: string;
}

export function isRealApiKeyConfigured(apiKey?: string): boolean {
  if (!apiKey) return false;
  const trimmed = apiKey.trim();
  return trimmed.length > 0 && trimmed !== 'FALLBACK_TEST_KEY';
}

function resolveMaxOutputTokens(model: string): number {
  const normalized = migrateLegacyModelId(model);
  if (normalized === 'gemini-3.1-pro-preview' || normalized === 'gemini-3-flash-preview') {
    return 16384;
  }
  return 8192;
}

async function callServerLlm(params: {
  model: string;
  systemInstruction: string;
  prompt: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  envVarName?: string;
  clientApiKey?: string;
}): Promise<ProxyLlmResponse> {
  // Only enter Simulation/Fallback mode when the API key field is explicitly empty or marked as fallback test
  if (!isRealApiKeyConfigured(params.clientApiKey)) {
    return { ok: false, fallbackRecommended: true, error: 'EMPTY_KEY_FALLBACK' };
  }

  const normalizedModel = migrateLegacyModelId(params.model);
  const maxOutputTokens = params.maxOutputTokens ?? resolveMaxOutputTokens(normalizedModel);

  try {
    const res = await fetch('/api/llm/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, model: normalizedModel, maxOutputTokens }),
    });

    let payload: ProxyLlmResponse | null = null;
    try {
      payload = (await res.json()) as ProxyLlmResponse;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        fallbackRecommended: false,
        status: res.status,
        apiError: payload?.apiError || `[Erro API ${res.status}: Falha HTTP na chamada ao provedor]`,
        error: payload?.error || `HTTP_${res.status}`,
      };
    }

    if (!payload || !payload.ok) {
      return {
        ok: false,
        fallbackRecommended: false,
        status: payload?.status,
        apiError: payload?.apiError || `[Erro API: ${payload?.error || 'Resposta inválida do servidor'}]`,
        error: payload?.error || 'API_CALL_FAILED',
      };
    }

    return payload;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Erro de rede';
    return {
      ok: false,
      fallbackRecommended: false,
      apiError: `[Erro API Rede: ${detail}]`,
      error: 'NETWORK_ERROR',
    };
  }
}

export interface AnalyzedSubTaskPlan {
  stepId: string;
  stepOrder: number;
  dependsOnStepId: string | null;
  title: string;
  description: string;
  department: DepartmentIsland;
  recommendedRoleTitle: string;
  recommendedModel: AgentModelId;
  justification: string;
  generatedDnaPrompt: string;
}

export interface AtlasAnalysisResult {
  summary: string;
  subTasks: AnalyzedSubTaskPlan[];
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  apiError?: string;
}

function buildFallbackAnalysis(promptText: string, priority: TaskPriority): AnalyzedSubTaskPlan[] {
  const lower = promptText.toLowerCase();
  const plans: AnalyzedSubTaskPlan[] = [];

  const needsBackend =
    /sql|banco|schema|esquema|api|backend|servidor|python|fastapi|node|saúde|saude|dados|endpoint|full-stack|fullstack|sistema/.test(
      lower
    );
  const needsFrontend =
    /front|ui|ux|tela|interface|react|dashboard|página|pagina|design|css|landing|componente|full-stack|fullstack/.test(
      lower
    );
  const needsAdmin =
    /contrato|planilha|documento|admin|compliance|relatório|relatorio|política|politica|processo/.test(
      lower
    );
  const needsMarketing =
    /marketing|campanha|copy|lançamento|lancamento|seo|anúncio|anuncio|post|divulgação|divulgacao/.test(
      lower
    );
  const explicitQa = /qa|teste|testes|homolog|auditoria|revisão|revisao|qualidade|validar/.test(lower);

  let order = 1;
  let lastStepId: string | null = null;

  if (needsBackend || (!needsFrontend && !needsAdmin && !needsMarketing)) {
    const isPython = /python|fastapi|pydantic|sqlalchemy/.test(lower);
    const stepId = `step-${order}`;
    plans.push({
      stepId,
      stepOrder: order,
      dependsOnStepId: null,
      title: `Arquitetura & Contrato Backend: ${promptText.slice(0, 42)}`,
      description: `Definir contrato de dados/rotas e implementar integralmente a camada Backend para: "${promptText}".`,
      department: 'Backend',
      recommendedRoleTitle: isPython ? 'Engenheiro Backend Python/FastAPI' : 'Engenheiro Backend Sênior',
      recommendedModel:
        priority === 'critica' || /sql|arquitetura|sistema|python|fastapi/.test(lower)
          ? 'gemini-3.1-pro-preview'
          : 'gemini-3-flash-preview',
      justification:
        'Ilha Backend responsável pelo modelo relacional, contratos JSON e APIs.',
      generatedDnaPrompt: isPython
        ? 'Você é um Engenheiro Backend Sênior especialista em Python, FastAPI, Pydantic v2 e SQLAlchemy. Entregue sempre o código-fonte completo, funcional e pronto para produção, sem resumos genéricos ou placeholders.'
        : 'Você é um Engenheiro Backend especialista em modelagem relacional, APIs seguras e qualidade de código. Entregue sempre o código completo e pronto para uso, sem resumos genéricos.',
    });
    lastStepId = stepId;
    order += 1;
  }

  if (needsFrontend) {
    const stepId = `step-${order}`;
    plans.push({
      stepId,
      stepOrder: order,
      dependsOnStepId: lastStepId,
      title: `Interface & Integração Frontend`,
      description: `Construir código completo de componentes UI, tipagem e integração consumindo o contrato anterior para: "${promptText}".`,
      department: 'Frontend',
      recommendedRoleTitle: 'Engenheiro Frontend UI/UX',
      recommendedModel: 'gemini-3-flash-preview',
      justification:
        'Ilha Frontend responsável pela interface web consumindo os contratos definidos.',
      generatedDnaPrompt:
        'Você é um Engenheiro Frontend especialista em React, TypeScript e Tailwind CSS. Entregue o código completo dos componentes e fluxos acessíveis integrados ao contrato da War Room.',
    });
    lastStepId = stepId;
    order += 1;
  }

  if (needsAdmin) {
    const stepId = `step-${order}`;
    plans.push({
      stepId,
      stepOrder: order,
      dependsOnStepId: lastStepId,
      title: `Documentação, Processos & Conformidade`,
      description: `Estruturar plano documental completo e matriz de conformidade integrada para: "${promptText}".`,
      department: 'Administrativo',
      recommendedRoleTitle: 'Analista Administrativo & Processos',
      recommendedModel: 'gemini-3.1-flash-lite-preview',
      justification:
        'Ilha Administrativo necessária para governança documental e checklists operacionais.',
      generatedDnaPrompt:
        'Você é um Analista Administrativo & Processos. Entregue planos operacionais, checklists detalhados e documentos executivos completos e aplicáveis.',
    });
    lastStepId = stepId;
    order += 1;
  }

  if (needsMarketing) {
    const stepId = `step-${order}`;
    plans.push({
      stepId,
      stepOrder: order,
      dependsOnStepId: lastStepId,
      title: `Estratégia de Lançamento & Copy`,
      description: `Redigir posicionamento, mensagens finais prontas para publicação e plano de campanha para: "${promptText}".`,
      department: 'Marketing',
      recommendedRoleTitle: 'Estrategista de Marketing & Copy',
      recommendedModel: 'gemini-3-flash-preview',
      justification:
        'Ilha Marketing responsável pelo posicionamento e comunicação da entrega.',
      generatedDnaPrompt:
        'Você é um Estrategista de Marketing e Copywriter. Entregue textos finais completos, cronogramas e métricas prontas para execução.',
    });
    lastStepId = stepId;
    order += 1;
  }

  // Add QA homologation step automatically for multi-sector plans or explicit QA/test requests
  if (plans.length >= 2 || explicitQa) {
    const stepId = `step-${order}`;
    plans.push({
      stepId,
      stepOrder: order,
      dependsOnStepId: lastStepId,
      title: `Homologação Integrada & Testes no Lab QA`,
      description: `Auditar consistência entre os entregáveis, validar contratos, casos de borda e emitir parecer final de homologação para: "${promptText}".`,
      department: 'QA',
      recommendedRoleTitle: 'Analista de QA & Homologação',
      recommendedModel: 'gemini-3-flash-preview',
      justification:
        'Laboratório de QA necessário para homologar a integração e prevenir regressões antes da entrega à Diretoria.',
      generatedDnaPrompt:
        'Você é um Analista Sênior de QA e Homologação. Audite contratos, segurança, tipagem e aderência ao briefing do CEO com rigor técnico objetivo.',
    });
  }

  return plans.slice(0, 4);
}

export async function analyzeBriefingWithAtlas(params: {
  atlas: Agent;
  briefingPrompt: string;
  priority: TaskPriority;
  atlasApiKey?: string;
}): Promise<AtlasAnalysisResult> {
  const { atlas, briefingPrompt, priority, atlasApiKey } = params;
  const model = migrateLegacyModelId((atlas.model as string) || 'gemini-3.1-pro-preview');
  const hasRealKey = isRealApiKeyConfigured(atlasApiKey);

  const systemInstruction = `${atlas.dnaPrompt ?? atlas.systemPrompt ?? ''}
Preserve integralmente na descrição das subtarefas e no generatedDnaPrompt as linguagens, frameworks e requisitos exatos pedidos pelo CEO (ex: Python, FastAPI, PostgreSQL, React, etc.).
Para demandas multi-setor ou que envolvam revisão de qualidade, estruture um DAG sequencial/paralelo com stepOrder, dependsOnStepId e uma etapa final no departamento "QA" para homologação no Laboratório de QA.
Responda APENAS em JSON válido no formato:
{
  "summary": "resumo curto em português",
  "subTasks": [
    {
      "stepId": "step-1",
      "stepOrder": 1,
      "dependsOnStepId": null,
      "title": "título objetivo",
      "description": "especificação fiel ao escopo e stack solicitada pelo CEO",
      "department": "Backend" | "Frontend" | "Administrativo" | "Marketing" | "QA",
      "recommendedRoleTitle": "nome do cargo",
      "recommendedModel": "gemini-3.1-pro-preview" | "gemini-3-flash-preview" | "gemini-3.1-flash-lite-preview",
      "justification": "por que essa ilha é necessária",
      "generatedDnaPrompt": "system prompt instruindo o especialista a entregar o código/artefato final completo na stack pedida"
    }
  ]
}`;

  const prompt = `Prioridade: ${priority.toUpperCase()}\nBriefing do CEO:\n${briefingPrompt}\nQuebre em 1 a 4 passos ordenados (DAG) mantendo fielmente todas as tecnologias pedidas. Inclua "QA" como último passo quando houver múltiplos setores ou testes/homologação.`;

  const res = await callServerLlm({
    model,
    systemInstruction,
    prompt,
    responseMimeType: 'application/json',
    envVarName: atlas.apiKeyEnvVar,
    clientApiKey: atlasApiKey,
  });

  if (hasRealKey) {
    if (!res.ok || !res.text) {
      const apiError = res.apiError || `[Erro API: ${res.error || 'Falha desconhecida'}]`;
      return {
        summary: apiError,
        subTasks: [],
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        usedFallback: false,
        apiError,
      };
    }

    try {
      const cleaned = res.text.replace(/```json\s*|\s*```/g, '').trim();
      const parsed = JSON.parse(cleaned) as {
        summary?: string;
        subTasks?: Array<Partial<AnalyzedSubTaskPlan>>;
      };
      if (Array.isArray(parsed.subTasks) && parsed.subTasks.length > 0) {
        const validDepts = new Set<DepartmentIsland>([
          'Backend',
          'Frontend',
          'Administrativo',
          'Marketing',
          'QA',
        ]);
        const sliced = parsed.subTasks.slice(0, 4);
        const normalized: AnalyzedSubTaskPlan[] = sliced.map((st, idx) => {
          const dept = st.department && validDepts.has(st.department) ? st.department : 'Backend';
          const stepOrder = typeof st.stepOrder === 'number' && st.stepOrder > 0 ? st.stepOrder : idx + 1;
          const stepId = st.stepId || `step-${idx + 1}`;
          return {
            stepId,
            stepOrder,
            dependsOnStepId:
              typeof st.dependsOnStepId === 'string' && st.dependsOnStepId !== stepId
                ? st.dependsOnStepId
                : null,
            title: st.title || 'Subtarefa Operacional',
            description: st.description || briefingPrompt,
            department: dept,
            recommendedRoleTitle: st.recommendedRoleTitle || `Especialista ${dept}`,
            recommendedModel: migrateLegacyModelId(
              st.recommendedModel || DEFAULT_MODEL_ID
            ) as AgentModelId,
            justification: st.justification || 'Necessário para atendimento do escopo.',
            generatedDnaPrompt:
              st.generatedDnaPrompt ||
              `Você é um especialista de ${dept}. Entregue sempre o código ou artefato final completo e pronto para uso, evitando resumos genéricos.`,
          };
        });

        // Sort by stepOrder and ensure dependsOnStepId references an earlier valid stepId
        normalized.sort((a, b) => a.stepOrder - b.stepOrder);
        const seenIds = new Set<string>();
        for (const item of normalized) {
          if (item.dependsOnStepId && !seenIds.has(item.dependsOnStepId)) {
            item.dependsOnStepId = null;
          }
          seenIds.add(item.stepId);
        }

        const inTok = res.usageMetadata?.promptTokenCount ?? res.inputTokens ?? 0;
        const outTok = res.usageMetadata?.candidatesTokenCount ?? res.outputTokens ?? 0;
        return {
          summary: parsed.summary || 'Escopo analisado por Atlas.',
          subTasks: normalized,
          inputTokens: inTok,
          outputTokens: outTok,
          estimatedCostUsd: estimateCostUsd(model, inTok, outTok),
          usedFallback: false,
        };
      }

      const formatErr = '[Erro API: Modelo retornou JSON sem subtarefas válidas]';
      return {
        summary: formatErr,
        subTasks: [],
        inputTokens: res.usageMetadata?.promptTokenCount ?? res.inputTokens ?? 0,
        outputTokens: res.usageMetadata?.candidatesTokenCount ?? res.outputTokens ?? 0,
        estimatedCostUsd: estimateCostUsd(
          model,
          res.usageMetadata?.promptTokenCount ?? res.inputTokens ?? 0,
          res.usageMetadata?.candidatesTokenCount ?? res.outputTokens ?? 0
        ),
        usedFallback: false,
        apiError: formatErr,
      };
    } catch {
      const parseErr = '[Erro API: Resposta do modelo não pôde ser interpretada como JSON]';
      return {
        summary: parseErr,
        subTasks: [],
        inputTokens: res.usageMetadata?.promptTokenCount ?? res.inputTokens ?? 0,
        outputTokens: res.usageMetadata?.candidatesTokenCount ?? res.outputTokens ?? 0,
        estimatedCostUsd: 0,
        usedFallback: false,
        apiError: parseErr,
      };
    }
  }

  // Simulation / Fallback Mode (explicitly empty API key or FALLBACK_TEST_KEY)
  const fallbackSubTasks = buildFallbackAnalysis(briefingPrompt, priority);
  return {
    summary: `Modo Simulação/Fallback: Atlas dividiu a demanda em ${fallbackSubTasks.length} frente(s).`,
    subTasks: fallbackSubTasks,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    usedFallback: true,
  };
}

export function generateVegaFinopsReview(params: {
  department: DepartmentIsland;
  recommendedModel: AgentModelId;
  subTaskTitle: string;
}): FinopsReview {
  const { department, recommendedModel, subTaskTitle } = params;
  const normalizedModel = migrateLegacyModelId(recommendedModel);
  const cost1k = estimateCostPer1k(normalizedModel);
  const isExpensive =
    normalizedModel === 'gemini-3.1-pro-preview' || normalizedModel === 'claude-sonnet-4-5';
  const isComplexBackend =
    department === 'Backend' &&
    /sql|arquitetura|esquema|segurança|sistema|api/i.test(subTaskTitle);
  const budgetTarget: KnownAgentModelId =
    department === 'Administrativo' ? 'gemini-3.1-flash-lite-preview' : 'gemini-3-flash-preview';
  const budgetCost1k = estimateCostPer1k(budgetTarget);
  const savingsPct = cost1k > 0 ? Math.max(1, Math.round((1 - budgetCost1k / cost1k) * 100)) : 75;

  if (isExpensive && !isComplexBackend) {
    return {
      estimatedCostPer1kTokensUsd: cost1k,
      recommendedBudgetModel: budgetTarget,
      alertMessage: `Alerta Vega FinOps: "${normalizedModel}" custa ~$${cost1k.toFixed(
        4
      )}/1k tokens. Para ${department}, recomendo "${budgetTarget}" (~$${budgetCost1k.toFixed(
        4
      )}/1k, economia de ~${savingsPct}%).`,
      approvedByVega: true,
    };
  }

  if (isExpensive && isComplexBackend) {
    return {
      estimatedCostPer1kTokensUsd: cost1k,
      recommendedBudgetModel: 'gemini-3-flash-preview',
      alertMessage: `Parecer Vega FinOps: "${normalizedModel}" (~$${cost1k.toFixed(
        4
      )}/1k) justificado pela complexidade técnica, mas você pode alternar para "gemini-3-flash-preview" (~$${estimateCostPer1k(
        'gemini-3-flash-preview'
      ).toFixed(4)}/1k) para economizar.`,
      approvedByVega: true,
    };
  }

  return {
    estimatedCostPer1kTokensUsd: cost1k,
    recommendedBudgetModel: normalizedModel as AgentModelId,
    alertMessage: undefined,
    approvedByVega: true,
  };
}

export interface WarRoomAlignmentResult {
  sharedContract: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  apiError?: string;
}

export async function alignContractInWarRoom(params: {
  atlas: Agent;
  briefingPrompt: string;
  steps: Array<{ stepOrder: number; department: DepartmentIsland; title: string }>;
  atlasApiKey?: string;
}): Promise<WarRoomAlignmentResult> {
  const { atlas, briefingPrompt, steps, atlasApiKey } = params;
  const model = migrateLegacyModelId((atlas.model as string) || 'gemini-3.1-pro-preview');
  const hasRealKey = isRealApiKeyConfigured(atlasApiKey);

  const stepsSummary = steps
    .map((s) => `${s.stepOrder}. [${s.department}] ${s.title}`)
    .join('\n');

  if (!hasRealKey) {
    const depts = Array.from(new Set(steps.map((s) => s.department))).join(' + ');
    return {
      sharedContract: `CONTRATO WAR ROOM (${depts}):
- Escopo unificado: ${briefingPrompt.slice(0, 120)}
- Padrão de integração: JSON camelCase/snake_case consistente, tipagem estrita e tratamento explícito de erros HTTP.
- Fluxo acordado: ${steps.map((s) => `${s.stepOrder}.${s.department}`).join(' -> ')}.`,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      usedFallback: true,
    };
  }

  const systemInstruction =
    'Você é Atlas conduzindo uma reunião rápida de alinhamento na War Room. Gere um contrato técnico ultra-enxuto (máximo 120 palavras / ~150 tokens) definindo rotas/interfaces, schemas JSON ou diretrizes comuns entre as ilhas participantes.';
  const prompt = `Briefing: ${briefingPrompt}\nEtapas da Squad:\n${stepsSummary}\n\nGere apenas o Contrato Compartilhado objetivo em bullet points curtos.`;

  const res = await callServerLlm({
    model,
    systemInstruction,
    prompt,
    envVarName: atlas.apiKeyEnvVar,
    clientApiKey: atlasApiKey,
  });

  if (!res.ok || !res.text) {
    const apiError = res.apiError || `[Erro API: ${res.error || 'Falha na War Room'}]`;
    return {
      sharedContract: `Falha no alinhamento War Room: ${apiError}`,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      usedFallback: false,
      apiError,
    };
  }

  const inTok = res.usageMetadata?.promptTokenCount ?? res.inputTokens ?? 0;
  const outTok = res.usageMetadata?.candidatesTokenCount ?? res.outputTokens ?? 0;

  return {
    sharedContract: res.text.trim(),
    inputTokens: inTok,
    outputTokens: outTok,
    estimatedCostUsd: estimateCostUsd(model, inTok, outTok),
    usedFallback: false,
  };
}

export interface ExecuteSubTaskResult {
  markdownOutput: string;
  summary: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  learnedFact: string;
  usedFallback: boolean;
  wasTruncated?: boolean;
  apiError?: string;
}

function buildFallbackDeliverable(
  agent: Agent,
  subTask: SubTask,
  sharedContract?: string,
  dependencyContext?: string,
  reworkFeedback?: string
): string {
  const lower = `${subTask.title} ${subTask.description}`.toLowerCase();
  const reworkBanner = reworkFeedback
    ? `\n> **Correção Aplicada (Lab QA):** ${reworkFeedback}\n`
    : '';
  const contractNote = sharedContract
    ? `\n> **Alinhamento War Room aplicado:** Contrato integrado com sucesso.\n`
    : '';
  const depNote = dependencyContext
    ? `\n> **Handoff Recebido:** Baseado na saída da etapa anterior.\n`
    : '';

  if (subTask.department === 'Backend') {
    if (/python|fastapi|pydantic|sqlalchemy/.test(lower)) {
      return `# ${subTask.title}
**Responsável:** ${agent.name} (${agent.role}) · **Ilha:** Backend · **Modo:** Simulação/Fallback (sem API Key)
${reworkBanner}${contractNote}
## Implementação Completa Python / FastAPI

\`\`\`python
from datetime import datetime, timezone
from uuid import UUID, uuid4
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

app = FastAPI(title="PixelHQ Backend Service", version="1.0.0")


class ItemCreate(BaseModel):
    nome: str = Field(..., min_length=2, max_length=120)
    descricao: str = Field(default="")


class ItemOut(ItemCreate):
    id: UUID
    is_active: bool = True
    created_at: datetime


_DB: dict[UUID, ItemOut] = {}


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate) -> ItemOut:
    item_id = uuid4()
    record = ItemOut(
        id=item_id,
        nome=payload.nome,
        descricao=payload.descricao,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    _DB[item_id] = record
    return record


@app.get("/items/{item_id}", response_model=ItemOut)
def get_item(item_id: UUID) -> ItemOut:
    record = _DB.get(item_id)
    if not record or not record.is_active:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return record
\`\`\`
`;
    }

    if (/saúde|saude|sql|banco|esquema/.test(lower)) {
      return `# ${subTask.title}
**Responsável:** ${agent.name} (${agent.role}) · **Ilha:** Backend · **Modo:** Simulação/Fallback (sem API Key)
${reworkBanner}${contractNote}
## 1. Esquema Relacional PostgreSQL (Sistema de Saúde)

\`\`\`sql
CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo VARCHAR(160) NOT NULL,
  cpf CHAR(11) UNIQUE NOT NULL,
  data_nascimento DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profissionais_saude (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(160) NOT NULL,
  registro_conselho VARCHAR(32) UNIQUE NOT NULL,
  especialidade VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  profissional_id UUID NOT NULL REFERENCES profissionais_saude(id),
  data_hora TIMESTAMPTZ NOT NULL,
  triagem_prioridade VARCHAR(16) NOT NULL CHECK (triagem_prioridade IN ('baixa', 'media', 'alta', 'emergencia')),
  status VARCHAR(24) NOT NULL DEFAULT 'agendado',
  observacoes_clinicas TEXT
);

CREATE INDEX idx_atendimentos_paciente ON atendimentos(paciente_id, data_hora DESC);
\`\`\`
`;
    }

    return `# ${subTask.title}
**Responsável:** ${agent.name} (${agent.role}) · **Ilha:** Backend · **Modo:** Simulação/Fallback (sem API Key)
${reworkBanner}${contractNote}
## Contrato & Implementação Backend
- **Escopo:** ${subTask.description}

\`\`\`ts
export interface TaskResultDTO {
  id: string;
  status: 'ok' | 'error';
  processedAt: string;
}
\`\`\`
`;
  }

  if (subTask.department === 'Frontend') {
    return `# ${subTask.title}
**Responsável:** ${agent.name} (${agent.role}) · **Ilha:** Frontend · **Modo:** Simulação/Fallback (sem API Key)
${reworkBanner}${contractNote}${depNote}
## Interface React Integrada ao Contrato

\`\`\`tsx
import React, { useState } from 'react';

export const IntegratedView: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  return (
    <section className="p-4 border border-slate-700 bg-slate-900 text-slate-100">
      <h2 className="text-sm font-bold">${subTask.title}</h2>
      <p className="text-xs text-slate-300 mt-1">${subTask.description}</p>
      <button
        type="button"
        onClick={() => setStatus('done')}
        className="mt-3 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold"
      >
        {status === 'done' ? 'Sincronizado' : 'Executar Ação'}
      </button>
    </section>
  );
};
\`\`\`
`;
  }

  if (subTask.department === 'Administrativo') {
    return `# ${subTask.title}
**Responsável:** ${agent.name} (${agent.role}) · **Ilha:** Administrativo · **Modo:** Simulação/Fallback (sem API Key)
${reworkBanner}${contractNote}${depNote}
## Plano Operacional & Conformidade
- **Demanda:** ${subTask.description}

| Etapa | Responsável | Critério de Aceite | Status |
| :--- | :--- | :--- | :--- |
| 01. Levantamento | Administrativo | Requisitos documentados | Concluído |
| 02. Execução Técnica | Ilha Especialista | Artefato integrado ao contrato | Concluído |
| 03. Homologação | Lab QA | Zero regressões críticas | Em Validação |
`;
  }

  return `# ${subTask.title}
**Responsável:** ${agent.name} (${agent.role}) · **Ilha:** ${subTask.department} · **Modo:** Simulação/Fallback (sem API Key)
${reworkBanner}${contractNote}${depNote}
## Plano de Campanha & Posicionamento
- **Briefing:** ${subTask.description}
- **Proposta de Valor:** Clareza operacional, eficiência comprovada e entrega previsível.
- **Canais Prioritários:** Página de lançamento, sequência de onboarding e resumo executivo para stakeholders.
`;
}

export async function executeSubTaskWithAgent(params: {
  agent: Agent;
  subTask: SubTask;
  agentApiKey?: string;
  sharedContract?: string;
  dependencyContext?: string;
  reworkFeedback?: string;
  previousOutputMarkdown?: string;
}): Promise<ExecuteSubTaskResult> {
  const {
    agent,
    subTask,
    agentApiKey,
    sharedContract,
    dependencyContext,
    reworkFeedback,
    previousOutputMarkdown,
  } = params;
  const model = migrateLegacyModelId((agent.model as string) || DEFAULT_MODEL_ID);
  const hasRealKey = isRealApiKeyConfigured(agentApiKey);

  // Economical Context Assembly + Handoff Injection:
  // [DNA Prompt] + [Top 2 LTM] + [Contrato da War Room] + [Output/Resumo Passo Anterior] + [Código Anterior + Parecer QA] + [Subtarefa Atual]
  const dna = agent.dnaPrompt ?? agent.systemPrompt ?? `Você é ${agent.role}.`;
  const top2Facts = agent.longTermMemory
    .slice(-2)
    .map((f, idx) => `${idx + 1}. ${f.content}`)
    .join('\n');

  const economicalSystemInstruction = `${dna}
REGRA DE ENTREGA FIEL AO ESCOPO:
- Entregue o código-fonte ou artefato final COMPLETO, funcional e pronto para uso na linguagem/tecnologia exata solicitada (ex: código Python/FastAPI completo quando solicitado Python, SQL DDL completo quando solicitado SQL, React/TypeScript completo quando solicitado Frontend).
- Respeite estritamente o Contrato da War Room e o handoff do passo anterior quando fornecidos.
- PROIBIDO entregar resumos genéricos, esboços incompletos ou placeholders do tipo "# implementar aqui".

REGRA DE CONCISÃO TÉCNICA: Entregue EXCLUSIVAMENTE os arquivos de código essenciais solicitados no Contrato da War Room (ex: \`main.py\` completo para Backend; \`App.tsx\` ou componente principal completo para Frontend). NÃO gere arquivos boilerplate extensos como \`package.json\`, \`tsconfig.json\`, \`Dockerfile\` ou longos tutoriais de instalação, para garantir que o código funcional nunca seja truncado.${
    top2Facts ? `\n\nFatos aprendidos (Memória Longo Prazo):\n${top2Facts}` : ''
  }`;

  const promptParts = [
    `Subtarefa (Passo ${subTask.stepOrder ?? 1}): ${subTask.title}`,
    `Descrição e Escopo Obrigatório: ${subTask.description}`,
  ];
  if (sharedContract) {
    promptParts.push(`Contrato da War Room:\n${sharedContract}`);
  }
  if (dependencyContext) {
    promptParts.push(`Handoff / Contexto do Passo Anterior:\n${dependencyContext.slice(0, 1400)}`);
  }
  if (reworkFeedback) {
    if (previousOutputMarkdown) {
      promptParts.push(
        `Seu Código Anterior:\n${previousOutputMarkdown.slice(0, 6000)}`
      );
    }
    promptParts.push(
      `Parecer de Reprovação do QA (corrigir especificamente os pontos apontados):\n${reworkFeedback}`
    );
  }
  promptParts.push(
    'Entregue o código-fonte ou artefato essencial COMPLETO em Markdown técnico seguindo a Regra de Concisão Técnica. Ao final, adicione uma última linha iniciando exatamente com "APRENDIZADO:" resumindo em 1 frase curta o que foi entregue.'
  );

  const prompt = promptParts.join('\n\n');

  const res = await callServerLlm({
    model,
    systemInstruction: economicalSystemInstruction,
    prompt,
    maxOutputTokens: resolveMaxOutputTokens(model),
    envVarName: agent.apiKeyEnvVar,
    clientApiKey: agentApiKey,
  });

  if (hasRealKey) {
    if (!res.ok || !res.text) {
      const apiError = res.apiError || `[Erro API: ${res.error || 'Falha na execução real'}]`;
      return {
        markdownOutput: `# Falha na Execução Real — ${subTask.title}
**Agente:** ${agent.name} (${agent.role}) · **Modelo:** \`${model}\` · **Variável:** \`${agent.apiKeyEnvVar ?? 'N/A'}\`

> **Diagnóstico da API:** ${apiError}

A chamada real falhou e o sistema bloqueou o fallback silencioso para não mascarar o erro de configuração.
- Verifique se a chave vinculada a \`${agent.apiKeyEnvVar ?? 'API_KEY'}\` é válida e possui saldo/cota ativa.
- Confirme se o modelo selecionado (\`${model}\`) existe e está habilitado para a sua conta.
- Ajuste a chave ou modelo na **Ficha Técnica do Agente** ou no **Cofre .env do CPD**.`,
        summary: apiError,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        learnedFact: `Falha na chamada real (${model}): ${apiError}`,
        usedFallback: false,
        apiError,
      };
    }

    const rawText = res.text.trim();
    const wasTruncated = res.finishReason === 'MAX_TOKENS';
    let learnedFact = `Concluiu "${subTask.title}" na ilha ${subTask.department}.`;
    const match = rawText.match(/APRENDIZADO:\s*(.+)$/im);
    let cleanMarkdown = rawText;
    if (match) {
      learnedFact = match[1].trim().slice(0, 140);
      cleanMarkdown = rawText.replace(/APRENDIZADO:\s*.+$/im, '').trim();
    }

    if (wasTruncated) {
      cleanMarkdown = `${cleanMarkdown}\n\n[⚠️ AVISO: Resposta atingiu o limite de tokens e foi truncada]`;
      learnedFact = `Atenção: entrega de "${subTask.title}" atingiu MAX_TOKENS e foi truncada.`;
    }

    const inTok = res.usageMetadata?.promptTokenCount ?? res.inputTokens ?? 0;
    const outTok = res.usageMetadata?.candidatesTokenCount ?? res.outputTokens ?? 0;
    const summary = `${subTask.department}: ${learnedFact} (${cleanMarkdown.slice(0, 260).replace(/\s+/g, ' ')})`;

    return {
      markdownOutput: cleanMarkdown,
      summary,
      inputTokens: inTok,
      outputTokens: outTok,
      estimatedCostUsd: estimateCostUsd(model, inTok, outTok),
      learnedFact,
      usedFallback: false,
      wasTruncated,
    };
  }

  // Fallback simulation output ONLY when API Key is explicitly empty or FALLBACK_TEST_KEY
  const fallbackMd = buildFallbackDeliverable(
    agent,
    subTask,
    sharedContract,
    dependencyContext,
    reworkFeedback
  );
  return {
    markdownOutput: fallbackMd,
    summary: `${subTask.department} entregou "${subTask.title}" seguindo o contrato (${fallbackMd.slice(0, 180).replace(/\s+/g, ' ')}).`,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    learnedFact: `Executou "${subTask.title}" (${subTask.department}) em modo simulação/fallback.`,
    usedFallback: true,
  };
}

export interface QaAuditResult {
  approved: boolean;
  verdict: QaVerdict;
  findings: string;
  targetStepId?: string;
  targetStepIds: string[];
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  apiError?: string;
}

export async function auditDeliveryWithQa(params: {
  reviewer: Agent;
  briefingPrompt: string;
  sharedContract?: string;
  producedSteps: Array<{
    id: string;
    stepOrder: number;
    department: DepartmentIsland;
    title: string;
    outputMarkdown: string;
  }>;
  reworkCycleUsed: number;
  previousFindings?: string;
  qaApiKey?: string;
}): Promise<QaAuditResult> {
  const {
    reviewer,
    briefingPrompt,
    sharedContract,
    producedSteps,
    reworkCycleUsed,
    previousFindings,
    qaApiKey,
  } = params;
  const model = migrateLegacyModelId((reviewer.model as string) || 'gemini-3-flash-preview');
  const hasRealKey = isRealApiKeyConfigured(qaApiKey);

  if (!hasRealKey) {
    const wantsSimulatedDefect =
      reworkCycleUsed === 0 &&
      /simular falha qa|testar falha qa|testar retrabalho|simular erro qa/i.test(briefingPrompt);

    if (wantsSimulatedDefect && producedSteps.length > 0) {
      const targetIds = producedSteps.map((s) => s.id);
      const deptsLabel = producedSteps.map((s) => `Passo ${s.stepOrder} (${s.department})`).join(' e ');
      return {
        approved: false,
        verdict: 'REPROVADO',
        targetStepId: targetIds[0],
        targetStepIds: targetIds,
        findings: `Apontamento QA em ${deptsLabel}: Validar payload/tratamento de erro explícito e alinhar rotas/campos com o Contrato da War Room antes da homologação final.`,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        usedFallback: true,
      };
    }

    return {
      approved: true,
      verdict: 'APROVADO',
      targetStepIds: [],
      findings:
        reworkCycleUsed > 0
          ? `Verificação final pós-retrabalho (Ciclo 1/1) concluída por ${reviewer.name}: códigos atualizados validados contra o Contrato da War Room e prontos para entrega à Diretoria.`
          : `Homologado no Lab QA por ${reviewer.name}: ${producedSteps.length} entregável(is) verificado(s), contrato consistente e pronto para a Diretoria.`,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      usedFallback: true,
    };
  }

  const isPostReworkAudit = reworkCycleUsed >= 1;
  const systemInstruction = `${reviewer.dnaPrompt ?? reviewer.systemPrompt ?? 'Você é Analista Sênior de QA.'}
${
  isPostReworkAudit
    ? 'MODO VERIFICAÇÃO FINAL PÓS-RETRABALHO (Ciclo 1/1): Os especialistas acabaram de corrigir e devolver os códigos. Faça uma verificação rápida e objetiva dos códigos atualizados frente aos apontamentos anteriores. Gere um NOVO parecer final (substituindo a reprovação anterior) e defina o veredito como "APROVADO" (se tudo foi sanado) ou "APROVADO COM RESSALVAS" (se restou detalhe menor).'
    : 'Audite a consistência técnica entre os entregáveis produzidos, o Contrato da War Room e o briefing original do CEO.'
}
Verifique também se algum entregável foi truncado (ex: contém "[⚠️ AVISO: Resposta atingiu o limite de tokens e foi truncada]" ou código cortado no meio).
Responda APENAS em JSON válido:
{
  "approved": true | false,
  "verdict": "APROVADO" | "APROVADO COM RESSALVAS" | "REPROVADO",
  "targetStepIds": ["lista com os IDs exatos dos passos que falharam se approved=false, senão []"],
  "targetStepId": "id principal com falha se approved=false, senão null",
  "findings": "novo parecer técnico final objetivo em português (até 120 palavras)"
}`;

  const stepsDigest = producedSteps
    .map(
      (s) =>
        `[Passo ${s.stepOrder} | id=${s.id} | ${s.department}] ${s.title}\n${s.outputMarkdown.slice(0, 2400)}`
    )
    .join('\n\n---\n\n');

  const prompt = `Briefing do CEO: ${briefingPrompt}\n${
    sharedContract ? `Contrato War Room:\n${sharedContract}\n` : ''
  }${
    isPostReworkAudit && previousFindings
      ? `Reprovação Anterior (verificar se foi corrigida):\n${previousFindings}\n`
      : ''
  }\nEntregáveis Atualizados para Auditoria:\n${stepsDigest}`;

  const res = await callServerLlm({
    model,
    systemInstruction,
    prompt,
    responseMimeType: 'application/json',
    maxOutputTokens: isPostReworkAudit ? 2048 : resolveMaxOutputTokens(model),
    envVarName: reviewer.apiKeyEnvVar,
    clientApiKey: qaApiKey,
  });

  if (!res.ok || !res.text) {
    const apiError = res.apiError || `[Erro API QA: ${res.error || 'Falha na auditoria'}]`;
    return {
      approved: false,
      verdict: 'REPROVADO',
      targetStepIds: [],
      findings: apiError,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      usedFallback: false,
      apiError,
    };
  }

  const inTok = res.usageMetadata?.promptTokenCount ?? res.inputTokens ?? 0;
  const outTok = res.usageMetadata?.candidatesTokenCount ?? res.outputTokens ?? 0;
  const cost = estimateCostUsd(model, inTok, outTok);

  try {
    const cleaned = res.text.replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      approved?: boolean;
      verdict?: string;
      targetStepId?: string | null;
      targetStepIds?: Array<string | null> | null;
      findings?: string;
    };
    // Enforce max 1 rework cycle safety lock
    const approved = isPostReworkAudit ? true : Boolean(parsed.approved ?? true);
    const rawVerdict = (parsed.verdict || '').toUpperCase().trim();
    let verdict: QaVerdict;
    if (!approved) {
      verdict = 'REPROVADO';
    } else if (
      rawVerdict === 'APROVADO COM RESSALVAS' ||
      (isPostReworkAudit && (parsed.approved === false || rawVerdict === 'REPROVADO'))
    ) {
      verdict = 'APROVADO COM RESSALVAS';
    } else {
      verdict = 'APROVADO';
    }

    const validIds = new Set(producedSteps.map((s) => s.id));
    const collectedIds: string[] = [];

    if (!approved) {
      if (Array.isArray(parsed.targetStepIds)) {
        for (const rawId of parsed.targetStepIds) {
          if (typeof rawId === 'string' && validIds.has(rawId) && !collectedIds.includes(rawId)) {
            collectedIds.push(rawId);
          }
        }
      }
      if (
        typeof parsed.targetStepId === 'string' &&
        validIds.has(parsed.targetStepId) &&
        !collectedIds.includes(parsed.targetStepId)
      ) {
        collectedIds.push(parsed.targetStepId);
      }
      // Also match step references mentioned in findings (e.g. "Passo 1", "Backend", "Frontend")
      const findingsText = (parsed.findings || '').toLowerCase();
      for (const st of producedSteps) {
        if (
          !collectedIds.includes(st.id) &&
          (findingsText.includes(`passo ${st.stepOrder}`) ||
            findingsText.includes(st.department.toLowerCase()))
        ) {
          collectedIds.push(st.id);
        }
      }
      if (collectedIds.length === 0 && producedSteps[0]) {
        collectedIds.push(producedSteps[0].id);
      }
    }

    return {
      approved,
      verdict,
      targetStepId: collectedIds[0],
      targetStepIds: collectedIds,
      findings:
        parsed.findings?.trim() ||
        (isPostReworkAudit
          ? 'Verificação final pós-retrabalho concluída no Lab QA.'
          : 'Auditoria técnica concluída no Lab QA.'),
      inputTokens: inTok,
      outputTokens: outTok,
      estimatedCostUsd: cost,
      usedFallback: false,
    };
  } catch {
    return {
      approved: true,
      verdict: isPostReworkAudit ? 'APROVADO COM RESSALVAS' : 'APROVADO',
      targetStepIds: [],
      findings: res.text.trim().slice(0, 260) || 'Homologado no Lab QA.',
      inputTokens: inTok,
      outputTokens: outTok,
      estimatedCostUsd: cost,
      usedFallback: false,
    };
  }
}
