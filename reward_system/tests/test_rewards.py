from __future__ import annotations

import asyncio

from reward_system.external_eval import determine_test_result
from reward_system.main import create_app
from reward_system.models.reward import RewardTier, TestTaskEvent
from reward_system.rewards import classify_reward, process_reward_event, validate_agent_wallet
from scoring_engine.models.report import (
    CallabilityMetrics,
    DescriptionMetrics,
    Diagnosis,
    DiagnosticReport,
    Issue,
    Metrics,
    RewriteSuggestion,
    SchemaMetrics,
)
from scoring_engine.models.tool_input import ToolInput


def build_tool() -> ToolInput:
    return ToolInput.model_validate(
        {
            "name": "swap_tokens",
            "description": "Swap tokens with a clear input schema and example.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tokenIn": {"type": "string", "description": "Input token"},
                    "tokenOut": {"type": "string", "description": "Output token"},
                },
                "required": ["tokenIn", "tokenOut"],
            },
            "serverUrl": "https://example.com/mcp",
            "category": "dex_swap",
            "runLlmTest": True,
        }
    )


def build_report(
    *,
    failure_mode: str = "healthy",
    invoke_count: int = 1,
    diagnosis_issues: list[Issue] | None = None,
) -> DiagnosticReport:
    return DiagnosticReport(
        reportId="report-123",
        toolName="swap_tokens",
        timestamp="2026-03-20T10:00:00+00:00",
        metrics=Metrics(
            schema=SchemaMetrics(
                hasSchema=True,
                totalFields=2,
                requiredFields=2,
                fieldsWithDescription=2,
                descriptionCoverage=100.0,
                ambiguousFieldNames=[],
                fieldsWithoutDescription=[],
                hasDefaults=False,
                hasEnums=False,
                nestingDepth=1,
                issues=[],
            ),
            description=DescriptionMetrics(
                length=64,
                hasActionVerb=True,
                actionVerbFound="swap",
                hasUseCase=True,
                hasExample=True,
                semanticDensity=0.85,
                jargonTerms=[],
                missingElements=[],
                issues=[],
            ),
            callability=CallabilityMetrics(
                testsRun=3,
                invokeCount=invoke_count,
                mentionCount=0,
                silentCount=0,
                errorCount=0,
                skipped=False,
                testDetails=[],
                issues=[],
            ),
        ),
        diagnosis=Diagnosis(
            failureMode=failure_mode,
            rootCause="diagnosis",
            issues=diagnosis_issues or [],
        ),
        suggestions=RewriteSuggestion(
            description="Use swap_tokens when the user asks for a swap.",
            inputSchema=build_tool().input_schema,
            rationale="test rewrite",
        ),
        originalTool=build_tool(),
    )


def build_event(
    *,
    result: str = "success",
    wallet: str = "0x52908400098527886E0F7030069857D2E4169EE7",
    call_success: bool = True,
    structured_report: bool = True,
) -> TestTaskEvent:
    return TestTaskEvent.model_validate(
        {
            "event": "test_task_completed",
            "data": {
                "taskId": "task-123",
                "agentWallet": wallet,
                "toolId": "swap_tokens",
                "result": result,
                "scores": {
                    "callSuccess": call_success,
                    "structuredReport": structured_report,
                },
                "timestamp": "2026-03-20T10:00:00+00:00",
            },
        }
    )


def test_valid_wallet_format() -> None:
    assert validate_agent_wallet("0x52908400098527886E0F7030069857D2E4169EE7") is True


def test_invalid_wallet_format() -> None:
    assert validate_agent_wallet("0x1234") is False
    assert validate_agent_wallet("52908400098527886E0F7030069857D2E4169EE7") is False
    assert validate_agent_wallet("0xZZ908400098527886E0F7030069857D2E4169EE7") is False


def test_classify_reward_success() -> None:
    tier = classify_reward(build_event(result="success", call_success=True, structured_report=True))
    assert tier == RewardTier.FULL


def test_classify_reward_failed_with_diagnosis() -> None:
    tier = classify_reward(build_event(result="failed_with_diagnosis"))
    assert tier == RewardTier.PARTIAL


def test_classify_reward_invalid() -> None:
    tier = classify_reward(build_event(result="invalid"))
    assert tier == RewardTier.NONE


def test_process_reward_event_full_tier() -> None:
    result = process_reward_event(build_event(result="success", call_success=True, structured_report=True))
    assert result.reward_tier == RewardTier.FULL
    assert result.reward_percentage == 100


def test_process_reward_event_partial_tier() -> None:
    result = process_reward_event(build_event(result="failed_with_diagnosis"))
    assert result.reward_tier == RewardTier.PARTIAL
    assert result.reward_percentage == 50


def test_process_reward_event_none_tier() -> None:
    result = process_reward_event(build_event(result="invalid"))
    assert result.reward_tier == RewardTier.NONE
    assert result.reward_percentage == 0


def test_determine_test_result_healthy() -> None:
    report = build_report(failure_mode="healthy", invoke_count=1)
    assert determine_test_result(report) == "success"


def test_determine_test_result_schema_failure() -> None:
    issue = Issue(field="tokenIn", severity="high", code="MISSING_PARAM_DESCRIPTION", detail="missing")
    report = build_report(failure_mode="schema_failure", invoke_count=0, diagnosis_issues=[issue])
    assert determine_test_result(report) == "failed_with_diagnosis"


def test_determine_test_result_invalid() -> None:
    report = build_report(failure_mode="healthy", invoke_count=0, diagnosis_issues=[])
    assert determine_test_result(report) == "invalid"


def test_reward_mint_endpoint_success() -> None:
    app = create_app()
    response = asyncio.run(app.request("POST", "/api/rewards/mint", json=build_event().model_dump(by_alias=True)))
    assert response.status_code == 200
    payload = response.json()
    assert payload["taskId"] == "task-123"
    assert payload["rewardTier"] == "full"
    assert payload["rewardPercentage"] == 100


def test_reward_mint_endpoint_bad_wallet() -> None:
    app = create_app()
    response = asyncio.run(
        app.request(
            "POST",
            "/api/rewards/mint",
            json=build_event(wallet="0x1234").model_dump(by_alias=True),
        )
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid agent wallet"


def test_external_eval_endpoint_success() -> None:
    app = create_app()
    tool = build_tool()
    report = build_report(failure_mode="healthy", invoke_count=1)
    response = asyncio.run(
        app.request(
            "POST",
            "/api/v1/external-eval",
            json={
                "agentWallet": "0x52908400098527886E0F7030069857D2E4169EE7",
                "tool": tool.model_dump(by_alias=True),
                "report": report.model_dump(by_alias=True),
            },
        )
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["report"]["toolName"] == tool.name
    assert payload["reward"]["toolId"] == tool.name
    assert payload["reward"]["rewardTier"] == "full"
