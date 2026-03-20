const express = require('express');
const router = express.Router();
const mintService = require('../services/mintService');
const agentAuth = require('../middleware/agentAuth');
const createRateLimiter = require('../middleware/rateLimiter');

const mintRateLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

/**
 * POST /api/rewards/mint
 * Body: { agent_wallet, task_id, call_record_id, tier: "FULL"|"PARTIAL"|"NONE" }
 */
router.post('/mint', agentAuth, mintRateLimiter, async (req, res, next) => {
  try {
    const { agent_wallet, task_id, call_record_id, tier } = req.body;

    if (!agent_wallet || !task_id) {
      return res.status(400).json({ error: 'agent_wallet and task_id are required' });
    }
    if (!tier) {
      return res.status(400).json({ error: 'tier is required' });
    }

    const result = await mintService.mintReward({
      agent_wallet,
      task_id,
      call_record_id,
      tier,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rewards/status/:task_id
 */
router.get('/status/:task_id', (req, res) => {
  const { task_id } = req.params;
  const status = mintService.getMintStatus(task_id);
  res.json(status);
});

module.exports = router;
