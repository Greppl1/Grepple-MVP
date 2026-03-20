const { ethers } = require('ethers');
const mintService = require('../src/services/mintService');
const contractService = require('../src/services/contractService');

// Mock contract for AAOTestToken
function createMockTokenContract() {
  let mintIdCounter = 0;
  const records = {};

  const mockContract = {
    mint: jest.fn(async (agent, amount, taskHash, callRecordHash, tier) => {
      const mintId = mintIdCounter++;
      records[mintId] = { mintId, agent, amount, taskHash, callRecordHash, tier };
      return {
        wait: jest.fn(async () => ({
          hash: `0xmocktx_${mintId}`,
          logs: [
            {
              topics: [
                ethers.id('TokenMinted(uint256,address,uint256,bytes32,uint8)'),
                ethers.zeroPadValue(ethers.toBeHex(mintId), 32),
                ethers.zeroPadValue(agent, 32),
              ],
              data: ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'bytes32', 'uint8'],
                [amount, taskHash, tier]
              ),
            },
          ],
        })),
      };
    }),
    interface: {
      parseLog: jest.fn(({ topics, data }) => {
        // Extract mintId from indexed topic
        const mintId = parseInt(topics[1], 16);
        return {
          name: 'TokenMinted',
          args: {
            mintId: BigInt(mintId),
          },
        };
      }),
    },
  };

  return mockContract;
}

