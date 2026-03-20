const express = require('express');
const cors = require('cors');

const rewardsRouter = require('./routes/rewards');
const vaultRouter = require('./routes/vault');
const agentsRouter = require('./routes/agents');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/rewards', rewardsRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/agents', agentsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
