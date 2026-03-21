const { ethers } = require('ethers');
const agentService = require('../src/services/agentService');
const contractService = require('../src/services/contractService');

function createMockRegistryContract() {
  const agents = {};
  const idToWallet = {};

  return {
    registerAgent: jest.fn(async (agentIdHash) => {
      return {
        wait: jest.fn(async () => ({
          hash: '0xmock_register_tx',
        })),
      };
    }),
    getAgentProfile: jest.fn(async (wallet) => {
      if (agents[wallet]) return agents[wallet];
      return {
        wallet: '0x0000000000000000000000000000000000000000',
        operator: '0x0000000000000000000000000000000000000000',
        agentIdHash: ethers.ZeroHash,
        registeredAt: 0n,
        isActive: false,
        totalEarned: 0n,
        taskCount: 0n,
      };
    }),
    isRegisteredAgent: jest.fn(async (wallet) => {
      return !!agents[wallet] && agents[wallet].isActive;
    }),
    _addAgent: (wallet, agentId) => {
      const agentIdHash = ethers.keccak256(ethers.toUtf8Bytes(agentId));
      agents[wallet] = {
        wallet,
        operator: wallet,
        agentIdHash,
        registeredAt: BigInt(Math.floor(Date.now() / 1000)),
        isActive: true,
        totalEarned: 0n,
        taskCount: 0n,
      };
      idToWallet[agentIdHash] = wallet;
    },
  };
}

function createMockTokenContract() {
  const agentMints = {};
  const records = {};

  return {
    getMintsByAgent: jest.fn(async (wallet) => {
      return agentMints[wallet] || [];
    }),
    getMintRecord: jest.fn(async (mintId) => {
      return records[mintId];
    }),
    _addMintRecord: (mintId, agent, amount, tier) => {
      records[mintId] = {
        mintId: BigInt(mintId),
        agent,
        amount: BigInt(amount),
        taskHash: ethers.keccak256(ethers.toUtf8Bytes(`task_${mintId}`)),
        callRecordHash: ethers.keccak256(ethers.toUtf8Bytes(`cr_${mintId}`)),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        tier: BigInt(tier),
      };
      if (!agentMints[agent]) agentMints[agent] = [];
      agentMints[agent].push(BigInt(mintId));
    },
  };
}

describe('Agent Service', () => {
  let mockRegistry;
  let mockToken;

  beforeEach(() => {
    mockRegistry = createMockRegistryContract();
    mockToken = createMockTokenContract();
    contractService.setContracts({ registry: mockRegistry, token: mockToken });
  });

  describe('registerAgent', () => {
    test('registers agent and returns profile', async () => {
      const wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const agentId = 'agent_001';

      mockRegistry._addAgent(wallet, agentId);

      const result = await agentService.registerAgent({
        wallet_address: wallet,
        agent_id: agentId,
      });

      expect(result.tx_hash).toBe('0xmock_register_tx');
      expect(result.agent_profile.wallet).toBe(wallet);
      expect(result.agent_profile.is_active).toBe(true);
      expect(mockRegistry.registerAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAgentProfile', () => {
    test('returns profile for registered agent', async () => {
      const wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      mockRegistry._addAgent(wallet, 'agent_001');

      const profile = await agentService.getAgentProfile(wallet);
      expect(profile.wallet).toBe(wallet);
      expect(profile.is_active).toBe(true);
    });

    test('returns empty profile for unregistered agent', async () => {
      const profile = await agentService.getAgentProfile('0x1234567890123456789012345678901234567890');
      expect(profile.wallet).toBe('0x0000000000000000000000000000000000000000');
      expect(profile.is_active).toBe(false);
    });
  });

  describe('getAgentRewards', () => {
    test('returns mint records and total earned', async () => {
      const wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const amount = '1000000000000000000'; // 1 token

      mockToken._addMintRecord(0, wallet, amount, 0); // FULL
      mockToken._addMintRecord(1, wallet, '500000000000000000', 1); // PARTIAL

      const rewards = await agentService.getAgentRewards(wallet);

      expect(rewards.mint_records).toHaveLength(2);
      expect(rewards.mint_records[0].tier).toBe('FULL');
      expect(rewards.mint_records[1].tier).toBe('PARTIAL');
      expect(rewards.total_earned).toBe('1500000000000000000');
    });

    test('returns empty for agent with no rewards', async () => {
      const rewards = await agentService.getAgentRewards('0x1234567890123456789012345678901234567890');
      expect(rewards.mint_records).toHaveLength(0);
      expect(rewards.total_earned).toBe('0');
    });
  });
});
