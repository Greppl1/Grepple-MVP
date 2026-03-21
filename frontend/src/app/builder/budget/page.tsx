'use client';

import { useState } from 'react';
import SubNav, { BUILDER_NAV } from '@/components/SubNav';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { IconExternalLink } from '@/components/Icons';

interface Transaction {
  id: string;
  date: string;
  type: 'Deposit' | 'Consumed';
  amount: string;
  txHash: string;
  status: 'Confirmed' | 'Pending';
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', date: '2026-03-20 10:30', type: 'Deposit', amount: '+50.00 USDC', txHash: '0xabc123def456789012345678901234567890abcd', status: 'Confirmed' },
  { id: '2', date: '2026-03-20 10:45', type: 'Consumed', amount: '-0.25 USDC', txHash: '0xdef456abc789012345678901234567890abcdef1', status: 'Confirmed' },
  { id: '3', date: '2026-03-20 11:02', type: 'Consumed', amount: '-0.50 USDC', txHash: '0x789abc012def345678901234567890abcdef1234', status: 'Confirmed' },
  { id: '4', date: '2026-03-19 14:20', type: 'Deposit', amount: '+25.00 USDC', txHash: '0x012345678901234567890abcdef1234567890abc', status: 'Confirmed' },
  { id: '5', date: '2026-03-19 15:10', type: 'Consumed', amount: '-0.25 USDC', txHash: '0x345678901234567890abcdef1234567890abcde', status: 'Confirmed' },
];

export default function BudgetPage() {
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const currentBalance = 50.0;
  const totalDeposited = 75.0;
  const totalConsumed = 25.0;

  const handleDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setConfirmOpen(true);
  };

  const confirmDeposit = () => {
    setConfirmOpen(false);
    setDepositing(true);
    setTimeout(() => {
      setDepositing(false);
      toast(`Deposited ${depositAmount} USDC to Vault`, 'success');
      setDepositAmount('');
    }, 2000);
  };

  const truncateHash = (hash: string) =>
    `${hash.slice(0, 6)}...${hash.slice(-4)}`;

  return (
    <div className="p-6 lg:p-8 max-w-4xl animate-fade-in">
      <SubNav items={BUILDER_NAV} />

      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-2">Budget Management</h1>
      <p className="text-text-secondary mb-8">
        Manage your USDC balance for tool diagnosis and testing.
      </p>

      {/* Balance Card */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center sm:text-left">
            <p className="text-text-dim text-xs uppercase tracking-wider mb-2">
              Current Balance
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-mono text-white">
              {currentBalance.toFixed(2)}
            </p>
            <p className="text-text-secondary text-sm mt-1">USDC</p>
          </div>
          <div className="text-center sm:text-left sm:border-l sm:border-border sm:pl-6">
            <p className="text-text-dim text-xs uppercase tracking-wider mb-2">
              Total Deposited
            </p>
            <p className="text-2xl font-bold font-mono text-green">
              {totalDeposited.toFixed(2)}
            </p>
            <p className="text-text-secondary text-sm mt-1">USDC</p>
          </div>
          <div className="text-center sm:text-left sm:border-l sm:border-border sm:pl-6">
            <p className="text-text-dim text-xs uppercase tracking-wider mb-2">
              Total Consumed
            </p>
            <p className="text-2xl font-bold font-mono text-amber">
              {totalConsumed.toFixed(2)}
            </p>
            <p className="text-text-secondary text-sm mt-1">USDC</p>
          </div>
        </div>
      </div>

      {/* Deposit Form */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
          Deposit USDC
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
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
            className={`btn-gradient px-8 py-3 rounded-xl text-sm font-semibold transition-all min-w-[140px] ${
              !depositAmount || parseFloat(depositAmount) <= 0 || depositing
                ? 'opacity-40 cursor-not-allowed'
                : ''
            }`}
          >
            {depositing ? 'Depositing...' : 'Deposit'}
          </button>
        </div>
        <p className="text-text-dim text-xs mt-3">
          Deposits are sent to the AAO Vault contract on BSC Testnet.
        </p>
      </div>

      {/* Transaction History */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Transaction History
          </h2>
        </div>
        {MOCK_TRANSACTIONS.length > 0 ? (
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
                    Tx Hash
                  </th>
                  <th className="text-left px-6 py-3 text-text-dim font-medium text-xs uppercase tracking-wider hidden md:table-cell">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TRANSACTIONS.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-elevated/50 transition-colors">
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
                      <a
                        href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-blue-bright hover:text-white transition-colors"
                      >
                        {truncateHash(tx.txHash)}
                        <IconExternalLink size={10} />
                      </a>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
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
          <div className="py-12 text-center">
            <p className="text-text-dim text-sm">No transactions yet. Make your first deposit above.</p>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Deposit"
        description={`You are about to deposit ${depositAmount} USDC to the AAO Vault on BSC Testnet. This will require a wallet transaction.`}
        confirmLabel="Confirm Deposit"
        onConfirm={confirmDeposit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
