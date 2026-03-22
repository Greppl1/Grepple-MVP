const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const config = require('./config');
const logger = require('./services/logger');
const contractService = require('./services/contractService');

const rewardsRouter = require('./routes/rewards');
const vaultRouter = require('./routes/vault');
const agentsRouter = require('./routes/agents');

const app = express();

// Security headers (inline, no helmet dependency needed)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
});

// CORS — restrict to configured origins
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-wallet', 'x-agent-signature', 'x-agent-timestamp', 'x-request-id'],
}));

// Body parser with size limit
app.use(express.json({ limit: '100kb' }));

// Request correlation ID (server-generated if client provides invalid/long value)
app.use((req, res, next) => {
  const clientId = req.headers['x-request-id'];
  req.id = (clientId && /^[\w-]{1,64}$/.test(clientId)) ? clientId : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      request_id: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
});

app.use('/api/rewards', rewardsRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/agents', agentsRouter);

// Enhanced health check — verifies RPC connectivity
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  try {
    const provider = contractService.getProvider();
    const blockNumber = await provider.getBlockNumber();
    health.rpc = 'connected';
    health.block = blockNumber;
  } catch {
    health.rpc = 'disconnected';
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// Error handler — sanitize errors before sending to client
app.use((err, req, res, _next) => {
  logger.error('unhandled_error', {
    request_id: req.id,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  });

  // Don't leak internal details to client
  const safeMessage = isSafeError(err)
    ? err.message
    : 'Internal server error';

  res.status(500).json({ error: safeMessage });
});

/** Only expose known operational errors, not ethers/RPC internals */
function isSafeError(err) {
  const safeMessages = [
    'Agent not registered',
    'Invalid tier',
    'Tier is required',
    'Task already minted',
    'Wallet address is required',
    'task_id is required',
    'agent_wallet is required',
    'Rate limit exceeded',
  ];
  return safeMessages.some((m) => err.message === m) ||
    err.message?.startsWith('Invalid wallet address:');
}

module.exports = app;
