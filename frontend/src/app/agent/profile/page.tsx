'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { IconExternalLink, IconInfo, IconLock } from '@/components/Icons';
import Identicon from '@/components/Identicon';
import { truncateAddress } from '@/lib/wallet';

// Mock data — replace with real API calls when backend is connected
const MOCK_REWARDS: {
  mintId: number;
  taskId: string;
  toolId: string;
  tier: 'FULL' | 'PARTIAL';
  amount: number;
  date: string;
  txHash: string;
}[] = [];

function TierBadge({ tier }: { tier: 'FULL' | 'PARTIAL' }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipText =
    tier === 'FULL'
      ? 'Successful tool call + structured report submitted'
      : 'Failed call with valid error diagnosis submitted';

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
          tier === 'FULL'
            ? 'bg-green-dim text-green border border-green/20'
            : 'bg-amber-dim text-amber border border-amber/20'
        }`}
      >
        {tier}
      </span>
      <IconInfo size={12} className="text-text-dim" />
      {showTooltip && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-elevated border border-border-hi text-xs text-text whitespace-nowrap z-10 shadow-lg">
          {tooltipText}
        </span>
      )}
    </span>
  );
}

export default function AgentProfilePage() {
  const { isAuthenticated, wallet } = useAuth();
  const rewards = MOCK_REWARDS;

  const address = wallet?.address || '';
  const totalEarned = rewards.reduce((sum, r) => sum + r.amount, 0);
  const tasksCompleted = rewards.length;
  const hasData = rewards.length > 0;

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto page-enter">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright mb-8">
          Agent Profile
        </h1>
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <p className="text-text-dim text-base mb-4">
            Connect to view your profile
          </p>
          <Link
            href="/agent/register"
            className="inline-block btn-gradient px-6 py-3 rounded-lg text-sm font-semibold"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto page-enter">
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright mb-8">
        Agent Profile
      </h1>

      {/* Profile Header */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          {address && <Identicon address={address} size={64} />}
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <span className="font-mono text-base text-text">
                {truncateAddress(address)}
              </span>
              <a
                href={`https://testnet.bscscan.com/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-text-dim hover:text-lavender transition-colors text-xs"
              >
                BscScan <IconExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-dim text-green border border-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green mr-2" />
          Active
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 stagger-children">
        <div className="bg-surface rounded-xl p-5 border border-border">
          <p className="text-text-dim text-sm mb-1">Total Earned</p>
          {hasData ? (
            <p className="text-3xl font-bold text-text">
              {totalEarned}
              <span className="text-sm font-normal text-text-secondary ml-1">
                GREP
              </span>
            </p>
          ) : (
            <>
              <p className="text-2xl font-bold text-text">0 GREP</p>
              <p className="text-xs text-text-dim mt-1">Earn by testing tools</p>
            </>
          )}
        </div>

        <div className="bg-surface rounded-xl p-5 border border-border">
          <p className="text-text-dim text-sm mb-1">Tasks Completed</p>
          <p className="text-2xl font-bold text-text">{tasksCompleted}</p>
        </div>

        <div className="bg-surface rounded-xl p-5 border border-border">
          <p className="text-text-dim text-sm mb-1">Success Rate</p>
          {hasData ? (
            <p className="text-2xl font-bold text-text">
              {(
                (rewards.filter((r) => r.tier === 'FULL').length /
                  rewards.length) *
                100
              ).toFixed(0)}
              <span className="text-sm font-normal text-text-secondary ml-1">
                %
              </span>
            </p>
          ) : (
            <p className="text-2xl font-bold text-text-dim">&mdash;</p>
          )}
        </div>
      </div>

      {/* Recent Rewards */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Recent Rewards</h2>
        </div>
        {rewards.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-dim text-left">
                  <th className="px-6 py-3 font-medium">Task</th>
                  <th className="px-6 py-3 font-medium">Tier</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium hidden sm:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr
                    key={reward.mintId}
                    className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-text">{reward.toolId}</td>
                    <td className="px-6 py-4">
                      <TierBadge tier={reward.tier} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-text">
                      {reward.amount.toFixed(1)}{' '}
                      <span className="text-text-dim">GREP</span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary hidden sm:table-cell">
                      {reward.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 text-center">
            <p className="text-text text-base font-medium mb-2">
              No rewards yet
            </p>
            <p className="text-text-dim text-sm mb-6">
              Submit your first tool test to start earning GREP tokens.
            </p>
            <Link
              href="/registry"
              className="inline-block btn-gradient px-6 py-2.5 rounded-lg text-sm font-semibold"
            >
              Browse Tools
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions: Redeem */}
      <div className="bg-surface border border-border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-elevated flex items-center justify-center">
            <IconLock size={18} className="text-text-dim" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text">
                Redeem Tokens
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-dim text-amber border border-amber/20">
                Coming Soon
              </span>
            </div>
            <p className="text-text-dim text-sm mt-0.5">
              Balance: {totalEarned} GREP
            </p>
          </div>
        </div>
        <p className="text-text-dim text-xs sm:text-right max-w-xs">
          Token redemption will be available once the vault is funded and
          audited.
        </p>
      </div>
    </div>
  );
}
