require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  privateKey: process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  contracts: {
    tokenAddress: process.env.TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
    vaultAddress: process.env.VAULT_ADDRESS || '0x0000000000000000000000000000000000000000',
    registryAddress: process.env.REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000',
  },
  rewardAmount: process.env.REWARD_AMOUNT || '1000000000000000000', // 1 token (18 decimals)
  registryApiUrl: process.env.REGISTRY_API_URL || 'http://localhost:3001',
};

module.exports = config;
