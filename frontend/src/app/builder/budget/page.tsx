'use client';

import { useState } from 'react';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/providers/AuthProvider';
import { IconExternalLink } from '@/components/Icons';
import { API_BASE } from '@/lib/contracts';

interface Transaction {
  id: string;
  date: string;
  type: 'Deposit' | 'Consumed';
  amount: string;
  txHash: string;
  status: 'Confirmed' | 'Pending';
}

export default function BudgetPage() {
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transactions] = useState<Transaction[]>([]);
  const { toast } = useToast();
  const { wallet, isAuthenticated } = useAuth();

  const currentBalance = 0;
  const totalDeposited = 0;
  const totalUsed = 0;

  const handleDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setConfirmOpen(true);
  };

  const confirmDeposit = async () => {
    setConfirmOpen(false);
    setDepositing(true);

    try {
      const res = await fetch(`${API_BASE}/api/vault/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          builder_wallet: wallet?.address,
          usdc_amount: parseFloat(depositAmount),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Deposit failed');
      }

      toast(`Deposited ${depositAmount} USDC to Grepple Vault`, 'success');
      setDepositAmount('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Deposit failed';
      toast(message, 'error');
    } finally {
      setDepositing(false);
    }
  };

  const truncateHash = (hash: string) =>
    `${hash.slice(0, 6)}...${hash.slice(-4)}`;

  if (!isAuthenticated) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto page-enter text-center py-20">
        <h1 className="text-2xl font-bold text-text mb-3">Budget & Billing</h1>
        <p className="text-text-dim mb-6">Sign in to manage your testing budget.</p>
        <Link href="/agent/register" className="btn-gradient px-6 py-3 rounded-lg text-sm font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto page-enter">
      {/* Demo banner */}
      <div className="demo-banner mb-6">
        Testnet mode &mdash; deposits use mock USDC. No real funds are involved. Balances will update once the backend is connected.
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-text mb-1">Budget & Billing</h1>
        <p className="text-text-secondary text-sm">
          Manage your testing budget on BSC Testnet.
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface rounded-xl p-5 border border-border">
          <p className="text-sm text-text-secondary mb-1">Current Balance</p>
          <p className="text-2xl font-bold text-white font-mono">
            {currentBalance.toFixed(2)} <span className="text-sm font-normal text-text-dim">USDC</span>
          </p>
        </div>
        <div className="bg-surface rounded-xl p-5 border border-border">
          <p className="text-sm text-text-secondary mb-1">Total Deposited</p>
          <p className="text-2xl font-bold text-green font-mono">
            {totalDeposited.toFixed(2)} <span className="text-sm font-normal text-text-dim">USDC</span>
          </p>
        </div>
        <div className="bg-surface rounded-xl p-5 border border-border">
          <p className="text-sm text-text-secondary mb-1">Total Used</p>
          <p className="text-2xl font-bold text-amber font-mono">
            {totalUsed.toFixed(2)} <span className="text-sm font-normal text-text-dim">USDC</span>
          </p>
        </div>
      </div>

      {/* Deposit Section */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <h2 className="text-base font-semibold text-text mb-1">Add Funds</h2>
        <p className="text-text-dim text-sm mb-4">
          On testnet, deposits use mock USDC. No real funds required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-white placeholder-text-dim font-mono text-sm focus:outline-none focus:border-blue transition-colors pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim text-sm font-mono">
              USDC
            </span>
          </div>
          <button
            onClick={handleDeposit}
            disabled={!depositAmount || parseFloat(depositAmount) <= 0 || depositing}
            className={`btn-gradient px-6 py-3 rounded-xl text-sm font-semibold transition-all min-w-[120px] ${
              !depositAmount || parseFloat(depositAmount) <= 0 || depositing
                ? 'bg-elevated text-dim cursor-not-allowed'
                : ''
            }`}
          >
            {depositing ? 'Depositing...' : 'Deposit'}
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">Transaction History</h2>
        </div>
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-text-dim font-medium text-xs uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-6 py-3 text-text-dim font-medium text-xs uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-right px-6 py-3 text-text-dim font-medium text-xs uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-text-dim font-medium text-xs uppercase tracking-wider hidden sm:table-cell">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 row-hover transition-colors">
                    <td className="px-6 py-4 font-mono text-text-secondary text-xs whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          tx.type === 'Deposit'
                            ? 'bg-green-dim text-green'
                            : 'bg-amber-dim text-amber'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-mono text-sm ${
                        tx.type === 'Deposit' ? 'text-green' : 'text-amber'
                      }`}
                    >
                      {tx.amount}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span
                        className={`text-xs font-medium ${
                          tx.status === 'Confirmed' ? 'text-green' : 'text-amber'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-text-dim text-sm">No transactions yet.</p>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Deposit"
        description={`You are about to deposit ${depositAmount} USDC to the Grepple Vault on BSC Testnet. This will require a wallet transaction.`}
        confirmLabel="Confirm Deposit"
        onConfirm={confirmDeposit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