describe('Mint Service', () => {
  let mockToken;

  beforeEach(() => {
    mintService.clearMintedTasks();
    mockToken = createMockTokenContract();
    contractService.setContracts({ token: mockToken });
  });

  describe('determineRewardTier', () => {
    test('success with both scores -> FULL', () => {
      const event = {
        event: 'test_task_completed',
        data: {
          task_id: 'task_20260320_abc123',
          agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          tool_id: 'tool_swap_tokens_001',
          result: 'success',
          scores: { call_success: true, structured_report: true },
          timestamp: '2026-03-20T10:30:00Z',
        },
      };
      expect(mintService.determineRewardTier(event)).toBe(mintService.RewardTier.FULL);
    });

    test('failed_with_diagnosis -> PARTIAL', () => {
      const event = {
        event: 'test_task_completed',
        data: {
          task_id: 'task_20260320_def456',
          agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          tool_id: 'tool_swap_tokens_001',
          result: 'failed_with_diagnosis',
          scores: { call_success: false, structured_report: true },
          timestamp: '2026-03-20T10:35:00Z',
        },
      };
      expect(mintService.determineRewardTier(event)).toBe(mintService.RewardTier.PARTIAL);
    });

    test('invalid -> NONE', () => {
      const event = {
        event: 'test_task_completed',
        data: {
          task_id: 'task_20260320_ghi789',
          agent_wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          tool_id: 'tool_swap_tokens_001',
          result: 'invalid',
          scores: { call_success: false, structured_report: false },
          timestamp: '2026-03-20T10:40:00Z',
        },
      };
      expect(mintService.determineRewardTier(event)).toBe(mintService.RewardTier.NONE);
    });
  });

  describe('calculateAmount', () => {
    const baseReward = '1000000000000000000'; // 1 token

    test('FULL tier returns 100% of base reward', () => {
      const amount = mintService.calculateAmount(mintService.RewardTier.FULL, baseReward);
      expect(amount).toBe(BigInt(baseReward));
    });

    test('PARTIAL tier returns 50% of base reward', () => {
      const amount = mintService.calculateAmount(mintService.RewardTier.PARTIAL, baseReward);
      expect(amount).toBe(BigInt(baseReward) / 2n);
    });

    test('NONE tier returns 0', () => {
      const amount = mintService.calculateAmount(mintService.RewardTier.NONE, baseReward);
      expect(amount).toBe(0n);
    });
  });

  describe('mintReward', () => {
    test('FULL tier mints successfully', async () => {
      const result = await mintService.mintReward({
        agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        task_id: 'task_20260320_abc123',
        call_record_id: 'cr_20260320_xyz789',
        tier: 'FULL',
      });

      expect(result.mint_status).toBe('minted');
      expect(result.tier).toBe('FULL');
      expect(result.tx_hash).toBeTruthy();
      expect(result.mint_id).toBe(0);
      expect(BigInt(result.amount)).toBeGreaterThan(0n);
      expect(mockToken.mint).toHaveBeenCalledTimes(1);
    });

    test('PARTIAL tier mints with 50% amount', async () => {
      const result = await mintService.mintReward({
        agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        task_id: 'task_partial_001',
        call_record_id: 'cr_partial_001',
        tier: 'PARTIAL',
      });

      expect(result.mint_status).toBe('minted');
      expect(result.tier).toBe('PARTIAL');
      // PARTIAL should be half of FULL
      const fullAmount = mintService.calculateAmount(mintService.RewardTier.FULL);
      const partialAmount = mintService.calculateAmount(mintService.RewardTier.PARTIAL);
      expect(partialAmount).toBe(fullAmount / 2n);
    });

    test('NONE tier returns rejected without minting', async () => {
      const result = await mintService.mintReward({
        agent_wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        task_id: 'task_none_001',
        call_record_id: 'cr_none_001',
        tier: 'NONE',
      });

      expect(result.mint_status).toBe('rejected');
      expect(result.tier).toBe('NONE');
      expect(result.amount).toBe('0');
      expect(result.tx_hash).toBeNull();
      expect(mockToken.mint).not.toHaveBeenCalled();
    });

    test('same task_id cannot be minted twice (idempotency)', async () => {
      const task_id = 'task_idempotent_001';
      const params = {
        agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        task_id,
        call_record_id: 'cr_idem_001',
        tier: 'FULL',
      };

      const result1 = await mintService.mintReward(params);
      const result2 = await mintService.mintReward(params);

      expect(result1).toEqual(result2);
      expect(mockToken.mint).toHaveBeenCalledTimes(1); // Only called once
    });

    test('invalid tier string throws error', async () => {
      await expect(
        mintService.mintReward({
          agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          task_id: 'task_bad_tier',
          call_record_id: 'cr_bad',
          tier: 'INVALID_TIER',
        })
      ).rejects.toThrow('Invalid tier');
    });
  });

  describe('getMintStatus', () => {
    test('returns pending for unknown task', () => {
      const status = mintService.getMintStatus('task_unknown');
      expect(status.mint_status).toBe('pending');
      expect(status.task_id).toBe('task_unknown');
    });

    test('returns minted status after successful mint', async () => {
      await mintService.mintReward({
        agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        task_id: 'task_status_check',
        call_record_id: 'cr_status',
        tier: 'FULL',
      });

      const status = mintService.getMintStatus('task_status_check');
      expect(status.mint_status).toBe('minted');
      expect(status.tier).toBe('FULL');
    });
  });

  describe('processTestTaskCompleted', () => {
    test('processes Jerry success event correctly', async () => {
      const event = {
        event: 'test_task_completed',
        data: {
          task_id: 'task_20260320_abc123',
          agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          tool_id: 'tool_swap_tokens_001',
          result: 'success',
          scores: { call_success: true, structured_report: true },
          timestamp: '2026-03-20T10:30:00Z',
        },
      };

      const result = await mintService.processTestTaskCompleted(event);
      expect(result.mint_status).toBe('minted');
      expect(result.tier).toBe('FULL');
    });

    test('processes Jerry failed_with_diagnosis event correctly', async () => {
      const event = {
        event: 'test_task_completed',
        data: {
          task_id: 'task_20260320_def456',
          agent_wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          tool_id: 'tool_swap_tokens_001',
          result: 'failed_with_diagnosis',
          scores: { call_success: false, structured_report: true },
          timestamp: '2026-03-20T10:35:00Z',
        },
      };

      const result = await mintService.processTestTaskCompleted(event);
      expect(result.mint_status).toBe('minted');
      expect(result.tier).toBe('PARTIAL');
    });

    test('processes Jerry invalid event correctly', async () => {
      const event = {
        event: 'test_task_completed',
        data: {
          task_id: 'task_20260320_ghi789',
          agent_wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          tool_id: 'tool_swap_tokens_001',
          result: 'invalid',
          scores: { call_success: false, structured_report: false },
          timestamp: '2026-03-20T10:40:00Z',
        },
      };

      const result = await mintService.processTestTaskCompleted(event);
      expect(result.mint_status).toBe('rejected');
      expect(result.tier).toBe('NONE');
    });
  });
});
