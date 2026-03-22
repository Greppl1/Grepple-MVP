const express = require('express');
const router = express.Router();
const vaultService = require('../services/vaultService');
const agentAuth = require('../middleware/agentAuth');
const webhookAuth = require('../middleware/webhookAuth');
const createRateLimiter = require('../middleware/rateLimiter');

const depositRateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const redeemRateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const readRateLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

const MAX_MINT_IDS = 50;

/**
 * POST /api/vault/deposit
 * Body: { builder_wallet, usdc_amount }
 * Protected by webhookAuth (server-to-server pattern)
 */
router.post('/deposit', webhookAuth, depositRateLimiter, async (req, res, next) => {
  try {
    const { builder_wallet, usdc_amount } = req.body;

    if (!builder_wallet || !usdc_amount) {
      return res.status(400).json({ error: 'builder_wallet and usdc_amount are required' });
    }

    const result = await vaultService.deposit({ builder_wallet, usdc_amount });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vault/balance/:wallet
 * Rate-limited to prevent enumeration
 */
router.get('/balance/:wallet', readRateLimiter, async (req, res, next) => {
  try {
    const { wallet } = req.params;
    const result = await vaultService.getBuilderBalance(wallet);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vault/redeem
 * Body: { agent_wallet, token_amount, mint_ids }
 *
 * NOTE: Redemption is a placeholder feature — disabled by default.
 * Protected by agentAuth + rate limiter. usdc_amount now computed on-chain.
 */
router.post('/redeem', agentAuth, redeemRateLimiter, async (req, res, next) => {
  try {
    const { agent_wallet, token_amount, mint_ids } = req.body;

    if (!agent_wallet || !token_amount || !mint_ids) {
      return res.status(400).json({ error: 'agent_wallet, token_amount, and mint_ids are required' });
    }

    // Verify authenticated wallet matches requested wallet
    if (req.agentWallet && req.agentWallet.toLowerCase() !== agent_wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Authenticated wallet does not match agent_wallet' });
    }

    if (!Array.isArray(mint_ids) || mint_ids.length === 0) {
      return res.status(400).json({ error: 'mint_ids must be a non-empty array' });
    }

    if (mint_ids.length > MAX_MINT_IDS) {
      return res.status(400).json({ error: `mint_ids array exceeds maximum of ${MAX_MINT_IDS}` });
    }

    const result = await vaultService.redeem({ agent_wallet, token_amount, mint_ids });
    res.json(result);
  } catch (err) {
    if (err.code === 'REDEMPTION_DISABLED') {
      return res.status(403).json({ error: 'redemption_disabled' });
    }
    if (err.code === 'MINT_OWNER_MISMATCH' || err.code === 'HASH_MISMATCH') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
