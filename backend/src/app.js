const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./services/logger');

const rewardsRouter = require('./routes/rewards');
const vaultRouter = require('./routes/vault');
const agentsRouter = require('./routes/agents');

const app = express();

// CORS — restrict to configured origins
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-wallet', 'x-agent-signature', 'x-agent-timestamp'],
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler — sanitize errors before sending to client
app.use((err, req, res, _next) => {
  logger.error('unhandled_error', {
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
  const safePatterns = [
    'Agent not registered',
    'Invalid tier',
    'Tier is required',
    'Task already minted',
    'builder_wallet',
    'agent_wallet',
    'required',
  ];
  return safePatterns.some((p) => err.message && err.message.includes(p));
}

module.exports = app;
