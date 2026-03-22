from __future__ import annotations

import re
from datetime import UTC, datetime

import httpx

from reward_system.models.reward import RewardResult, RewardTier, TestTaskEvent


_ETH_ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")


def validate_agent_wallet(wallet: str) -> bool:
    if not _ETH_ADDRESS_PATTERN.fullmatch(wallet):
        return False
    if wallet.islower() or wallet.isupper():
        return True
    checksum_valid = _validate_eip55_checksum(wallet)
    return checksum_valid if checksum_valid is not None else True


def classify_reward(event: TestTaskEvent) -> RewardTier:
    result = event.data.result
    scores = event.data.scores
    if result == "success" and scores.call_success and scores.structured_report:
        return RewardTier.FULL
    if result == "failed_with_diagnosis":
        return RewardTier.PARTIAL
    return RewardTier.NONE


def process_reward_event(event: TestTaskEvent) -> RewardResult:
    if not validate_agent_wallet(event.data.agent_wallet):
        raise ValueError("Invalid agent wallet")
    reward_tier = classify_reward(event)
    reward_percentage = {
        RewardTier.FULL: 100,
        RewardTier.PARTIAL: 50,
        RewardTier.NONE: 0,
    }[reward_tier]
    return RewardResult(
        taskId=event.data.task_id,
        agentWallet=event.data.agent_wallet,
        toolId=event.data.tool_id,
        rewardTier=reward_tier,
        rewardPercentage=reward_percentage,
        eventTimestamp=event.data.timestamp,
        processedAt=datetime.now(UTC).isoformat(),
    )


def send_webhook(
    reward: RewardResult, webhook_url: str, api_key: str = ""
) -> dict[str, object]:
    payload = reward.model_dump(mode="json", by_alias=True)
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        response = httpx.post(webhook_url, json=payload, headers=headers, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        return {
            "success": False,
            "status_code": exc.response.status_code,
            "error": str(exc),
        }
    except httpx.HTTPError as exc:
        return {
            "success": False,
            "error": str(exc),
        }
    return {
        "success": True,
        "status_code": response.status_code,
    }


def _validate_eip55_checksum(wallet: str) -> bool | None:
    wallet_body = wallet[2:]
    try:
        from eth_utils import keccak  # type: ignore
    except ImportError:  # pragma: no cover - fallback path depends on environment
        try:
            from Crypto.Hash import keccak as crypto_keccak  # type: ignore
        except ImportError:  # pragma: no cover - fallback path depends on environment
            return None

        def hash_hex(value: str) -> str:
            digest = crypto_keccak.new(digest_bits=256)
            digest.update(value.encode("ascii"))
            return digest.hexdigest()

    else:

        def hash_hex(value: str) -> str:
            return keccak(text=value).hex()

    normalized = wallet_body.lower()
    hashed = hash_hex(normalized)
    for index, character in enumerate(wallet_body):
        if character.isdigit():
            continue
        expected_upper = int(hashed[index], 16) >= 8
        if expected_upper != character.isupper():
            return False
    return True
