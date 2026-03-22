/**
 * API key authentication for server-to-server webhook endpoints.
 *
 * Checks the Authorization header for a Bearer token matching WEBHOOK_API_KEY env var.
 * In production: WEBHOOK_API_KEY must be set (enforced by config.js).
 * In dev mode: allows all requests but logs a warning.
 */

const crypto = require('crypto');

const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || '';

let warnedOnce = false;

function webhookAuth(req, res, next) {
  // Dev mode: no key configured — allow but warn
  if (!WEBHOOK_API_KEY) {
    if (!warnedOnce) {
      console.warn('[webhookAuth] WEBHOOK_API_KEY not set — webhook endpoint is unauthenticated (dev mode only)');
      warnedOnce = true;
    }
    // In production this is unreachable (config.js throws). Double-check anyway.
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Server misconfiguration: webhook auth not set' });
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  // Timing-safe comparison to prevent brute-force character-by-character attacks
  const expected = Buffer.from(WEBHOOK_API_KEY, 'utf-8');
  const received = Buffer.from(token, 'utf-8');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = webhookAuth;
