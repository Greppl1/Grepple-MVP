import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const WALLET_KEY_PREFIX = 'grepple_wallet_';

export interface AutoWallet {
  address: string;
  privateKey: `0x${string}`;
}

/**
 * Generate a new random wallet using viem.
 */
export function createWallet(): AutoWallet {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { address: account.address, privateKey: pk };
}

/**
 * Save wallet to localStorage keyed by user ID.
 */
export function saveWallet(userId: string, wallet: AutoWallet): void {
  try {
    localStorage.setItem(
      `${WALLET_KEY_PREFIX}${userId}`,
      JSON.stringify(wallet)
    );
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Load wallet from localStorage for a given user ID.
 */
export function loadWallet(userId: string): AutoWallet | null {
  try {
    const raw = localStorage.getItem(`${WALLET_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.address && parsed.privateKey) return parsed as AutoWallet;
    return null;
  } catch {
    return null;
  }
}

/**
 * Remove wallet from localStorage.
 */
export function removeWallet(userId: string): void {
  try {
    localStorage.removeItem(`${WALLET_KEY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

/**
 * Truncate address for display: 0x1234...abcd
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
