const { ethers } = require('ethers');

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Agent signature verification middleware.
 *
 * Requires headers:
 *   x-agent-wallet    - the claimed wallet address
 *   x-agent-signature - signature over `${method}:${path}:${timestamp}`
 *   x-agent-timestamp - unix-ms timestamp (must be within 5 minutes of server time)
 *
 * Recovers the signer via ethers.verifyMessage and compares to the claimed wallet.
 */
function agentAuth(req, res, next) {
  const wallet = req.headers['x-agent-wallet'];
  const signature = req.headers['x-agent-signature'];
  const timestamp = req.headers['x-agent-timestamp'];

  if (!wallet || !signature || !timestamp) {
    return res.status(401).json({ error: 'Missing authentication headers' });
  }

  // Validate timestamp freshness
  const ts = Number(timestamp);
  if (isNaN(ts)) {
    return res.status(401).json({ error: 'Invalid timestamp' });
  }

  const now = Date.now();
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_MS) {
    return res.status(401).json({ error: 'Timestamp expired' });
  }

  // Reconstruct signed message and verify
  const message = `${req.method}:${req.originalUrl || req.path}:${timestamp}`;

  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(401).json({ error: 'Signature mismatch' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Attach verified wallet to request for downstream use
  req.agentWallet = wallet;
  next();
}

module.exports = agentAuth;
