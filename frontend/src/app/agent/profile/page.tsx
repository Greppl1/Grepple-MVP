'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { IconExternalLink, IconInfo, IconLock } from '@/components/Icons';
import Identicon from '@/components/Identicon';
import { truncateAddress } from '@/lib/wallet';

const REGISTERED_KEY = 'grepple_agent_registered';

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
  const { isAuthenticated, wallet, user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const rewards = MOCK_REWARDS;

  const address = wallet?.address || '';
  const totalEarned = rewards.reduce((sum, r) => sum + r.amount, 0);
  const tasksCompleted = rewards.length;
  const hasData = rewards.length > 0;

  // Check registration state from localStorage
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`${REGISTERED_KEY}_${user.id}`);
      if (saved === 'true') setIsRegistered(true);
    }
  }, [user?.id]);

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto page-enter">
        <h1 className="text-2xl sm:text-3xl font-bold text-text mb-8">
          Agent Dashboard
        </h1>
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <p className="text-text-dim text-base mb-4">
            Sign in to view your agent dashboard
          </p>
          <Link
            href="/agent/register"
            className="inline-block btn-gradient px-6 py-3 rounded-lg text-sm font-semibold"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto page-enter">
      <h1 className="text-2xl sm:text-3xl font-bold text-text mb-8">
        Agent Dashboard
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
        {isRegistered ? (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-dim text-green border border-green/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green mr-2" />
            Registered
          </span>
        ) : (
          <Link
            href="/agent/register"
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-dim text-amber border border-amber/20 hover:bg-amber/20 transition-colors"
          >
            Not registered &mdash; Register now
          </Link>
        )}
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
              {isRegistered
                ? 'Browse the registry and start testing tools to earn GREP tokens.'
                : 'Register as an agent first, then start testing tools to earn GREP tokens.'}
            </p>
            <Link
              href={isRegistered ? '/registry' : '/agent/register'}
              className="inline-block btn-gradient px-6 py-2.5 rounded-lg text-sm font-semibold"
            >
              {isRegistered ? 'Browse Tools' : 'Register Now'}
            </Link>
          </div>
        )}
      </div>

      {/* Claude Integration Demo */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4A574]/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#D4A574" opacity="0.2"/><path d="M9 8.5a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0zM8.5 14c.83 1.45 2.08 2.5 3.5 2.5s2.67-1.05 3.5-2.5" stroke="#D4A574" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Claude</p>
              <p className="text-xs text-text-dim">Using Grepple MCP tools</p>
            </div>
          </div>
          <span className="text-xs text-green font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            Connected
          </span>
        </div>

        <div className="px-6 py-5 space-y-5 bg-bg/50">
          {/* User message */}
          <div className="flex justify-end">
            <div className="bg-blue/10 border border-blue/20 rounded-2xl rounded-br-md px-4 py-3 max-w-sm">
              <p className="text-sm text-text">Search for the latest AI news and summarize the top 3 results</p>
            </div>
          </div>

          {/* Claude thinking */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#D4A574]/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A574"><circle cx="12" cy="12" r="10" opacity="0.3"/></svg>
            </div>
            <div className="space-y-3 flex-1">
              {/* Tool call */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-elevated/50 border-b border-border flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="text-xs font-mono text-green">web_search</span>
                  <span className="text-xs text-text-dim ml-auto">via Grepple Registry</span>
                </div>
                <div className="px-3 py-2">
                  <pre className="text-xs font-mono text-text-secondary overflow-x-auto">{`{
  "query": "latest AI news 2026",
  "num_results": 3,
  "language": "en"
}`}</pre>
                </div>
              </div>

              {/* Tool response */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-elevated/50 border-b border-border flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-bright"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                  <span className="text-xs font-mono text-text-dim">Response — 3 results</span>
                  <span className="text-xs text-green ml-auto">200 OK · 1.2s</span>
                </div>
                <div className="px-3 py-2">
                  <pre className="text-xs font-mono text-text-dim overflow-x-auto">{`[
  { "title": "GPT-5 Launches with...", "url": "..." },
  { "title": "Anthropic Releases...", "url": "..." },
  { "title": "Open Source AI...", "url": "..." }
]`}</pre>
                </div>
              </div>

              {/* Claude response */}
              <div className="text-sm text-text-secondary leading-relaxed">
                <p>Here are the top 3 AI news stories:</p>
                <ol className="mt-2 ml-4 space-y-1 list-decimal text-xs">
                  <li><strong className="text-text">GPT-5 Launches</strong> — OpenAI releases next-gen model with improved reasoning...</li>
                  <li><strong className="text-text">Anthropic Releases Claude 4.5</strong> — New model family with extended context...</li>
                  <li><strong className="text-text">Open Source AI Surges</strong> — Meta and Mistral push open-weight models...</li>
                </ol>
              </div>

              {/* GREP earned badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green/5 border border-green/15 rounded-lg">
                <span className="text-xs text-green font-medium">+1.0 GREP earned</span>
                <span className="text-xs text-text-dim">· Tool call verified on-chain</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border bg-surface/50">
          <p className="text-xs text-text-dim text-center">
            Connect tools from the <Link href="/registry" className="text-blue hover:underline">Grepple Registry</Link> to your Claude, GPT, or any MCP-compatible agent
          </p>
        </div>
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
              <span className="badge-coming-soon">Coming Soon</span>
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
