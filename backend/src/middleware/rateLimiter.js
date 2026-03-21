/**
 * Dual-layer rate limiter: IP-based (primary) + wallet-based (secondary).
 *
 * IP-based keying prevents bypass via rotating wallet keypairs.
 * Wallet-based keying provides per-agent limits when available.
 *
 * Options:
 *   maxRequests  - max requests per window (default 10)
 *   windowMs     - window duration in milliseconds (default 60_000 = 1 minute)
 *   maxStoreSize - max entries before forced cleanup (default 10_000, prevents OOM)
 */
function createRateLimiter({ maxRequests = 10, windowMs = 60_000, maxStoreSize = 10_000 } = {}) {
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

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function checkLimit(key) {
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 1, windowStart: now };
      store.set(key, entry);
      return true; // within limit
    }

    entry.count += 1;
    return entry.count <= maxRequests;
  }

  function rateLimiter(req, res, next) {
    // Emergency cleanup if store grows too large (distributed attack)
    if (store.size > maxStoreSize) {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now - entry.windowStart > windowMs) store.delete(key);
      }
    }

    // Primary: IP-based (cannot be easily rotated)
    const ipKey = `ip:${req.ip}`;
    if (!checkLimit(ipKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // Secondary: wallet-based (if available, for per-wallet limits)
    const wallet =
      req.agentWallet ||
      req.headers['x-agent-wallet'] ||
      (req.body && (req.body.wallet_address || req.body.agent_wallet));

    if (wallet) {
      const walletKey = `wallet:${wallet.toLowerCase()}`;
      if (!checkLimit(walletKey)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
    }

    next();
  }

  // Expose internals for testing
  rateLimiter._store = store;
  rateLimiter._cleanup = cleanupInterval;

  return rateLimiter;
}

module.exports = createRateLimiter;
