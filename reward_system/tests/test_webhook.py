from __future__ import annotations

from unittest.mock import Mock, patch

import httpx

from reward_system.models.reward import RewardResult, RewardTier
from reward_system.rewards import send_webhook


def build_reward() -> RewardResult:
    return RewardResult(
        taskId="task-123",
        agentWallet="0x52908400098527886E0F7030069857D2E4169EE7",
        toolId="swap_tokens",
        rewardTier=RewardTier.FULL,
        rewardPercentage=100,
        eventTimestamp="2026-03-20T10:00:00+00:00",
        processedAt="2026-03-20T10:01:00+00:00",
    )


def test_send_webhook_success() -> None:
    response = Mock(spec=httpx.Response)
    response.status_code = 200
    response.raise_for_status.return_value = None

    with patch("reward_system.rewards.httpx.post", return_value=response) as mock_post:
        result = send_webhook(build_reward(), "https://example.com/webhook")

    assert result == {"success": True, "status_code": 200}
    mock_post.assert_called_once_with(
        "https://example.com/webhook",
        json=build_reward().model_dump(mode="json", by_alias=True),
        timeout=10.0,
    )


def test_send_webhook_failure() -> None:
    request = httpx.Request("POST", "https://example.com/webhook")
    response = httpx.Response(500, request=request)

    with patch(
        "reward_system.rewards.httpx.post",
        side_effect=httpx.HTTPStatusError("server error", request=request, response=response),
    ):
        result = send_webhook(build_reward(), "https://example.com/webhook")

    assert result["success"] is False
    assert result["status_code"] == 500
    assert "server error" in str(result["error"])
