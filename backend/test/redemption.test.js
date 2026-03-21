const { ethers } = require('ethers');
const vaultService = require('../src/services/vaultService');
const contractService = require('../src/services/contractService');

const AGENT_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER_WALLET = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

function createMockCallRecordHash(id) {
  return ethers.keccak256(ethers.toUtf8Bytes(`cr_${id}`));
}

function createMockTokenContract(mintRecordsData) {
  return {
    getMintRecord: jest.fn(async (mintId) => {
      const record = mintRecordsData[mintId];
      if (!record) throw new Error('Mint record does not exist');
      return record;
    }),
  };
}

function createMockVaultContract({ redemptionEnabled = true, revertOnRequest = false } = {}) {
  const processedHashes = new Set();

  return {
    redemptionEnabled: jest.fn(async () => redemptionEnabled),
    requestRedemption: jest.fn(async (req) => {
      if (revertOnRequest) {
        throw new Error('Already processed');
      }
      const hash = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'uint256'],
          [req.agent, req.tokenAmount]
        )
      );
      if (processedHashes.has(hash)) {
        throw new Error('Already processed');
      }
      processedHashes.add(hash);
      return {
        wait: jest.fn(async () => ({
          hash: '0xmock_redeem_tx',
        })),
      };
    }),
  };
}

function createMockFetchFn(registryResponses) {
  return jest.fn(async (url) => {
    // Support both ?id=hash and /hash URL formats
    const urlObj = new URL(url, 'http://localhost');
    const hashKey = urlObj.searchParams.get('id') || url.split('/').pop();
    const data = registryResponses[hashKey];
    if (!data) {
      return { ok: false, status: 404 };
    }
    return {
      ok: true,
      json: async () => data,
    };
  });
}

describe('Redemption', () => {
  beforeEach(() => {
    jest.spyOn(contractService, 'ensureProviderConnected').mockResolvedValue();
  });

  afterEach(() => {
    contractService.resetContracts();
    vaultService.resetFetchFn();
    jest.restoreAllMocks();
  });

  test('valid redemption processes successfully', async () => {
    const callRecordHash0 = createMockCallRecordHash('0');
    const callRecordHash1 = createMockCallRecordHash('1');

    const mintRecords = {
      0: { mintId: 0, agent: AGENT_WALLET, amount: BigInt('500000000000000000'), callRecordHash: callRecordHash0 },
      1: { mintId: 1, agent: AGENT_WALLET, amount: BigInt('500000000000000000'), callRecordHash: callRecordHash1 },
    };

    const registryResponses = {
      [callRecordHash0]: { call_record_hash: callRecordHash0 },
      [callRecordHash1]: { call_record_hash: callRecordHash1 },
    };

    const mockVault = createMockVaultContract({ redemptionEnabled: true });
    const mockToken = createMockTokenContract(mintRecords);
    contractService.setContracts({ vault: mockVault, token: mockToken });
    vaultService.setFetchFn(createMockFetchFn(registryResponses));

    const result = await vaultService.redeem({
      agent_wallet: AGENT_WALLET,
      token_amount: '1000000000000000000',
      mint_ids: [0, 1],
    });

    expect(result.tx_hash).toBe('0xmock_redeem_tx');
    expect(result.token_amount).toBe('1000000000000000000');
    expect(mockVault.requestRedemption).toHaveBeenCalledTimes(1);
    expect(mockToken.getMintRecord).toHaveBeenCalledTimes(2);
  });

  test('redemption fails when disabled', async () => {
    const mockVault = createMockVaultContract({ redemptionEnabled: false });
    const mockToken = createMockTokenContract({});
    contractService.setContracts({ vault: mockVault, token: mockToken });

    await expect(
      vaultService.redeem({
        agent_wallet: AGENT_WALLET,
        token_amount: '1000000000000000000',
        mint_ids: [0],
      })
    ).rejects.toThrow('redemption_disabled');
  });

  test('redemption fails when callRecordHash does not match registry', async () => {
    const callRecordHash0 = createMockCallRecordHash('0');

    const mintRecords = {
      0: { mintId: 0, agent: AGENT_WALLET, amount: BigInt('1000000000000000000'), callRecordHash: callRecordHash0 },
    };

    // Registry returns a different hash
    const registryResponses = {
      [callRecordHash0]: { call_record_hash: '0xdeadbeef' },
    };

    const mockVault = createMockVaultContract({ redemptionEnabled: true });
    const mockToken = createMockTokenContract(mintRecords);
    contractService.setContracts({ vault: mockVault, token: mockToken });
    vaultService.setFetchFn(createMockFetchFn(registryResponses));

    await expect(
      vaultService.redeem({
        agent_wallet: AGENT_WALLET,
        token_amount: '1000000000000000000',
        mint_ids: [0],
      })
    ).rejects.toThrow('callRecordHash mismatch');
  });

  test('redemption fails for already-processed redemption (replay attack)', async () => {
    const callRecordHash0 = createMockCallRecordHash('0');

    const mintRecords = {
      0: { mintId: 0, agent: AGENT_WALLET, amount: BigInt('1000000000000000000'), callRecordHash: callRecordHash0 },
    };

    const registryResponses = {
      [callRecordHash0]: { call_record_hash: callRecordHash0 },
    };

    // Use revertOnRequest to simulate the contract rejecting a replay
    const mockVault = createMockVaultContract({ redemptionEnabled: true, revertOnRequest: true });
    const mockToken = createMockTokenContract(mintRecords);
    contractService.setContracts({ vault: mockVault, token: mockToken });
    vaultService.setFetchFn(createMockFetchFn(registryResponses));

    await expect(
      vaultService.redeem({
        agent_wallet: AGENT_WALLET,
        token_amount: '1000000000000000000',
        mint_ids: [0],
      })
    ).rejects.toThrow('Already processed');
  });

  test('redemption fails when mintId does not belong to agent', async () => {
    const callRecordHash0 = createMockCallRecordHash('0');

    const mintRecords = {
      0: { mintId: 0, agent: OTHER_WALLET, amount: BigInt('1000000000000000000'), callRecordHash: callRecordHash0 },
    };

    const mockVault = createMockVaultContract({ redemptionEnabled: true });
    const mockToken = createMockTokenContract(mintRecords);
    contractService.setContracts({ vault: mockVault, token: mockToken });

    await expect(
      vaultService.redeem({
        agent_wallet: AGENT_WALLET,
        token_amount: '1000000000000000000',
        mint_ids: [0],
      })
    ).rejects.toThrow('does not belong to agent');
  });
});
