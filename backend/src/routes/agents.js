const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');
const createRateLimiter = require('../middleware/rateLimiter');

const registerRateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const readRateLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

/**
 * POST /api/agents/register
 * Body: { wallet_address, agent_id }
 * Rate-limited to prevent spam registration
 */
router.post('/register', registerRateLimiter, async (req, res, next) => {
  try {
    const { wallet_address, agent_id } = req.body;

    if (!wallet_address || !agent_id) {
      return res.status(400).json({ error: 'wallet_address and agent_id are required' });
    }

    const result = await agentService.registerAgent({ wallet_address, agent_id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agents/:wallet/profile
 * Rate-limited to prevent enumeration
 */
router.get('/:wallet/profile', readRateLimiter, async (req, res, next) => {
  try {
    const { wallet } = req.params;
    const profile = await agentService.getAgentProfile(wallet);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agents/:wallet/rewards
 * Rate-limited to prevent enumeration
 */
router.get('/:wallet/rewards', readRateLimiter, async (req, res, next) => {
  try {
    const { wallet } = req.params;
    const rewards = await agentService.getAgentRewards(wallet);
    res.json(rewards);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
