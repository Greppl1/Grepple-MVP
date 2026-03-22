const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const contractService = require('./contractService');
const config = require('../config');
const txQueue = require('./txQueue');
const logger = require('./logger');

// RewardTier enum matching the contract
const RewardTier = {
  FULL: 0,
  PARTIAL: 1,
  NONE: 2,
};

// ───────────────────── File-backed idempotency ─────────────────────

const IDEMPOTENCY_FILE = path.resolve(config.idempotencyFile || './data/minted_tasks.json');

function loadMintedTasks() {
  try {
    if (fs.existsSync(IDEMPOTENCY_FILE)) {
      const data = JSON.parse(fs.readFileSync(IDEMPOTENCY_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (err) {
    logger.warn('idempotency_load_failed', { error: err.message, file: IDEMPOTENCY_FILE });
  }
  return new Map();
}

async function saveMintedTasks() {
  try {
    const dir = path.dirname(IDEMPOTENCY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpFile = IDEMPOTENCY_FILE + '.tmp';
    await fs.promises.writeFile(tmpFile, JSON.stringify(Object.fromEntries(mintedTasks), null, 2));
    await fs.promises.rename(tmpFile, IDEMPOTENCY_FILE);
  } catch (err) {
    logger.warn('idempotency_save_failed', { error: err.message, file: IDEMPOTENCY_FILE });
  }
}

const mintedTasks = loadMintedTasks();

// In-flight mint locks to prevent TOCTOU race conditions
const inFlightMints = new Set();

// ───────────────────── Helpers ─────────────────────

/**
 * Normalize camelCase/snake_case fields from Jerry's events
 */
function normalizeEventData(data) {
  return {
    task_id: data.task_id || data.taskId,
    agent_wallet: data.agent_wallet || data.agentWallet,
    tool_id: data.tool_id || data.toolId,
    result: data.result,
    scores: data.scores ? {
      call_success: data.scores.call_success ?? data.scores.callSuccess,
      structured_report: data.scores.structured_report ?? data.scores.structuredReport,
    } : null,
    timestamp: data.timestamp,
  };
}

/**
 * Determine RewardTier from Jerry's test_task_completed event
 */
function determineRewardTier(event) {
  const raw = event.data || event;
  const { result, scores } = normalizeEventData(raw);

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
 * Validate wallet address format
 */
function validateAddress(address) {
  if (!address) {
    throw new Error('Wallet address is required');
  }
  try {
    return ethers.getAddress(address);
  } catch {
    throw new Error(`Invalid wallet address: ${address}`);
  }
}

// ───────────────────── Core mint logic ─────────────────────

/**
 * Mint reward tokens for a completed test task
 */
async function mintReward({ agent_wallet, task_id, call_record_id, tier }) {
  // Validate inputs
  if (!task_id) throw new Error('task_id is required');
  const checksummedWallet = validateAddress(agent_wallet);

  // Idempotency check (file-backed)
  if (mintedTasks.has(task_id)) {
    logger.info('mint_idempotent', { task_id });
    return mintedTasks.get(task_id);
  }

  // Acquire in-flight lock to prevent TOCTOU race (concurrent requests with same task_id)
  if (inFlightMints.has(task_id)) {
    logger.info('mint_in_flight', { task_id });
    return { task_id, mint_status: 'pending', mint_id: null, tx_hash: null, amount: '0', tier: null };
  }
  inFlightMints.add(task_id);

  try {
  // Determine tier
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

  // Ensure RPC connection is healthy before contract calls
  await contractService.ensureProviderConnected();

  // Check if agent is registered
  const registryContract = contractService.getRegistryContract();
  const isRegistered = await registryContract.isRegisteredAgent(checksummedWallet);
  if (!isRegistered) {
    throw new Error('Agent not registered');
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
    await saveMintedTasks();
    return result;
  }

  const amount = calculateAmount(rewardTier);
  const taskHash = ethers.keccak256(ethers.toUtf8Bytes(task_id));
  const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes(call_record_id || ''));

  const tokenContract = contractService.getTokenContract();

  // Check if task was already minted on-chain (in case our file map was stale)
  try {
    const alreadyMinted = await tokenContract.isTaskMinted(taskHash);
    if (alreadyMinted) {
      logger.warn('task_already_minted_onchain', { task_id });
      const result = {
        task_id,
        mint_status: 'minted',
        mint_id: null,
        tx_hash: null,
        amount: amount.toString(),
        tier: Object.keys(RewardTier).find((k) => RewardTier[k] === rewardTier),
      };
      mintedTasks.set(task_id, result);
      await saveMintedTasks();
      return result;
    }
  } catch {
    // isTaskMinted may not exist on older deployed contracts — proceed
  }

  logger.tx('mint_start', { agent: checksummedWallet, task_id, tier: rewardTier, amount: amount.toString() });

  // Enqueue the transaction to prevent nonce conflicts
  const receipt = await txQueue.enqueue(() =>
    tokenContract.mint(checksummedWallet, amount, taskHash, callRecordHash, rewardTier)
  );

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
          mintId = parsed.args.mintId.toString();
          break;
        }
      } catch {
        // Not our event, skip
      }
    }
  }

  if (mintId === null) {
    logger.warn('mint_id_not_parsed', { task_id, tx_hash: receipt.hash });
  }

  const tierName = Object.keys(RewardTier).find((k) => RewardTier[k] === rewardTier);

  // Update agent stats on-chain (best effort — don't fail the mint if this fails)
  try {
    const registryContract2 = contractService.getRegistryContract();
    await txQueue.enqueue(() =>
      registryContract2.updateAgentStats(checksummedWallet, amount, 1)
    );
    logger.info('agent_stats_updated', { agent: checksummedWallet, earned: amount.toString() });
  } catch (err) {
    logger.warn('agent_stats_update_failed', { agent: checksummedWallet, error: err.message });
  }

  const result = {
    task_id,
    mint_status: 'minted',
    mint_id: mintId,
    tx_hash: receipt.hash,
    amount: amount.toString(),
    tier: tierName,
  };

  mintedTasks.set(task_id, result);
  await saveMintedTasks();
  logger.tx('mint_complete', { task_id, mint_id: mintId, tx_hash: receipt.hash });
  return result;

  } finally {
    inFlightMints.delete(task_id);
  }
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
 * Process a Jerry test_task_completed event (accepts both camelCase and snake_case)
 */
async function processTestTaskCompleted(event) {
  const raw = event.data || event;
  const normalized = normalizeEventData(raw);

  if (!normalized.agent_wallet) throw new Error('agent_wallet is required in event data');
  if (!normalized.task_id) throw new Error('task_id is required in event data');

  const rewardTier = determineRewardTier(event);
  const tierName = Object.keys(RewardTier).find((k) => RewardTier[k] === rewardTier);

  return mintReward({
    agent_wallet: normalized.agent_wallet,
    task_id: normalized.task_id,
    call_record_id: `cr_${normalized.task_id}`,
    tier: tierName,
  });
}

/**
 * Process Jerry's RewardResult directly (from /api/rewards/mint response)
 */
async function processRewardResult(rewardResult) {
  const taskId = rewardResult.taskId || rewardResult.task_id;
  const agentWallet = rewardResult.agentWallet || rewardResult.agent_wallet;
  const rewardTier = rewardResult.rewardTier || rewardResult.reward_tier;

  if (!taskId) throw new Error('taskId/task_id is required');
  if (!agentWallet) throw new Error('agentWallet/agent_wallet is required');

  // Map Jerry's tier names to ours
  const tierMap = { full: 'FULL', partial: 'PARTIAL', none: 'NONE' };
  const tier = tierMap[rewardTier?.toLowerCase()] || rewardTier?.toUpperCase();

  return mintReward({
    agent_wallet: agentWallet,
    task_id: taskId,
    call_record_id: `cr_${taskId}`,
    tier,
  });
}

// For testing: clear the idempotency map
function clearMintedTasks() {
  mintedTasks.clear();
}

module.exports = {
  RewardTier,
  normalizeEventData,
  determineRewardTier,
  calculateAmount,
  mintReward,
  getMintStatus,
  processTestTaskCompleted,
  processRewardResult,
  clearMintedTasks,
};
