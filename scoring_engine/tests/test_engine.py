from __future__ import annotations

import asyncio
from pathlib import Path

from scoring_engine.analyzers.callability import evaluate_callability
from scoring_engine.analyzers.discoverability import analyze_discoverability
from scoring_engine.analyzers.rewriter import rewrite_tool
from scoring_engine.analyzers.schema_health import analyze_schema_health
from scoring_engine.compat.fastapi import FastAPI
from scoring_engine.engine import NullLLMClient, ReportStore, ScoringEngine
from scoring_engine.main import create_app
from scoring_engine.models.report import Diagnosis
from scoring_engine.models.tool_input import ToolInput


class StubLLMClient(NullLLMClient):
    def __init__(self, outcomes: list[str] | None = None) -> None:
        self._outcomes = outcomes or ["invoked", "mentioned", "silent"]

    async def evaluate_tool(
        self,
        prompt_type: str,
        prompt: str,
        tool: ToolInput,
    ) -> dict[str, object]:
        index = {"direct": 0, "ambiguous": 1, "competitive": 2}[prompt_type]
        outcome = self._outcomes[index]
        if outcome == "error":
            raise RuntimeError("mock llm error")
        return {
            "outcome": outcome,
            "reasoning": f"{prompt_type}:{tool.name}",
        }

    async def rewrite_tool(
        self,
        tool: ToolInput,
        diagnosis: Diagnosis,
    ) -> dict[str, object] | None:
        return {
            "description": f"Use {tool.name} to safely complete the requested action with explicit inputs.",
            "inputSchema": {
                **tool.input_schema,
                "examples": [
                    {
                        next(iter(tool.input_schema.get("properties", {}) or {"sample": "value"})): "example"
                    }
                ],
            },
            "rationale": f"mocked rewrite for {diagnosis.failure_mode}",
        }


class BrokenRewriteClient(NullLLMClient):
    async def rewrite_tool(
        self,
        tool: ToolInput,
        diagnosis: Diagnosis,
    ) -> dict[str, object] | None:
        raise ValueError("bad llm payload")


def build_tool(**overrides: object) -> ToolInput:
    payload = {
        "name": "swap_tokens",
        "description": (
            "Swap an exact amount of tokenIn for tokenOut on Uniswap V3 when the user asks to "
            "trade one token for another. Use this tool for direct swaps and return the swap quote "
            "before execution. Example: swap 1 ETH for USDC on mainnet."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "tokenIn": {"type": "string", "description": "Input token address"},
                "tokenOut": {"type": "string", "description": "Output token address"},
                "amount": {"type": "number", "description": "Amount to swap", "default": 1},
                "network": {
                    "type": "string",
                    "description": "Target chain",
                    "enum": ["mainnet", "base"],
                },
            },
            "required": ["tokenIn", "tokenOut", "amount"],
        },
        "serverUrl": "https://example.com/mcp",
        "category": "dex_swap",
        "runLlmTest": True,
    }
    payload.update(overrides)
    return ToolInput.model_validate(payload)


def test_schema_health_reports_clear_schema_metrics() -> None:
    result = analyze_schema_health(build_tool())
    assert result.has_schema is True
    assert result.total_fields == 4
    assert result.required_fields == 3
    assert result.fields_with_description == 4
    assert result.description_coverage == 100.0
    assert result.has_defaults is True
    assert result.has_enums is True
    assert result.ambiguous_field_names == []


def test_schema_health_flags_ambiguous_names_and_missing_descriptions() -> None:
    tool = build_tool(
        inputSchema={
            "type": "object",
            "properties": {
                "data": {"type": "string"},
                "payload": {"type": "string"},
                "info": {"type": "string"},
                "config": {"type": "string"},
                "options": {"type": "string"},
                "body": {"type": "string"},
            },
            "required": ["data", "payload", "info", "config", "options", "body"],
        }
    )
    result = analyze_schema_health(tool)
    assert result.total_fields == 6
    assert result.required_fields == 6
    assert set(result.fields_without_description) == {"data", "payload", "info", "config", "options", "body"}
    assert {"data", "payload", "info"}.issubset(result.ambiguous_field_names)
    assert any(issue.code == "MISSING_PARAM_DESCRIPTION" for issue in result.issues)


