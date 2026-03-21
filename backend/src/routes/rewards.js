const express = require('express');
const router = express.Router();
const mintService = require('../services/mintService');
const agentAuth = require('../middleware/agentAuth');
const createRateLimiter = require('../middleware/rateLimiter');

const mintRateLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

/**
 * POST /api/rewards/mint
 * Accepts both snake_case and camelCase fields:
 *   { agent_wallet|agentWallet, task_id|taskId, call_record_id|callRecordId, tier }
 */
router.post('/mint', agentAuth, mintRateLimiter, async (req, res, next) => {
  try {
    const agent_wallet = req.body.agent_wallet || req.body.agentWallet;
    const task_id = req.body.task_id || req.body.taskId;
    const call_record_id = req.body.call_record_id || req.body.callRecordId;
    const tier = req.body.tier;

    if (!agent_wallet || !task_id) {
      return res.status(400).json({ error: 'agent_wallet/agentWallet and task_id/taskId are required' });
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
 * POST /api/rewards/webhook
 * Receives Jerry's test_task_completed event or RewardResult directly.
 * No auth required (server-to-server, will add API key later).
 */
router.post('/webhook', mintRateLimiter, async (req, res, next) => {
  try {
    const body = req.body;

    // Jerry's test_task_completed event
    if (body.event === 'test_task_completed' && body.data) {
      const result = await mintService.processTestTaskCompleted(body);
      return res.json(result);
    }

    // Jerry's RewardResult format (has rewardTier field)
    if (body.rewardTier || body.reward_tier) {
      const result = await mintService.processRewardResult(body);
      return res.json(result);
    }

    return res.status(400).json({ error: 'Unrecognized event format' });
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
