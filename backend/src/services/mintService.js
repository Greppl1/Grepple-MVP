const { ethers } = require('ethers');
const contractService = require('./contractService');
const config = require('../config');

// In-memory idempotency map: task_id -> mint result
const mintedTasks = new Map();

// RewardTier enum matching the contract
const RewardTier = {
  FULL: 0,
  PARTIAL: 1,
  NONE: 2,
};

/**
 * Determine RewardTier from Jerry's test_task_completed event
 */
function determineRewardTier(event) {
  const { result, scores } = event.data || event;

  if (result === 'success' && scores && scores.call_success && scores.structured_report) {
    return RewardTier.FULL;
  }
  if (result === 'failed_with_diagnosis') {
    return RewardTier.PARTIAL;
  }
  return RewardTier.NONE;
}

/**
 * Calculate the mint amount based on tier
 */
function calculateAmount(tier, baseReward) {
  const base = BigInt(baseReward || config.rewardAmount);
  switch (tier) {
    case RewardTier.FULL:
      return base;
    case RewardTier.PARTIAL:
      return base / 2n;
    case RewardTier.NONE:
    default:
      return 0n;
  }
}

/**
 * Mint reward tokens for a completed test task
 */
async function mintReward({ agent_wallet, task_id, call_record_id, tier }) {
  // Idempotency check
  if (mintedTasks.has(task_id)) {
    return mintedTasks.get(task_id);
  }

  // Determine tier (can be passed directly as string or determined from event)
  let rewardTier;
  if (typeof tier === 'string') {
    rewardTier = RewardTier[tier.toUpperCase()];
    if (rewardTier === undefined) {
      throw new Error(`Invalid tier: ${tier}`);
    }
  } else if (typeof tier === 'number') {
    rewardTier = tier;
  } else {
    throw new Error('Tier is required');
  }

  // NONE tier -> rejected, don't mint
  if (rewardTier === RewardTier.NONE) {
    const result = {
      task_id,
      mint_status: 'rejected',
      mint_id: null,
      tx_hash: null,
      amount: '0',
      tier: 'NONE',
    };
    mintedTasks.set(task_id, result);
    return result;
  }

  const amount = calculateAmount(rewardTier);

  const taskHash = ethers.keccak256(ethers.toUtf8Bytes(task_id));
  const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes(call_record_id || ''));

  const tokenContract = contractService.getTokenContract();

  const tx = await tokenContract.mint(
    agent_wallet,
    amount,
    taskHash,
    callRecordHash,
    rewardTier
  );
  const receipt = await tx.wait();

  // Parse the mint ID from the event
  let mintId = null;
  if (receipt.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = tokenContract.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed && parsed.name === 'TokenMinted') {
          mintId = Number(parsed.args.mintId);
          break;
        }
      } catch (e) {
        // Not our event, skip
      }
    }
  }

  const tierName = Object.keys(RewardTier).find((k) => RewardTier[k] === rewardTier);

  const result = {
    task_id,
    mint_status: 'minted',
    mint_id: mintId,
    tx_hash: receipt.hash,
    amount: amount.toString(),
    tier: tierName,
  };

  mintedTasks.set(task_id, result);
  return result;
}

/**
 * Get mint status for a task
 */
function getMintStatus(task_id) {
  if (mintedTasks.has(task_id)) {
    return mintedTasks.get(task_id);
  }
  return {
    task_id,
    mint_status: 'pending',
    mint_id: null,
    tx_hash: null,
    amount: '0',
    tier: null,
  };
}

/**
 * Process a Jerry test_task_completed event
 */
async function processTestTaskCompleted(event) {
  const { task_id, agent_wallet } = event.data || event;

  const rewardTier = determineRewardTier(event);
  const tierName = Object.keys(RewardTier).find((k) => RewardTier[k] === rewardTier);

  return mintReward({
    agent_wallet,
    task_id,
    call_record_id: `cr_${task_id}`,
    tier: tierName,
  });
}

// For testing: clear the idempotency map
function clearMintedTasks() {
  mintedTasks.clear();
}

module.exports = {
  RewardTier,
  determineRewardTier,
  calculateAmount,
  mintReward,
  getMintStatus,
  processTestTaskCompleted,
  clearMintedTasks,
};
