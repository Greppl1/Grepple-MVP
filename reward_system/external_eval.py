from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from reward_system.models.reward import RewardResult, TestTaskEvent
from reward_system.rewards import process_reward_event
from scoring_engine.models.report import (
    CallabilityMetrics,
    DescriptionMetrics,
    DiagnosticReport,
    Metrics,
    SchemaMetrics,
)
from scoring_engine.models.tool_input import ToolInput


class ExternalEvaluationRequest(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    agent_wallet: str = Field(alias="agentWallet")
    tool: ToolInput
    report: DiagnosticReport


class ExternalEvaluationResponse(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    report: DiagnosticReport
    reward: RewardResult


def validate_external_report(report: DiagnosticReport) -> DiagnosticReport:
    metrics = report.metrics
    if not isinstance(metrics, Metrics):
        raise ValueError("External report metrics must match the internal schema")
    if not isinstance(metrics.schema_health, SchemaMetrics):
        raise ValueError("External report schema metrics must match SchemaMetrics")
    if not isinstance(metrics.description, DescriptionMetrics):
        raise ValueError("External report description metrics must match DescriptionMetrics")
    if not isinstance(metrics.callability, CallabilityMetrics):
        raise ValueError("External report callability metrics must match CallabilityMetrics")
    return report


def merge_external_result(
    tool_id: str,
    external_metrics: Metrics,
    internal_report: DiagnosticReport,
) -> DiagnosticReport:
    if tool_id not in {internal_report.tool_name, internal_report.original_tool.name}:
        raise ValueError("Tool identifier does not match the internal report")
    if not isinstance(external_metrics.schema_health, SchemaMetrics):
        raise ValueError("External metrics must use the internal schema metrics model")
    if not isinstance(external_metrics.description, DescriptionMetrics):
        raise ValueError("External metrics must use the internal description metrics model")
    if not isinstance(external_metrics.callability, CallabilityMetrics):
        raise ValueError("External metrics must use the internal callability metrics model")
    return internal_report.model_copy(update={"tool_name": tool_id, "metrics": external_metrics}, deep=True)


def determine_test_result(report: DiagnosticReport) -> Literal["success", "failed_with_diagnosis", "invalid"]:
    diagnosis = report.diagnosis
    callability = report.metrics.callability
    if diagnosis.failure_mode == "healthy" and callability.invoke_count > 0:
        return "success"
    if diagnosis.failure_mode != "healthy" and bool(diagnosis.issues):
        return "failed_with_diagnosis"
    return "invalid"


def build_reward_from_external_eval(request: ExternalEvaluationRequest) -> RewardResult:
    validate_external_report(request.report)
    if request.report.tool_name != request.tool.name or request.report.original_tool.name != request.tool.name:
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
