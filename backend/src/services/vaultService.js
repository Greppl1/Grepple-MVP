const { ethers } = require('ethers');
const contractService = require('./contractService');
const config = require('../config');
const txQueue = require('./txQueue');
const logger = require('./logger');

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
 * Deposit USDC into the vault for a builder.
 * Uses depositFor (operator pattern) if available, falls back to deposit.
 */
async function deposit({ builder_wallet, usdc_amount }) {
  const checksummed = validateAddress(builder_wallet);
  const vault = contractService.getVaultContract();

  logger.tx('deposit_start', { builder: checksummed, amount: usdc_amount });

  let receipt;
  try {
    // Use depositFor (new contract) — records under builder's address
    receipt = await txQueue.enqueue(() =>
      vault.depositFor(checksummed, usdc_amount)
    );
  } catch (err) {
    // Fall back to deposit (old contract) — records under signer's address
    if (err.message && err.message.includes('is not a function')) {
      logger.warn('depositFor_not_available', { fallback: 'deposit' });
      receipt = await txQueue.enqueue(() =>
        vault.deposit(usdc_amount)
      );
    } else {
      throw err;
    }
  }

  const newBalance = await vault.getBuilderBalance(checksummed);

  logger.tx('deposit_complete', { builder: checksummed, tx_hash: receipt.hash, new_balance: newBalance.toString() });

  return {
    tx_hash: receipt.hash,
    new_balance: newBalance.toString(),
  };
}

/**
 * Get builder's USDC balance in the vault
 */
async function getBuilderBalance(wallet) {
  const checksummed = validateAddress(wallet);
  const vault = contractService.getVaultContract();
  const balance = await vault.getBuilderBalance(checksummed);

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Registry API returned ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Redeem test tokens for USDC via the vault.
 * NOTE: Redemption is a placeholder feature — disabled by default.
 * In production, agents would call the contract directly from their wallet.
 */
async function redeem({ agent_wallet, token_amount, mint_ids, usdc_amount }) {
  const checksummed = validateAddress(agent_wallet);
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

    // Verify the mint record belongs to this agent (case-insensitive hex comparison)
    if (record.agent.toLowerCase() !== checksummed.toLowerCase()) {
      throw Object.assign(
        new Error(`Mint ID ${mintId} does not belong to agent ${checksummed}`),
        { code: 'MINT_OWNER_MISMATCH' }
      );
    }

    // Fetch from Fiona's registry and verify callRecordHash matches
    const registryData = await fetchCallRecord(record.callRecordHash);
    const registryHash = (registryData.call_record_hash || '').toLowerCase();
    const onChainHash = (typeof record.callRecordHash === 'string' ? record.callRecordHash : '').toLowerCase();
    if (registryHash !== onChainHash) {
      throw Object.assign(
        new Error(`callRecordHash mismatch for mint ID ${mintId}`),
        { code: 'HASH_MISMATCH' }
      );
    }
  }

  // 3. Call requestRedemption on-chain
  const receipt = await txQueue.enqueue(() =>
    vault.requestRedemption({
      agent: checksummed,
      tokenAmount: token_amount,
      mintIds: mint_ids,
      usdcAmount: usdc_amount,
    })
  );

  logger.tx('redeem_complete', { agent: checksummed, tx_hash: receipt.hash, usdc: usdc_amount });

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