def test_discoverability_reports_specific_description_metrics() -> None:
    result = analyze_discoverability(build_tool())
    assert result.has_action_verb is True
    assert result.action_verb_found == "swap"
    assert result.has_use_case is True
    assert result.has_example is True
    assert result.missing_elements == []


def test_discoverability_flags_jargon_and_missing_context() -> None:
    tool = build_tool(
        description="MCP transport payload orchestration for generalized execution synergy.",
        name="tool_v2",
    )
    result = analyze_discoverability(tool)
    assert result.has_action_verb is False
    assert result.has_use_case is False
    assert result.has_example is False
    assert "mcp" in result.jargon_terms
    assert {"action_verb", "use_case_pattern", "example"}.issubset(result.missing_elements)


def test_callability_counts_outcomes() -> None:
    result = asyncio.run(evaluate_callability(build_tool(), StubLLMClient(["invoked", "mentioned", "silent"])))
    assert result.tests_run == 3
    assert result.invoke_count == 1
    assert result.mention_count == 1
    assert result.silent_count == 1
    assert result.error_count == 0
    assert [item.outcome for item in result.test_details] == ["invoked", "mentioned", "silent"]


def test_callability_captures_errors() -> None:
    result = asyncio.run(evaluate_callability(build_tool(), StubLLMClient(["error", "mentioned", "invoked"])))
    assert result.tests_run == 3
    assert result.invoke_count == 1
    assert result.mention_count == 1
    assert result.silent_count == 0
    assert result.error_count == 1
    assert any(item.outcome == "error" for item in result.test_details)
    assert any(issue.code == "INVOCATION_ERROR" for issue in result.issues)


def test_callability_skip_marks_report_as_skipped() -> None:
    result = asyncio.run(evaluate_callability(build_tool(runLlmTest=False), StubLLMClient()))
    assert result.skipped is True
    assert result.tests_run == 3
    assert result.invoke_count == 0
    assert result.mention_count == 0
    assert result.silent_count == 0
    assert result.error_count == 0
    assert all(item.outcome == "skipped" for item in result.test_details)


def test_rewriter_uses_llm_when_available() -> None:
    diagnosis = Diagnosis(failureMode="healthy", rootCause="Tool invoked cleanly.", issues=[])
    rewrite = asyncio.run(rewrite_tool(build_tool(), StubLLMClient(), diagnosis))
    assert "Use swap_tokens" in rewrite.description
    assert rewrite.input_schema["examples"]
    assert rewrite.rationale == "mocked rewrite for healthy"


def test_rewriter_falls_back_when_llm_payload_is_invalid() -> None:
    diagnosis = Diagnosis(failureMode="schema_failure", rootCause="Schema is unclear.", issues=[])
    rewrite = asyncio.run(rewrite_tool(build_tool(), BrokenRewriteClient(), diagnosis))
    assert rewrite.description.startswith("Use swap_tokens when the user explicitly needs")
    assert "schema_failure" in rewrite.rationale


def test_engine_sets_schema_failure_diagnosis(tmp_path: Path) -> None:
    store = ReportStore(tmp_path / "reports.db")
    engine = ScoringEngine(store=store, llm_client=StubLLMClient(["mentioned", "mentioned", "mentioned"]))
    tool = build_tool(
        inputSchema={"type": "object", "properties": {"data": {"type": "string"}}, "required": ["data"]},
    )
    report = asyncio.run(engine.diagnose(tool))
    assert report.diagnosis.failure_mode == "schema_failure"
    assert report.metrics.callability.invoke_count == 0
    assert report.metrics.callability.mention_count == 3
    assert any(issue.code == "MISSING_PARAM_DESCRIPTION" for issue in report.diagnosis.issues)


def test_engine_persists_and_fetches_report(tmp_path: Path) -> None:
    store = ReportStore(tmp_path / "reports.db")
    engine = ScoringEngine(store=store, llm_client=StubLLMClient())
    report = asyncio.run(engine.diagnose(build_tool()))
    loaded = asyncio.run(engine.get_report(report.report_id))
    assert loaded is not None
    assert loaded.report_id == report.report_id
    assert loaded.tool_name == report.tool_name
    assert loaded.timestamp == report.timestamp
    assert loaded.original_tool.name == report.original_tool.name


