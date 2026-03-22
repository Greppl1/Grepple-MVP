from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from scoring_engine.models.tool_input import ToolInput


FailureMode = Literal[
    "healthy",
    "schema_failure",
    "description_failure",
    "mixed",
]
IssueSeverity = Literal["critical", "high", "medium", "low"]


class Issue(BaseModel):
    model_config = ConfigDict(frozen=True)

    field: str
    severity: IssueSeverity
    code: str
    detail: str


class SchemaMetrics(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    has_schema: bool = Field(alias="hasSchema")
    total_fields: int = Field(alias="totalFields")
    required_fields: int = Field(alias="requiredFields")
    fields_with_description: int = Field(alias="fieldsWithDescription")
    description_coverage: float = Field(alias="descriptionCoverage")
    ambiguous_field_names: list[str] = Field(alias="ambiguousFieldNames", default_factory=list)
    fields_without_description: list[str] = Field(alias="fieldsWithoutDescription", default_factory=list)
    has_defaults: bool = Field(alias="hasDefaults")
    has_enums: bool = Field(alias="hasEnums")
    nesting_depth: int = Field(alias="nestingDepth")
    issues: list[Issue] = Field(default_factory=list)


class DescriptionMetrics(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    length: int
    has_action_verb: bool = Field(alias="hasActionVerb")
    action_verb_found: str | None = Field(alias="actionVerbFound", default=None)
    has_use_case: bool = Field(alias="hasUseCase")
    has_example: bool = Field(alias="hasExample")
    semantic_density: float = Field(alias="semanticDensity")
    jargon_terms: list[str] = Field(alias="jargonTerms", default_factory=list)
    missing_elements: list[str] = Field(alias="missingElements", default_factory=list)
    issues: list[Issue] = Field(default_factory=list)


class RewriteSuggestion(BaseModel):
    model_config = ConfigDict(frozen=True)

    description: str
    input_schema: dict[str, Any] = Field(alias="inputSchema")
    rationale: str


class Diagnosis(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    failure_mode: FailureMode = Field(alias="failureMode")
    root_cause: str | None = Field(alias="rootCause", default=None)
    issues: list[Issue] = Field(default_factory=list)


class Metrics(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    schema_health: SchemaMetrics = Field(alias="schema")
    description: DescriptionMetrics


class DiagnosticReport(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    report_id: str = Field(alias="reportId")
    tool_name: str = Field(alias="toolName")
    timestamp: str

    metrics: Metrics
    diagnosis: Diagnosis
    suggestions: RewriteSuggestion

    original_tool: ToolInput = Field(alias="originalTool")


class BatchDiagnosisRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    tools: list[ToolInput]


class BatchDiagnosisResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    reports: list[DiagnosticReport]
