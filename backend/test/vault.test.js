const vaultService = require('../src/services/vaultService');
const contractService = require('../src/services/contractService');

function createMockVaultContract() {
  const balances = {};

  return {
    deposit: jest.fn(async (amount) => {
      return {
        wait: jest.fn(async () => ({
          hash: '0xmock_vault_deposit_tx',
        })),
      };
    }),
    getBuilderBalance: jest.fn(async (wallet) => {
      return BigInt(balances[wallet] || 0);
    }),
    _setBalance: (wallet, balance) => {
      balances[wallet] = balance;
    },
  };
}

describe('Vault Service', () => {
  let mockVault;

  beforeEach(() => {
    mockVault = createMockVaultContract();
    contractService.setContracts({ vault: mockVault });
  });

  describe('deposit', () => {
    test('deposits USDC and returns tx hash + balance', async () => {
      const builderWallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      const usdcAmount = '100000000'; // 100 USDC (6 decimals)

      mockVault._setBalance(builderWallet, usdcAmount);

      const result = await vaultService.deposit({
        builder_wallet: builderWallet,
        usdc_amount: usdcAmount,
      });

      expect(result.tx_hash).toBe('0xmock_vault_deposit_tx');
      expect(result.new_balance).toBe(usdcAmount);
      expect(mockVault.deposit).toHaveBeenCalledWith(usdcAmount);
    });
  });

  describe('getBuilderBalance', () => {
    test('returns builder balance', async () => {
      const wallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      mockVault._setBalance(wallet, '50000000');

      const result = await vaultService.getBuilderBalance(wallet);
      expect(result.balance).toBe('50000000');
    });

    test('returns 0 for unknown builder', async () => {
      const result = await vaultService.getBuilderBalance('0x1234567890123456789012345678901234567890');
      expect(result.balance).toBe('0');
    });
  });
});