def test_engine_persists_to_legacy_score_table(tmp_path: Path) -> None:
    database_path = tmp_path / "reports.db"
    import sqlite3

    connection = sqlite3.connect(database_path)
    try:
        connection.execute(
            """
            CREATE TABLE reports (
                report_id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                overall_score REAL NOT NULL,
                created_at TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )
        connection.commit()
    finally:
        connection.close()

    store = ReportStore(database_path)
    engine = ScoringEngine(store=store, llm_client=StubLLMClient())
    report = asyncio.run(engine.diagnose(build_tool()))
    loaded = asyncio.run(engine.get_report(report.report_id))
    assert loaded is not None
    assert loaded.report_id == report.report_id
    assert loaded.tool_name == report.tool_name


def test_engine_batch_diagnose_returns_metrics_only_reports(tmp_path: Path) -> None:
    store = ReportStore(tmp_path / "reports.db")
    engine = ScoringEngine(store=store, llm_client=StubLLMClient())
    reports = asyncio.run(
        engine.diagnose_batch(
            [
                build_tool(name="swap_tokens_alpha"),
                build_tool(
                    name="swap_tokens_beta",
                    description="Swap tokens.",
                    inputSchema={
                        "type": "object",
                        "properties": {"tokenIn": {"type": "string", "description": "token"}},
                        "required": ["tokenIn"],
                    },
                ),
            ]
        )
    )
    assert {report.tool_name for report in reports} == {"swap_tokens_alpha", "swap_tokens_beta"}
    assert all(report.metrics.callability.tests_run == 3 for report in reports)
    assert all(not hasattr(report, "overall_score") for report in reports)


def test_engine_marks_skipped_llm_with_healthy_diagnosis_when_metrics_are_clear(tmp_path: Path) -> None:
    store = ReportStore(tmp_path / "reports.db")
    engine = ScoringEngine(store=store, llm_client=StubLLMClient())
    report = asyncio.run(engine.diagnose(build_tool(runLlmTest=False)))
    assert report.metrics.callability.skipped is True
    assert report.diagnosis.failure_mode == "healthy"
    assert report.diagnosis.root_cause is not None


def test_engine_prioritizes_raw_callability_counts_for_healthy_diagnosis(tmp_path: Path) -> None:
    store = ReportStore(tmp_path / "reports.db")
    engine = ScoringEngine(store=store, llm_client=StubLLMClient(["invoked", "invoked", "invoked"]))
    report = asyncio.run(
        engine.diagnose(
            build_tool(
                inputSchema={"type": "object", "properties": {"data": {"type": "string"}}, "required": ["data"]},
            )
        )
    )
    assert report.metrics.callability.invoke_count == 3
    assert report.diagnosis.failure_mode == "healthy"


def test_fallback_fastapi_returns_500_for_unexpected_errors() -> None:
    app = FastAPI(title="test")

    @app.get("/boom")
    async def boom() -> dict[str, str]:
        raise RuntimeError("boom")

    response = asyncio.run(app.request("GET", "/boom"))
    assert response.status_code == 500
    assert response.json()["detail"] == "boom"


def test_api_endpoints_handle_diagnose_batch_and_fetch(tmp_path: Path) -> None:
    app = create_app(
        db_path=tmp_path / "reports.db",
        llm_client=StubLLMClient(),
    )
    diagnose_response = asyncio.run(
        app.request("POST", "/api/v1/diagnose", json=build_tool().model_dump(by_alias=True))
    )
    assert diagnose_response.status_code == 200
    diagnose_payload = diagnose_response.json()
    report_id = diagnose_payload["reportId"]
    assert diagnose_payload["toolName"] == "swap_tokens"
    assert diagnose_payload["metrics"]["schema"]["totalFields"] == 4
    assert "overallScore" not in diagnose_payload

    batch_response = asyncio.run(
        app.request(
            "POST",
            "/api/v1/diagnose/batch",
            json={
                "tools": [
                    build_tool(name="swap_a").model_dump(by_alias=True),
                    build_tool(name="swap_b").model_dump(by_alias=True),
                ]
            },
        )
    )
    assert batch_response.status_code == 200
    assert len(batch_response.json()["reports"]) == 2

    fetch_response = asyncio.run(app.request("GET", f"/api/v1/report/{report_id}"))
    assert fetch_response.status_code == 200
    assert fetch_response.json()["reportId"] == report_id
