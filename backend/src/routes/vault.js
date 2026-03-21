const express = require('express');
const router = express.Router();
const vaultService = require('../services/vaultService');
const agentAuth = require('../middleware/agentAuth');
const createRateLimiter = require('../middleware/rateLimiter');

const depositRateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const redeemRateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

/**
 * POST /api/vault/deposit
 * Body: { builder_wallet, usdc_amount }
 */
router.post('/deposit', depositRateLimiter, async (req, res, next) => {
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
 */
router.get('/balance/:wallet', async (req, res, next) => {
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
 * Body: { agent_wallet, token_amount, mint_ids, usdc_amount }
 *
 * NOTE: Redemption is a placeholder feature — disabled by default.
 * Protected by agentAuth + rate limiter.
 */
router.post('/redeem', agentAuth, redeemRateLimiter, async (req, res, next) => {
  try {
    const { agent_wallet, token_amount, mint_ids, usdc_amount } = req.body;

    if (!agent_wallet || !token_amount || !mint_ids || !usdc_amount) {
      return res.status(400).json({ error: 'agent_wallet, token_amount, mint_ids, and usdc_amount are required' });
    }

    if (!Array.isArray(mint_ids) || mint_ids.length === 0) {
      return res.status(400).json({ error: 'mint_ids must be a non-empty array' });
    }

    const result = await vaultService.redeem({ agent_wallet, token_amount, mint_ids, usdc_amount });
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
