"""Models for external agent evaluation reports.

External agents submit reports that include callability data (from real tool usage).
This is independent from the scoring_engine's internal diagnostic reports which
only contain static analysis (schema + description).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from scoring_engine.models.report import (
    DescriptionMetrics,
    Issue,
    SchemaMetrics,
)

PromptOutcome = Literal["invoked", "mentioned", "silent", "error", "skipped"]
IssueSeverity = Literal["critical", "high", "medium", "low"]


class PromptTestResult(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    tier: str
    prompt_type: Literal["direct", "ambiguous", "competitive"]
    prompt: str
    outcome: PromptOutcome
    reasoning: str | None = None


class CallabilityMetrics(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    tests_run: int = Field(alias="testsRun")
    invoke_count: int = Field(alias="invokeCount")
    mention_count: int = Field(alias="mentionCount")
    silent_count: int = Field(alias="silentCount")
    error_count: int = Field(alias="errorCount")
    skipped: bool = False
    test_details: list[PromptTestResult] = Field(
        alias="testDetails", default_factory=list
    )
    issues: list[Issue] = Field(default_factory=list)


class ExternalMetrics(BaseModel):
    """Metrics submitted by external agents — includes callability from real usage."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    schema_health: SchemaMetrics = Field(alias="schema")
    description: DescriptionMetrics
    callability: CallabilityMetrics


class ExternalReport(BaseModel):
    """Report format submitted by external agents."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    report_id: str = Field(alias="reportId")
    tool_name: str = Field(alias="toolName")
    timestamp: str
    metrics: ExternalMetrics
    tool_input: dict[str, Any] = Field(alias="toolInput")
