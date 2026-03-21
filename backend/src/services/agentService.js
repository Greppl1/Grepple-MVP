const { ethers } = require('ethers');
const contractService = require('./contractService');

/**
 * Register an agent on-chain
 */
async function registerAgent({ wallet_address, agent_id }) {
  const registry = contractService.getRegistryContract();
  const agentIdHash = ethers.keccak256(ethers.toUtf8Bytes(agent_id));

  const tx = await registry.registerAgent(agentIdHash);
  const receipt = await tx.wait();

  const profile = await registry.getAgentProfile(wallet_address);

  return {
    tx_hash: receipt.hash,
    agent_profile: formatProfile(profile),
  };
}

/**
 * Get agent profile
 */
async function getAgentProfile(wallet) {
  const registry = contractService.getRegistryContract();
  const profile = await registry.getAgentProfile(wallet);

  return formatProfile(profile);
}

/**
 * Check if an agent is registered
 */
async function isRegistered(wallet) {
  const registry = contractService.getRegistryContract();
  return registry.isRegisteredAgent(wallet);
}

/**
 * Get agent's reward history (mint records + total earned)
 */
async function getAgentRewards(wallet) {
  const tokenContract = contractService.getTokenContract();

  const mintIds = await tokenContract.getMintsByAgent(wallet);
  const mintRecords = [];
  let totalEarned = 0n;

  for (const mintId of mintIds) {
    const record = await tokenContract.getMintRecord(mintId);
    mintRecords.push({
      mint_id: Number(record.mintId),
      agent: record.agent,
      amount: record.amount.toString(),
      task_hash: record.taskHash,
      call_record_hash: record.callRecordHash,
      timestamp: Number(record.timestamp),
      tier: ['FULL', 'PARTIAL', 'NONE'][Number(record.tier)],
    });
    totalEarned += record.amount;
  }

  return {
    mint_records: mintRecords,
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
