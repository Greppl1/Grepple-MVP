from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TestTaskScores(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    __test__ = False

    call_success: bool = Field(alias="callSuccess")
    structured_report: bool = Field(alias="structuredReport")


class TestTaskData(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    __test__ = False

    task_id: str = Field(alias="taskId")
    agent_wallet: str = Field(alias="agentWallet")
    tool_id: str = Field(alias="toolId")
    result: Literal["success", "failed_with_diagnosis", "invalid"]
    scores: TestTaskScores
    timestamp: str


class TestTaskEvent(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    __test__ = False

    event: Literal["test_task_completed"]
    data: TestTaskData


class RewardTier(str, Enum):
    FULL = "full"
    PARTIAL = "partial"
    NONE = "none"


class RewardResult(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    task_id: str = Field(alias="taskId")
    agent_wallet: str = Field(alias="agentWallet")
    tool_id: str = Field(alias="toolId")
    reward_tier: RewardTier = Field(alias="rewardTier")
    reward_percentage: int = Field(alias="rewardPercentage")
    event_timestamp: str = Field(alias="eventTimestamp")
    processed_at: str = Field(alias="processedAt")
