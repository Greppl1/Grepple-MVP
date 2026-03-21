'use client';

import { useState } from 'react';
import ScoreRing from '@/components/ScoreRing';
import { IconExternalLink, IconInfo } from '@/components/Icons';

const MOCK_PROFILE = {
  wallet: '0x7099...79C8',
  walletFull: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  registeredDate: '2026-03-15',
  isActive: true,
  totalEarned: 12.5,
  tasksCompleted: 8,
  successRate: 87.5,
};

const MOCK_REWARDS = [
  { mintId: 42, taskId: 'task_20260318_abc123', toolId: 'swap_tokens', tier: 'FULL' as const, amount: 2.0, date: '2026-03-18', txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456' },
  { mintId: 38, taskId: 'task_20260317_def456', toolId: 'price_feed', tier: 'FULL' as const, amount: 2.0, date: '2026-03-17', txHash: '0xdef456789012345678901234567890abcdef1234567890abcdef123456789012' },
  { mintId: 35, taskId: 'task_20260316_ghi789', toolId: 'swap_tokens', tier: 'PARTIAL' as const, amount: 1.0, date: '2026-03-16', txHash: '0x789012345678901234567890abcdef1234567890abcdef12345678901234abcd' },
  { mintId: 31, taskId: 'task_20260316_jkl012', toolId: 'nft_mint', tier: 'FULL' as const, amount: 2.0, date: '2026-03-16', txHash: '0x012345678901234567890abcdef1234567890abcdef1234567890abcdef012345' },
  { mintId: 27, taskId: 'task_20260315_mno345', toolId: 'bridge_asset', tier: 'PARTIAL' as const, amount: 1.0, date: '2026-03-15', txHash: '0x345678901234567890abcdef1234567890abcdef1234567890abcdef12345678' },
  { mintId: 22, taskId: 'task_20260315_pqr678', toolId: 'price_feed', tier: 'FULL' as const, amount: 2.0, date: '2026-03-15', txHash: '0x678901234567890abcdef1234567890abcdef1234567890abcdef1234567890ab' },
];

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
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-elevated border border-border-hi text-xs text-text whitespace-nowrap z-10 shadow-lg">
          {tooltipText}
        </span>
      )}
    </span>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-text-dim text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-text">
        {value}
        {suffix && (
          <span className="text-sm font-normal text-text-secondary ml-1">{suffix}</span>
        )}
      </p>
    </div>
  );
}

export default function AgentProfilePage() {
  const profile = MOCK_PROFILE;
  const rewards = MOCK_REWARDS;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-8">Agent Profile</h1>

      {/* Profile Card */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-elevated border-2 border-border-hi flex items-center justify-center shrink-0">
            <span className="text-2xl text-lavender">A</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <span className="font-mono text-base text-text">{profile.wallet}</span>
              <a
                href={`https://testnet.bscscan.com/address/${profile.walletFull}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-text-dim hover:text-lavender transition-colors text-xs"
              >
                BscScan <IconExternalLink size={10} />
              </a>
            </div>
            <p className="text-text-dim text-sm">Registered {profile.registeredDate}</p>
          </div>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-dim text-green border border-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green mr-2" />
          Active
        </span>
      </div>

      {/* Tier Explanation */}
      <div className="bg-purple-dim border border-border-hi rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
        <IconInfo size={18} className="text-lavender shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary leading-relaxed">
          <span className="font-semibold text-green">FULL</span> = successful tool call + structured report submitted.{' '}
          <span className="font-semibold text-amber">PARTIAL</span> = failed call with valid error diagnosis submitted.
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 stagger-children">
        <div className="bg-surface border border-border rounded-xl p-5 stat-highlight">
          <p className="text-text-dim text-sm mb-1">Total Earned</p>
          <p className="text-3xl font-bold text-text">
            {profile.totalEarned}
            <span className="text-sm font-normal text-text-secondary ml-1">AAOT</span>
          </p>
        </div>
        <StatCard label="Tasks Completed" value={profile.tasksCompleted} />
        <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-text-dim text-sm mb-1">Success Rate</p>
            <p className="text-2xl font-bold text-text">
              {profile.successRate}
              <span className="text-sm font-normal text-text-secondary ml-1">%</span>
            </p>
          </div>
          <ScoreRing score={profile.successRate} size={56} />
        </div>
      </div>

      {/* Rewards History */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Rewards History</h2>
        </div>
        {rewards.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-dim text-left">
                  <th className="px-6 py-3 font-medium">Mint ID</th>
                  <th className="px-6 py-3 font-medium hidden sm:table-cell">Task</th>
                  <th className="px-6 py-3 font-medium">Tool</th>
                  <th className="px-6 py-3 font-medium">Tier</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium hidden md:table-cell">Date</th>
                  <th className="px-6 py-3 font-medium hidden lg:table-cell">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr
                    key={reward.mintId}
                    className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-text-secondary">#{reward.mintId}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary hidden sm:table-cell">
                      {reward.taskId.slice(0, 20)}...
                    </td>
                    <td className="px-6 py-4 text-text">{reward.toolId}</td>
                    <td className="px-6 py-4"><TierBadge tier={reward.tier} /></td>
                    <td className="px-6 py-4 text-right font-mono text-text">
                      {reward.amount.toFixed(1)}{' '}
                      <span className="text-text-dim">AAOT</span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary hidden md:table-cell">{reward.date}</td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <a
                        href={`https://testnet.bscscan.com/tx/${reward.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-lavender hover:text-blue-bright transition-colors"
                      >
                        {reward.txHash.slice(0, 8)}...{reward.txHash.slice(-6)}
                        <IconExternalLink size={10} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-text-dim text-sm mb-2">No rewards earned yet.</p>
            <p className="text-text-dim text-xs">Start testing MCP tools to earn AAOT tokens.</p>
          </div>
        )}
      </div>
    </div>
  );
}
