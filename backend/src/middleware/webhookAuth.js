/**
 * API key authentication for server-to-server webhook endpoints.
 *
 * Checks the Authorization header for a Bearer token matching WEBHOOK_API_KEY env var.
 * If WEBHOOK_API_KEY is not set, allows all requests (dev mode) but logs a warning.
 */

const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || '';

let warnedOnce = false;

function webhookAuth(req, res, next) {
  // Dev mode: no key configured
  if (!WEBHOOK_API_KEY) {
    if (!warnedOnce) {
      console.warn('[webhookAuth] WEBHOOK_API_KEY not set — webhook endpoint is unauthenticated (dev mode)');
      warnedOnce = true;
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  if (token !== WEBHOOK_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = webhookAuth;
