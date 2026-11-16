"""
Serviço de orquestração do Agent Tycoon:
- Contratação e cofre .env (EnvVaultManager)
- Proxy seguro de execução LLM (Google Gemini, Anthropic, OpenAI)
- Contabilização FinOps em token_ledger e alertas de orçamento para o Vega
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.env_vault import EnvVaultManager
from app.models.office import Agent, AgentMemory, TokenLedger
from app.repositories.office_repo import OfficeRepository
from app.schemas.office import (
    AgentHireRequest,
    AgentHireResponse,
    AgentMemoryOut,
    AgentOut,
    AgentSpendSummary,
    AgentVaultUpdateRequest,
    AgentVaultUpdateResponse,
    BudgetAlert,
    FinopsSummaryOut,
    IslandSpendSummary,
    LlmExecuteRequest,
    LlmExecuteResponse,
    OfficeStateOut,
)

LEGACY_MODEL_MIGRATION_MAP: Dict[str, str] = {
    "gemini-2.5-pro": "gemini-3.1-pro-preview",
    "gemini-2.5-flash": "gemini-3-flash-preview",
    "gemini-2.5-flash-lite": "gemini-3.1-flash-lite-preview",
    "claude-sonnet": "claude-sonnet-4-5",
}

DEFAULT_MODEL_ID = "gemini-3-flash-preview"

# Preços em USD por 1 milhão de tokens (input, output)
MODEL_PRICING_PER_1M: Dict[str, Tuple[Decimal, Decimal]] = {
    "gemini-3.1-pro-preview": (Decimal("2.0"), Decimal("12.0")),
    "gemini-3-flash-preview": (Decimal("0.5"), Decimal("3.0")),
    "gemini-3.1-flash-lite-preview": (Decimal("0.1"), Decimal("0.4")),
    "claude-sonnet-4-5": (Decimal("3.0"), Decimal("15.0")),
    "gpt-4o-mini": (Decimal("0.15"), Decimal("0.6")),
}

COST_QUANT = Decimal("0.000001")
ONE_MILLION = Decimal("1000000")


class ServiceError(Exception):
    """Erro de domínio com código HTTP sugerido."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def normalize_model_id(model_id: Optional[str]) -> str:
    """Normaliza IDs legados para os modelos atuais."""
    cleaned = (model_id or "").strip()
    if not cleaned:
        return DEFAULT_MODEL_ID
    return LEGACY_MODEL_MIGRATION_MAP.get(cleaned, cleaned)


def calculate_cost_usd(
    model_id: str, input_tokens: int, output_tokens: int
) -> Decimal:
    """Calcula custo exato em USD com precisão de 6 casas decimais."""
    normalized = normalize_model_id(model_id)
    in_rate, out_rate = MODEL_PRICING_PER_1M.get(
        normalized, MODEL_PRICING_PER_1M[DEFAULT_MODEL_ID]
    )
    in_cost = (Decimal(max(0, input_tokens)) / ONE_MILLION) * in_rate
    out_cost = (Decimal(max(0, output_tokens)) / ONE_MILLION) * out_rate
    return (in_cost + out_cost).quantize(COST_QUANT, rounding=ROUND_HALF_UP)


