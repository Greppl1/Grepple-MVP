const { ethers } = require('ethers');
const contractService = require('./contractService');
const txQueue = require('./txQueue');
const logger = require('./logger');

/**
 * Validate and checksum a wallet address
 */
function validateAddress(address) {
  try {
    return ethers.getAddress(address);
  } catch {
    throw new Error(`Invalid wallet address: ${address}`);
  }
}

/**
 * Register an agent on-chain (uses registerAgentFor — operator pattern)
 */
async function registerAgent({ wallet_address, agent_id }) {
  const checksummed = validateAddress(wallet_address);
  await contractService.ensureProviderConnected();
  const registry = contractService.getRegistryContract();
  const agentIdHash = ethers.keccak256(ethers.toUtf8Bytes(agent_id));

  logger.tx('register_agent_start', { wallet: checksummed, agent_id });

  // Use registerAgentFor if available (new contract), fall back to registerAgent
  let receipt;
  try {
    receipt = await txQueue.enqueue(() =>
      registry.registerAgentFor(checksummed, agentIdHash)
    );
  } catch (err) {
    // If registerAgentFor doesn't exist (old contract), try registerAgent
    if (err.message && err.message.includes('is not a function')) {
      logger.warn('registerAgentFor_not_available', { fallback: 'registerAgent' });
      receipt = await txQueue.enqueue(() =>
        registry.registerAgent(agentIdHash)
      );
    } else {
      throw err;
    }
  }

  const profile = await registry.getAgentProfile(checksummed);

  logger.tx('register_agent_complete', { wallet: checksummed, tx_hash: receipt.hash });

  return {
    tx_hash: receipt.hash,
    agent_profile: formatProfile(profile),
  };
}

/**
 * Get agent profile
 */
async function getAgentProfile(wallet) {
  const checksummed = validateAddress(wallet);
  await contractService.ensureProviderConnected();
  const registry = contractService.getRegistryContract();
  const profile = await registry.getAgentProfile(checksummed);

  return formatProfile(profile);
}

/**
 * Check if an agent is registered
 */
async function isRegistered(wallet) {
  const checksummed = validateAddress(wallet);
  const registry = contractService.getRegistryContract();
  return registry.isRegisteredAgent(checksummed);
}

/**
 * Get agent's reward history (mint records + total earned)
 * Uses Promise.all for parallel RPC calls instead of sequential loop
 */
async function getAgentRewards(wallet) {
  const checksummed = validateAddress(wallet);
  await contractService.ensureProviderConnected();
  const tokenContract = contractService.getTokenContract();

  const mintIds = await tokenContract.getMintsByAgent(checksummed);

  if (mintIds.length === 0) {
    return { mint_records: [], total_earned: '0' };
  }

  // Parallel fetch all mint records
  const records = await Promise.all(
    mintIds.map(async (mintId) => {
      const record = await tokenContract.getMintRecord(mintId);
      return {
        mint_id: mintId.toString(),
        agent: record.agent,
        amount: record.amount.toString(),
        task_hash: record.taskHash,
        call_record_hash: record.callRecordHash,
        timestamp: Number(record.timestamp),
        tier: ['FULL', 'PARTIAL', 'NONE'][Number(record.tier)],
      };
    })
  );

  const totalEarned = records.reduce(
    (sum, r) => sum + BigInt(r.amount),
    0n
  );

  return {
    mint_records: records,
    total_earned: totalEarned.toString(),
  };
}

function formatProfile(profile) {
  return {
    wallet: profile.wallet,
    operator: profile.operator,
    agent_id_hash: profile.agentIdHash,
    registered_at: Number(profile.registeredAt),
    is_active: profile.isActive,
    total_earned: profile.totalEarned.toString(),
    task_count: Number(profile.taskCount),
  };
}

module.exports = {
  registerAgent,
  getAgentProfile,
  isRegistered,
  getAgentRewards,
};
