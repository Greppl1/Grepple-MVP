const { ethers } = require('ethers');
const contractService = require('./contractService');
const config = require('../config');

// Allow injecting a custom fetch function for testing
let _fetchFn = null;

function setFetchFn(fn) {
  _fetchFn = fn;
}

function resetFetchFn() {
  _fetchFn = null;
}

function getFetchFn() {
  return _fetchFn || globalThis.fetch;
}

/**
 * Deposit USDC into the vault for a builder
 */
async function deposit({ builder_wallet, usdc_amount }) {
  const vault = contractService.getVaultContract();

  const tx = await vault.deposit(usdc_amount);
  const receipt = await tx.wait();

  const newBalance = await vault.getBuilderBalance(builder_wallet);

  return {
    tx_hash: receipt.hash,
    new_balance: newBalance.toString(),
  };
}

/**
 * Get builder's USDC balance in the vault
 */
async function getBuilderBalance(wallet) {
  const vault = contractService.getVaultContract();
  const balance = await vault.getBuilderBalance(wallet);

  return {
    balance: balance.toString(),
  };
}

/**
 * Fetch call record from Fiona's Registry API
 */
async function fetchCallRecord(callRecordHash) {
  const fetchFn = getFetchFn();
  const url = `${config.registryApiUrl}/api/registry/call-record/${callRecordHash}`;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Registry API returned ${response.status}`);
  }
  return response.json();
}

/**
 * Redeem test tokens for USDC via the vault
 */
async function redeem({ agent_wallet, token_amount, mint_ids, usdc_amount }) {
  const vault = contractService.getVaultContract();
  const token = contractService.getTokenContract();

  // 1. Check if redemption is enabled
  const enabled = await vault.redemptionEnabled();
  if (!enabled) {
    throw Object.assign(new Error('redemption_disabled'), { code: 'REDEMPTION_DISABLED' });
  }

  // 2. Cross-validate each mint_id with Fiona's Registry
  for (const mintId of mint_ids) {
    const record = await token.getMintRecord(mintId);

    // Verify the mint record belongs to this agent
    if (record.agent.toLowerCase() !== agent_wallet.toLowerCase()) {
      throw Object.assign(
        new Error(`Mint ID ${mintId} does not belong to agent ${agent_wallet}`),
        { code: 'MINT_OWNER_MISMATCH' }
      );
    }

    // Fetch from Fiona's registry and verify callRecordHash matches
    const registryData = await fetchCallRecord(record.callRecordHash);
    if (registryData.call_record_hash !== record.callRecordHash) {
      throw Object.assign(
        new Error(`callRecordHash mismatch for mint ID ${mintId}`),
        { code: 'HASH_MISMATCH' }
      );
    }
  }

  // 3. Call requestRedemption on-chain
  const tx = await vault.requestRedemption({
    agent: agent_wallet,
    tokenAmount: token_amount,
    mintIds: mint_ids,
    usdcAmount: usdc_amount,
  });
  const receipt = await tx.wait();

  return {
    tx_hash: receipt.hash,
    usdc_received: usdc_amount,
  };
}

module.exports = {
  deposit,
  getBuilderBalance,
  redeem,
  setFetchFn,
  resetFetchFn,
};