def _today_utc_start() -> datetime:
    """Retorna o início do dia atual em UTC (00:00:00Z)."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _to_agent_out(agent: Agent, include_memories: bool = True) -> AgentOut:
    """Converte ORM Agent em schema público sem expor segredos."""
    memories_out: List[AgentMemoryOut] = []
    if include_memories and agent.memories:
        sorted_memories = sorted(
            agent.memories, key=lambda m: m.created_at, reverse=True
        )
        memories_out = [
            AgentMemoryOut.model_validate(m) for m in sorted_memories
        ]

    return AgentOut(
        id=agent.id,
        slug=agent.slug,
        name=agent.name,
        role=agent.role,
        department=agent.department,
        provider=agent.provider,
        model_id=agent.model_id,
        env_var_name=agent.env_var_name,
        is_configured=EnvVaultManager.has_configured_key(agent.env_var_name),
        dna_prompt=agent.dna_prompt,
        daily_budget_usd=agent.daily_budget_usd,
        status=agent.status,
        desk_slot=agent.desk_slot,
        is_active=agent.is_active,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        memories=memories_out,
    )


class OrchestratorService:
    """Regras de negócio para estado do escritório, cofre, LLM e FinOps."""

    @staticmethod
    def get_office_state(db: Session) -> OfficeStateOut:
        """Carrega agentes ativos, status do cofre .env, memórias e resumo FinOps."""
        agents = OfficeRepository.list_active_agents(db)
        agents_out = [_to_agent_out(agent, include_memories=True) for agent in agents]
        finops = OrchestratorService.get_finops_summary(db, agents=agents)
        return OfficeStateOut(agents=agents_out, finops=finops)

    @staticmethod
    def hire_agent(db: Session, payload: AgentHireRequest) -> AgentHireResponse:
        """
        Contrata um novo agente aprovado pelo CEO:
        1. Sanitiza e grava a chave no .env (se fornecida) via EnvVaultManager
        2. Persiste o funcionário no PostgreSQL
        3. Retorna o agente pronto para spawnar na Recepção
        """
        safe_var = EnvVaultManager._sanitize_var_name(payload.env_var_name)
        slug_clean = payload.slug.strip().lower()

        conflict = OfficeRepository.get_active_conflict(db, slug_clean, safe_var)
        if conflict is not None:
            raise ServiceError(
                409,
                f"Já existe um agente ativo com slug '{slug_clean}' ou variável '{safe_var}'.",
            )

        if payload.api_key and payload.api_key.strip():
            safe_var = EnvVaultManager.set_agent_key(safe_var, payload.api_key)

        agent = Agent(
            slug=slug_clean,
            name=payload.name.strip(),
            role=payload.role.strip(),
            department=payload.department.strip(),
            provider=payload.provider.strip().lower(),
            model_id=normalize_model_id(payload.model_id),
            env_var_name=safe_var,
            dna_prompt=payload.dna_prompt.strip(),
            daily_budget_usd=payload.daily_budget_usd,
            status=payload.status.strip() or "idle",
            desk_slot=payload.desk_slot,
        )
        created = OfficeRepository.create_agent(db, agent)
        agent_out = _to_agent_out(created, include_memories=False)

        return AgentHireResponse(
            agent=agent_out,
            spawn_location="recepcao",
            message=f"{created.name} contratado(a) com sucesso e pronto(a) para spawnar na Recepção.",
        )

    @staticmethod
    def update_agent_vault(
        db: Session, agent_id: UUID, payload: AgentVaultUpdateRequest
    ) -> AgentVaultUpdateResponse:
        """Atualiza o modelo/orçamento do agente e/ou rotaciona sua API Key no .env."""
        agent = OfficeRepository.get_active_agent_by_id(db, agent_id)
        if agent is None:
            raise ServiceError(404, f"Agente {agent_id} não encontrado.")

        updated_model = False
        rotated_key = False

        if payload.model_id is not None:
            agent.model_id = normalize_model_id(payload.model_id)
            updated_model = True

        if payload.provider is not None:
            agent.provider = payload.provider.strip().lower()

        if payload.daily_budget_usd is not None:
            agent.daily_budget_usd = payload.daily_budget_usd

        if payload.api_key is not None and payload.api_key.strip():
            safe_var = EnvVaultManager.set_agent_key(
                agent.env_var_name, payload.api_key
            )
            agent.env_var_name = safe_var
            rotated_key = True

        saved = OfficeRepository.save_agent(db, agent)
        return AgentVaultUpdateResponse(
            agent=_to_agent_out(saved, include_memories=True),
            rotated_key=rotated_key,
            updated_model=updated_model,
        )

    @staticmethod
    def get_finops_summary(
        db: Session, agents: Optional[List[Agent]] = None
    ) -> FinopsSummaryOut:
        """Consolida gastos por funcionário, por ilha e gera alertas para o Vega."""
        active_agents = (
            agents if agents is not None else OfficeRepository.list_active_agents(db)
        )
        since_utc = _today_utc_start()
        all_time_map, today_map = OfficeRepository.get_ledger_totals_by_agent(
            db, since_utc
        )

        by_agent: List[AgentSpendSummary] = []
        island_acc: Dict[str, Dict[str, Any]] = {}
        alerts: List[BudgetAlert] = []

        total_today = Decimal("0.000000")
        total_all_time = Decimal("0.000000")
        total_budget = Decimal("0.0000")

        for agent in active_agents:
            all_cost, in_tok, out_tok = all_time_map.get(
                agent.id, (Decimal("0.000000"), 0, 0)
            )
            today_cost = today_map.get(agent.id, Decimal("0.000000"))

            total_today += today_cost
            total_all_time += all_cost
            total_budget += agent.daily_budget_usd

            if agent.daily_budget_usd > 0:
                utilization_pct = round(
                    float((today_cost / agent.daily_budget_usd) * Decimal("100")), 2
                )
            else:
                utilization_pct = 0.0

            by_agent.append(
                AgentSpendSummary(
                    agent_id=agent.id,
                    slug=agent.slug,
                    name=agent.name,
                    department=agent.department,
                    model_id=agent.model_id,
                    daily_budget_usd=agent.daily_budget_usd,
                    today_spend_usd=today_cost.quantize(COST_QUANT),
                    total_spend_usd=all_cost.quantize(COST_QUANT),
                    total_input_tokens=in_tok,
                    total_output_tokens=out_tok,
                    budget_utilization_pct=utilization_pct,
                )
            )

            bucket = island_acc.setdefault(
                agent.department,
                {
                    "agent_count": 0,
                    "today_spend_usd": Decimal("0.000000"),
                    "total_spend_usd": Decimal("0.000000"),
                    "total_daily_budget_usd": Decimal("0.0000"),
                    "total_input_tokens": 0,
                    "total_output_tokens": 0,
                },
            )
            bucket["agent_count"] += 1
            bucket["today_spend_usd"] += today_cost
            bucket["total_spend_usd"] += all_cost
            bucket["total_daily_budget_usd"] += agent.daily_budget_usd
            bucket["total_input_tokens"] += in_tok
            bucket["total_output_tokens"] += out_tok

            if agent.daily_budget_usd > 0 and utilization_pct >= 80.0:
                severity = "critical" if utilization_pct >= 100.0 else "warning"
                msg = (
                    f"{agent.name} ({agent.department}) atingiu {utilization_pct:.1f}% "
                    f"do orçamento diário (${today_cost:.4f} / ${agent.daily_budget_usd:.4f})."
                )
                alerts.append(
                    BudgetAlert(
                        agent_id=agent.id,
                        slug=agent.slug,
                        name=agent.name,
                        department=agent.department,
                        severity=severity,
                        today_spend_usd=today_cost.quantize(COST_QUANT),
                        daily_budget_usd=agent.daily_budget_usd,
                        utilization_pct=utilization_pct,
                        message=msg,
                    )
                )

        by_island = [
            IslandSpendSummary(
                department=dept,
                agent_count=data["agent_count"],
                today_spend_usd=data["today_spend_usd"].quantize(COST_QUANT),
                total_spend_usd=data["total_spend_usd"].quantize(COST_QUANT),
                total_daily_budget_usd=data["total_daily_budget_usd"],
                total_input_tokens=data["total_input_tokens"],
                total_output_tokens=data["total_output_tokens"],
            )
            for dept, data in sorted(island_acc.items())
        ]

        return FinopsSummaryOut(
            generated_at=datetime.now(timezone.utc),
            total_today_spend_usd=total_today.quantize(COST_QUANT),
            total_all_time_spend_usd=total_all_time.quantize(COST_QUANT),
            total_daily_budget_usd=total_budget,
            by_agent=by_agent,
            by_island=by_island,
            alerts=alerts,
        )

    @staticmethod
    def _build_system_instruction(
        dna_prompt: str, memories: List[AgentMemory]
    ) -> str:
        """Monta o system prompt enxuto combinando DNA do agente e top 2 memórias."""
        if not memories:
            return dna_prompt
        memory_lines = "\n".join(f"- {m.fact_summary}" for m in memories)
        return f"{dna_prompt}\n\n[Memórias de Longo Prazo]\n{memory_lines}"

    @staticmethod
    def _call_provider_api(
        *,
        provider: str,
        model_id: str,
        api_key: str,
        system_instruction: str,
        prompt_payload: str,
        response_mime_type: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> Tuple[str, int, int]:
        """
        Executa chamada HTTP ao provedor de IA (Google, Anthropic ou OpenAI).
        Retorna (texto_gerado, input_tokens, output_tokens).
        """
        settings = get_settings()
        timeout = settings.LLM_TIMEOUT_SECONDS
        normalized_provider = provider.lower().strip()

        if normalized_provider == "anthropic" or model_id.startswith("claude"):
            return OrchestratorService._call_anthropic(
                model_id=model_id,
                api_key=api_key,
                system_instruction=system_instruction,
                prompt_payload=prompt_payload,
                max_output_tokens=max_output_tokens or 4096,
                temperature=temperature,
                timeout=timeout,
            )

        if normalized_provider == "openai" or model_id.startswith("gpt"):
            return OrchestratorService._call_openai(
                model_id=model_id,
                api_key=api_key,
                system_instruction=system_instruction,
                prompt_payload=prompt_payload,
                response_mime_type=response_mime_type,
                max_output_tokens=max_output_tokens,
                temperature=temperature,
                timeout=timeout,
            )

        return OrchestratorService._call_google_gemini(
            model_id=model_id,
            api_key=api_key,
            system_instruction=system_instruction,
            prompt_payload=prompt_payload,
            response_mime_type=response_mime_type,
            max_output_tokens=max_output_tokens,
            temperature=temperature,
            timeout=timeout,
        )

    @staticmethod
    def _call_google_gemini(
        *,
        model_id: str,
        api_key: str,
        system_instruction: str,
        prompt_payload: str,
        response_mime_type: Optional[str],
        max_output_tokens: Optional[int],
        temperature: Optional[float],
        timeout: float,
    ) -> Tuple[str, int, int]:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_id}:generateContent"
        )
        gen_config: Dict[str, Any] = {}
        if max_output_tokens is not None:
            gen_config["maxOutputTokens"] = max_output_tokens
        if response_mime_type:
            gen_config["responseMimeType"] = response_mime_type
        if temperature is not None:
            gen_config["temperature"] = temperature

        body: Dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": prompt_payload}]}],
        }
        if gen_config:
            body["generationConfig"] = gen_config

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    url,
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=body,
                )
        except httpx.HTTPError as exc:
            raise ServiceError(502, f"Falha de rede ao contatar Google Gemini: {type(exc).__name__}")

        if resp.status_code >= 400:
            raise ServiceError(
                502,
                f"Google Gemini retornou HTTP {resp.status_code}: {resp.text[:300]}",
            )

        data = resp.json()
        candidates = data.get("candidates") or []
        text = ""
        if candidates:
            parts = candidates[0].get("content", {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts)

        usage = data.get("usageMetadata") or {}
        input_tokens = int(usage.get("promptTokenCount") or 0)
        output_tokens = int(usage.get("candidatesTokenCount") or 0)
        return text, input_tokens, output_tokens

    @staticmethod
    def _call_anthropic(
        *,
        model_id: str,
        api_key: str,
        system_instruction: str,
        prompt_payload: str,
        max_output_tokens: int,
        temperature: Optional[float],
        timeout: float,
    ) -> Tuple[str, int, int]:
        body: Dict[str, Any] = {
            "model": model_id,
            "max_tokens": max_output_tokens,
            "system": system_instruction,
            "messages": [{"role": "user", "content": prompt_payload}],
        }
        if temperature is not None:
            body["temperature"] = temperature

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
        except httpx.HTTPError as exc:
            raise ServiceError(502, f"Falha de rede ao contatar Anthropic: {type(exc).__name__}")

        if resp.status_code >= 400:
            raise ServiceError(
                502,
                f"Anthropic retornou HTTP {resp.status_code}: {resp.text[:300]}",
            )

        data = resp.json()
        content_blocks = data.get("content") or []
        text = "".join(
            b.get("text", "") for b in content_blocks if b.get("type") == "text"
        )
        usage = data.get("usage") or {}
        input_tokens = int(usage.get("input_tokens") or 0)
        output_tokens = int(usage.get("output_tokens") or 0)
        return text, input_tokens, output_tokens

    @staticmethod
    def _call_openai(
        *,
        model_id: str,
        api_key: str,
        system_instruction: str,
        prompt_payload: str,
        response_mime_type: Optional[str],
        max_output_tokens: Optional[int],
        temperature: Optional[float],
        timeout: float,
    ) -> Tuple[str, int, int]:
        body: Dict[str, Any] = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt_payload},
            ],
        }
        if max_output_tokens is not None:
            body["max_tokens"] = max_output_tokens
        if temperature is not None:
            body["temperature"] = temperature
        if response_mime_type == "application/json":
            body["response_format"] = {"type": "json_object"}

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
        except httpx.HTTPError as exc:
            raise ServiceError(502, f"Falha de rede ao contatar OpenAI: {type(exc).__name__}")

        if resp.status_code >= 400:
            raise ServiceError(
                502,
                f"OpenAI retornou HTTP {resp.status_code}: {resp.text[:300]}",
            )

        data = resp.json()
        choices = data.get("choices") or []
        text = choices[0].get("message", {}).get("content", "") if choices else ""
        usage = data.get("usage") or {}
        input_tokens = int(usage.get("prompt_tokens") or 0)
        output_tokens = int(usage.get("completion_tokens") or 0)
        return text, input_tokens, output_tokens

    @staticmethod
    def execute_llm(db: Session, payload: LlmExecuteRequest) -> LlmExecuteResponse:
        """
        Proxy seguro de execução LLM:
        1. Busca o agente ativo e valida orçamento diário
        2. Carrega dna_prompt + top 2 memórias no Postgres
        3. Lê a chave secreta exclusivamente no EnvVaultManager
        4. Chama a API da IA
        5. Registra gasto exato na tabela token_ledger e devolve o texto ao Canvas
        """
        agent = OfficeRepository.get_active_agent_by_id(db, payload.agent_id)
        if agent is None:
            raise ServiceError(404, f"Agente {payload.agent_id} não encontrado.")

        if payload.task_id is not None:
            task = OfficeRepository.get_task_by_id(db, payload.task_id)
            if task is None:
                raise ServiceError(404, f"Tarefa {payload.task_id} não encontrada.")

        today_spend = OfficeRepository.get_agent_today_spend(
            db, agent.id, _today_utc_start()
        )
        if agent.daily_budget_usd > 0 and today_spend >= agent.daily_budget_usd:
            raise ServiceError(
                429,
                f"Orçamento diário de {agent.name} atingido (${today_spend:.4f} / ${agent.daily_budget_usd:.4f}).",
            )

        try:
            secret_key = EnvVaultManager.get_secret_for_execution(agent.env_var_name)
        except ValueError as exc:
            raise ServiceError(422, str(exc))

        top_memories = OfficeRepository.get_top_memories(db, agent.id, limit=2)
        system_instruction = OrchestratorService._build_system_instruction(
            agent.dna_prompt, top_memories
        )

        normalized_model = normalize_model_id(agent.model_id)
        generated_text, input_tokens, output_tokens = (
            OrchestratorService._call_provider_api(
                provider=agent.provider,
                model_id=normalized_model,
                api_key=secret_key,
                system_instruction=system_instruction,
                prompt_payload=payload.prompt_payload,
                response_mime_type=payload.response_mime_type,
                max_output_tokens=payload.max_output_tokens,
                temperature=payload.temperature,
            )
        )

        cost_usd = calculate_cost_usd(normalized_model, input_tokens, output_tokens)
        ledger_entry = OfficeRepository.create_token_ledger_entry(
            db,
            TokenLedger(
                agent_id=agent.id,
                task_id=payload.task_id,
                model_id=normalized_model,
                operation_type=payload.operation_type,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost_usd,
            ),
        )

        return LlmExecuteResponse(
            agent_id=agent.id,
            task_id=payload.task_id,
            model_id=normalized_model,
            text=generated_text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            memories_used=[m.fact_summary for m in top_memories],
            ledger_entry_id=ledger_entry.id,
        )
