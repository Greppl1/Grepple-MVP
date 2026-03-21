from __future__ import annotations

import asyncio
import os
from unittest.mock import AsyncMock, Mock, patch

import httpx

from reward_system.main import create_app
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
        headers={"Content-Type": "application/json"},
        timeout=10.0,
    )


def test_send_webhook_with_api_key() -> None:
    response = Mock(spec=httpx.Response)
    response.status_code = 200
    response.raise_for_status.return_value = None

    with patch("reward_system.rewards.httpx.post", return_value=response) as mock_post:
        result = send_webhook(
            build_reward(), "https://example.com/webhook", api_key="secret-key"
        )

    assert result == {"success": True, "status_code": 200}
    mock_post.assert_called_once_with(
        "https://example.com/webhook",
        json=build_reward().model_dump(mode="json", by_alias=True),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer secret-key",
        },
        timeout=10.0,
    )


def test_send_webhook_failure() -> None:
    request = httpx.Request("POST", "https://example.com/webhook")
    response = httpx.Response(500, request=request)

    with patch(
        "reward_system.rewards.httpx.post",
        side_effect=httpx.HTTPStatusError(
            "server error", request=request, response=response
        ),
    ):
        result = send_webhook(build_reward(), "https://example.com/webhook")

    assert result["success"] is False
    assert result["status_code"] == 500
    assert "server error" in str(result["error"])


def build_event() -> dict[str, object]:
    return {
        "event": "test_task_completed",
        "data": {
            "taskId": "task-123",
            "agentWallet": "0x52908400098527886E0F7030069857D2E4169EE7",
            "toolId": "swap_tokens",
            "result": "success",
            "scores": {"callSuccess": True, "structuredReport": True},
            "timestamp": "2026-03-20T10:00:00+00:00",
        },
    }


class _AsyncWebhookResponse:
    def __init__(self, status_code: int = 200) -> None:
        self.status_code = status_code

    def raise_for_status(self) -> None:
        return None


def test_reward_mint_posts_zian_webhook_payload() -> None:
    previous_url = os.environ.get("ZIAN_WEBHOOK_URL")
    os.environ["ZIAN_WEBHOOK_URL"] = "https://example.com/zian"
    try:
        app = create_app()
        with patch("reward_system.main.httpx.AsyncClient") as mock_client_cls:
            client_instance = mock_client_cls.return_value
            client_instance.__aenter__.return_value = client_instance
            client_instance.__aexit__.return_value = None
            client_instance.post = AsyncMock(
                return_value=_AsyncWebhookResponse(202)
            )

            response = asyncio.run(
                app.request("POST", "/api/rewards/mint", json=build_event())
            )
    finally:
        if previous_url is None:
            os.environ.pop("ZIAN_WEBHOOK_URL", None)
        else:
            os.environ["ZIAN_WEBHOOK_URL"] = previous_url

    assert response.status_code == 200
    mock_client_cls.assert_called_once_with(timeout=10.0)
    client_instance.post.assert_called_once()
    call = client_instance.post.call_args
    assert call.args[0] == "https://example.com/zian"
    assert call.kwargs["json"] == {
        "event": "test_task_completed",
        "data": {
            "task_id": "task-123",
            "agent_wallet": "0x52908400098527886E0F7030069857D2E4169EE7",
            "tool_id": "swap_tokens",
            "result": "success",
            "scores": {
                "call_success": True,
                "structured_report": True,
            },
            "timestamp": "2026-03-20T10:00:00+00:00",
        },
    }


def test_reward_mint_ignores_zian_webhook_failure() -> None:
    previous_url = os.environ.get("ZIAN_WEBHOOK_URL")
    os.environ["ZIAN_WEBHOOK_URL"] = "https://example.com/zian"
    try:
        app = create_app()
        with patch(
            "reward_system.main.httpx.AsyncClient.post",
            side_effect=httpx.ConnectError(
                "boom",
                request=httpx.Request("POST", "https://example.com/zian"),
            ),
        ) as mock_post:
            response = asyncio.run(
                app.request("POST", "/api/rewards/mint", json=build_event())
            )
    finally:
        if previous_url is None:
            os.environ.pop("ZIAN_WEBHOOK_URL", None)
        else:
            os.environ["ZIAN_WEBHOOK_URL"] = previous_url

    assert response.status_code == 200
    assert response.json()["rewardTier"] == "full"
    assert mock_post.call_count == 1
