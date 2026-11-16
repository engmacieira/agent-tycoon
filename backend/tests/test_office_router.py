"""
Testes de integração dos endpoints FastAPI do Agent Tycoon.
"""

import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import env_vault
from app.core.database import get_db
from app.main import app
from app.models.office import AgentMemory, Base


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Configura banco SQLite em memória e arquivo .env isolado por teste."""
    test_env_file = tmp_path / ".env"
    monkeypatch.setattr(env_vault, "ENV_FILE_PATH", test_env_file)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, TestingSessionLocal, test_env_file

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_hire_agent_and_office_state(client):
    test_client, _session_factory, test_env_file = client
    secret = "AIzaSyTestSecretKey123456"

    hire_resp = test_client.post(
        "/api/v1/agents/hire",
        json={
            "slug": "kael",
            "name": "Kael",
            "role": "Backend Architect",
            "department": "Backend",
            "provider": "google",
            "model_id": "gemini-3-flash-preview",
            "env_var_name": "KAEL_KEY",
            "api_key": secret,
            "dna_prompt": "Você é Kael, arquiteto backend especialista em Python e SQL.",
            "daily_budget_usd": "2.5000",
        },
    )
    assert hire_resp.status_code == 201, hire_resp.text
    hire_data = hire_resp.json()
    assert hire_data["spawn_location"] == "recepcao"
    assert hire_data["agent"]["slug"] == "kael"
    assert hire_data["agent"]["env_var_name"] == "AGENT_KAEL_KEY"
    assert hire_data["agent"]["is_configured"] is True
    assert secret not in hire_resp.text
    assert f'AGENT_KAEL_KEY="{secret}"' in test_env_file.read_text(encoding="utf-8")

    # Limpa env var após teste para não poluir processo
    os.environ.pop("AGENT_KAEL_KEY", None)

    # Contratação duplicada deve retornar 409
    dup_resp = test_client.post(
        "/api/v1/agents/hire",
        json={
            "slug": "kael",
            "name": "Kael Clone",
            "role": "Backend",
            "department": "Backend",
            "env_var_name": "AGENT_KAEL_KEY",
            "dna_prompt": "Clone",
        },
    )
    assert dup_resp.status_code == 409

    # GET /office/state deve retornar o agente sem vazar segredo
    state_resp = test_client.get("/api/v1/office/state")
    assert state_resp.status_code == 200
    state_data = state_resp.json()
    assert len(state_data["agents"]) == 1
    assert state_data["agents"][0]["slug"] == "kael"
    assert "finops" in state_data
    assert secret not in state_resp.text


def test_patch_agent_vault_updates_model_and_rotates_key(client):
    test_client, _session_factory, test_env_file = client
    old_key = "AIzaOldKey000001"
    new_key = "AIzaRotatedKey999"

    hire_resp = test_client.post(
        "/api/v1/agents/hire",
        json={
            "slug": "lyra",
            "name": "Lyra",
            "role": "Frontend Lead",
            "department": "Frontend",
            "env_var_name": "AGENT_LYRA_KEY",
            "api_key": old_key,
            "dna_prompt": "Especialista React e Canvas 8-bits.",
        },
    )
    assert hire_resp.status_code == 201
    agent_id = hire_resp.json()["agent"]["id"]

    patch_resp = test_client.patch(
        f"/api/v1/agents/{agent_id}/vault",
        json={
            "model_id": "gemini-3.1-pro-preview",
            "api_key": new_key,
        },
    )
    assert patch_resp.status_code == 200
    patch_data = patch_resp.json()
    assert patch_data["updated_model"] is True
    assert patch_data["rotated_key"] is True
    assert patch_data["agent"]["model_id"] == "gemini-3.1-pro-preview"
    assert patch_data["agent"]["is_configured"] is True
    assert new_key not in patch_resp.text
    assert f'AGENT_LYRA_KEY="{new_key}"' in test_env_file.read_text(encoding="utf-8")
    os.environ.pop("AGENT_LYRA_KEY", None)


def test_llm_execute_injects_top2_memories_and_records_finops(client):
    test_client, session_factory, _test_env_file = client
    secret = "AIzaGeminiProxySecretKey"

    hire_resp = test_client.post(
        "/api/v1/agents/hire",
        json={
            "slug": "vega",
            "name": "Vega",
            "role": "FinOps Controller",
            "department": "Administrativo",
            "provider": "google",
            "model_id": "gemini-3-flash-preview",
            "env_var_name": "AGENT_VEGA_KEY",
            "api_key": secret,
            "dna_prompt": "Você é Vega, guardião FinOps.",
            "daily_budget_usd": "0.0100",
        },
    )
    assert hire_resp.status_code == 201
    agent_id = hire_resp.json()["agent"]["id"]

    # Inserir 3 memórias com timestamps distintos; apenas as 2 mais recentes devem ir ao prompt
    now = datetime.now(timezone.utc)
    with session_factory() as db:
        from uuid import UUID

        aid = UUID(agent_id)
        db.add_all(
            [
                AgentMemory(
                    agent_id=aid,
                    fact_summary="Memória antiga descartada",
                    created_at=now - timedelta(days=2),
                ),
                AgentMemory(
                    agent_id=aid,
                    fact_summary="CEO prefere relatórios em bullet points.",
                    created_at=now - timedelta(hours=2),
                ),
                AgentMemory(
                    agent_id=aid,
                    fact_summary="Alertar quando ilha ultrapassar 80% do orçamento.",
                    created_at=now - timedelta(hours=1),
                ),
            ]
        )
        db.commit()

    captured_system = {}

    def fake_call_provider(**kwargs):
        captured_system["text"] = kwargs["system_instruction"]
        return ("Relatório FinOps concluído.", 1000, 500)

    with patch(
        "app.services.orchestrator_service.OrchestratorService._call_provider_api",
        side_effect=fake_call_provider,
    ):
        exec_resp = test_client.post(
            "/api/v1/llm/execute",
            json={
                "agent_id": agent_id,
                "prompt_payload": "Gere o resumo de custos.",
            },
        )

    assert exec_resp.status_code == 200, exec_resp.text
    exec_data = exec_resp.json()
    assert exec_data["text"] == "Relatório FinOps concluído."
    assert exec_data["input_tokens"] == 1000
    assert exec_data["output_tokens"] == 500
    # gemini-3-flash-preview: 1000 * 0.5/1M + 500 * 3.0/1M = 0.0005 + 0.0015 = 0.002000
    assert Decimal(exec_data["cost_usd"]) == Decimal("0.002000")
    assert len(exec_data["memories_used"]) == 2
    assert "Memória antiga descartada" not in captured_system["text"]
    assert "CEO prefere relatórios em bullet points." in captured_system["text"]

    # Verifica consolidação em GET /api/v1/finops/summary
    finops_resp = test_client.get("/api/v1/finops/summary")
    assert finops_resp.status_code == 200
    finops = finops_resp.json()
    assert Decimal(finops["total_today_spend_usd"]) == Decimal("0.002000")
    assert len(finops["by_agent"]) == 1
    assert len(finops["by_island"]) == 1
    assert finops["by_island"][0]["department"] == "Administrativo"
    assert finops["alerts"] == []

    # Mais chamadas até atingir orçamento (0.0100) para testar alerta + bloqueio
    with patch(
        "app.services.orchestrator_service.OrchestratorService._call_provider_api",
        return_value=("Chamada pesada", 4000, 2000),  # 0.002 + 0.006 = 0.008 -> total 0.010
    ):
        exec_resp_2 = test_client.post(
            "/api/v1/llm/execute",
            json={"agent_id": agent_id, "prompt_payload": "Auditoria completa"},
        )
        assert exec_resp_2.status_code == 200

    finops_alert_resp = test_client.get("/api/v1/finops/summary")
    alerts = finops_alert_resp.json()["alerts"]
    assert len(alerts) == 1
    assert alerts[0]["severity"] == "critical"
    assert alerts[0]["utilization_pct"] == 100.0

    # Próxima chamada deve ser bloqueada com 429
    blocked_resp = test_client.post(
        "/api/v1/llm/execute",
        json={"agent_id": agent_id, "prompt_payload": "Deve bloquear"},
    )
    assert blocked_resp.status_code == 429

    os.environ.pop("AGENT_VEGA_KEY", None)
