from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from scoring_engine.models.report import DiagnosticReport
from scoring_engine.models.tool_input import ToolInput


class ImprovedToolSubmission(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    tool: ToolInput
    original_report_id: str = Field(alias="originalReportId")
    changes_applied: list[str] = Field(alias="changesApplied")


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    submission_id: str = Field(alias="submissionId")
    tool_name: str = Field(alias="toolName")
    original_report_id: str
    re_diagnosis: DiagnosticReport = Field(alias="reDiagnosis")
