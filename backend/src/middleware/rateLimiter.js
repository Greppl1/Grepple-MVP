/**
 * Per-wallet rate limiter using an in-memory Map.
 *
 * Options:
 *   maxRequests  - max requests per window (default 10)
 *   windowMs     - window duration in milliseconds (default 60_000 = 1 minute)
 *
 * Identifies the wallet from:
 *   1. req.agentWallet (set by agentAuth middleware)
 *   2. x-agent-wallet header
 *   3. req.body.wallet_address or req.body.agent_wallet
 *   4. Falls back to req.ip
 */
function createRateLimiter({ maxRequests = 10, windowMs = 60_000 } = {}) {
  // wallet -> { count, windowStart }
  const store = new Map();

  // Periodic cleanup of expired entries (every 2x window)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > windowMs) {
        store.delete(key);
      }
    }
  }, windowMs * 2);

  // Allow the timer to not block process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function rateLimiter(req, res, next) {
    const key =
      req.agentWallet ||
      req.headers['x-agent-wallet'] ||
      (req.body && (req.body.wallet_address || req.body.agent_wallet)) ||
      req.ip;

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 1, windowStart: now };
      store.set(key, entry);
      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    next();
  }

  // Expose internals for testing
  rateLimiter._store = store;
  rateLimiter._cleanup = cleanupInterval;

  return rateLimiter;
}

module.exports = createRateLimiter;
