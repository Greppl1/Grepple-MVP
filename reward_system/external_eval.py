"""External agent evaluation — completely independent from scoring_engine diagnostics.

External agents submit their own reports (with callability data from real tool usage).
The reward system validates and classifies the result for token rewards.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from reward_system.models.external_report import (
    CallabilityMetrics,
    ExternalMetrics,
    ExternalReport,
)
from reward_system.models.reward import RewardResult, TestTaskEvent
from reward_system.rewards import process_reward_event
from scoring_engine.models.report import DescriptionMetrics, SchemaMetrics
from scoring_engine.models.tool_input import ToolInput


class ExternalEvaluationRequest(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    agent_wallet: str = Field(alias="agentWallet")
    tool: ToolInput
    report: ExternalReport


class ExternalEvaluationResponse(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    report: ExternalReport
    reward: RewardResult


def validate_external_report(report: ExternalReport) -> ExternalReport:
    metrics = report.metrics
    if not isinstance(metrics, ExternalMetrics):
        raise ValueError("External report metrics must match ExternalMetrics schema")
    if not isinstance(metrics.schema_health, SchemaMetrics):
        raise ValueError("External report schema metrics must match SchemaMetrics")
    if not isinstance(metrics.description, DescriptionMetrics):
        raise ValueError(
            "External report description metrics must match DescriptionMetrics"
        )
    if not isinstance(metrics.callability, CallabilityMetrics):
        raise ValueError(
            "External report callability metrics must match CallabilityMetrics"
        )
    return report


def determine_test_result(
    report: ExternalReport,
) -> Literal["success", "failed_with_diagnosis", "invalid"]:
    callability = report.metrics.callability
    has_issues = (
        bool(report.metrics.schema_health.issues)
        or bool(report.metrics.description.issues)
        or bool(callability.issues)
    )
    if callability.invoke_count > 0 and callability.error_count == 0 and not has_issues:
        return "success"
    if has_issues:
        return "failed_with_diagnosis"
    return "invalid"


def build_reward_from_external_eval(request: ExternalEvaluationRequest) -> RewardResult:
    validate_external_report(request.report)
    if request.report.tool_name != request.tool.name:
        raise ValueError("External report does not match the submitted tool")
    event = TestTaskEvent.model_validate(
        {
            "event": "test_task_completed",
            "data": {
                "taskId": str(uuid.uuid4()),
                "agentWallet": request.agent_wallet,
                "toolId": request.tool.name,
                "result": determine_test_result(request.report),
                "scores": {
                    "callSuccess": request.report.metrics.callability.invoke_count > 0,
                    "structuredReport": True,
                },
                "timestamp": request.report.timestamp,
            },
        }
    )
    return process_reward_event(event)
