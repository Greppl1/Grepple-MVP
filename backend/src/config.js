require('dotenv').config();

// Hard-fail in production if critical secrets are missing
if (process.env.NODE_ENV === 'production') {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('[config] FATAL: PRIVATE_KEY must be set in production');
  }
  if (!process.env.WEBHOOK_API_KEY) {
    throw new Error('[config] FATAL: WEBHOOK_API_KEY must be set in production');
  }
} else if (!process.env.PRIVATE_KEY && process.env.NODE_ENV !== 'test') {
  console.warn('[config] WARNING: PRIVATE_KEY not set — using hardhat default. Do NOT use in production.');
}

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  privateKey: process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  contracts: {
    tokenAddress: process.env.TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
    vaultAddress: process.env.VAULT_ADDRESS || '0x0000000000000000000000000000000000000000',
    registryAddress: process.env.REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000',
  },
  rewardAmount: process.env.REWARD_AMOUNT || '1000000000000000000', // 1 token (18 decimals)
  registryApiUrl: process.env.REGISTRY_API_URL || 'http://localhost:3001',
  scoringEngineUrl: process.env.SCORING_ENGINE_URL || 'http://localhost:8001',
  rewardSystemUrl: process.env.REWARD_SYSTEM_URL || 'http://localhost:8002',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],

  // Idempotency persistence
  idempotencyFile: process.env.IDEMPOTENCY_FILE || './data/minted_tasks.json',
};

module.exports = config;
