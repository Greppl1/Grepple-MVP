export const CHAIN_ID = 97; // BSC Testnet

export const CONTRACTS = {
  MockUSDC: '0xC4A60C64E24d3D7331Da6B48624333E9196C9188',
  AAOTestToken: '0xc2a5E61225b7623090DfB7067D76CfA987C3AbF3',
  AgentRegistry: '0xB31733fE1676539fD0b478aF3C366FBC9711927e',
  AAOVault: '0x01230E4030981864B8d93ea9a15E7AAC207A6952',
} as const;

export const BSC_TESTNET = {
  id: 97,
  name: 'BSC Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://data-seed-prebsc-1-s1.binance.org:8545'] },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
  },
  testnet: true,
} as const;

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://zian-backend-production.up.railway.app';
export const SCORING_ENGINE_URL = process.env.NEXT_PUBLIC_SCORING_ENGINE_URL || 'https://spirited-success-production-2b55.up.railway.app';
export const REWARD_SYSTEM_URL = process.env.NEXT_PUBLIC_REWARD_SYSTEM_URL || 'https://zian-backend-production.up.railway.app';
