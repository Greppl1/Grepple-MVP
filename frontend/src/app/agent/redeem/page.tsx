'use client';

import { useState } from 'react';
import { IconLock, IconUnlock, IconInfo } from '@/components/Icons';

const MOCK_BALANCE = 12.5;
const REDEMPTION_ENABLED = false;
const USDC_RATE = 0.1;

const MOCK_AVAILABLE_MINTS = [
  { mintId: 42, taskId: 'task_20260318_abc123', toolId: 'swap_tokens', tier: 'FULL' as const, amount: 2.0 },
  { mintId: 38, taskId: 'task_20260317_def456', toolId: 'price_feed', tier: 'FULL' as const, amount: 2.0 },
  { mintId: 35, taskId: 'task_20260316_ghi789', toolId: 'swap_tokens', tier: 'PARTIAL' as const, amount: 1.0 },
  { mintId: 31, taskId: 'task_20260316_jkl012', toolId: 'nft_mint', tier: 'FULL' as const, amount: 2.0 },
  { mintId: 27, taskId: 'task_20260315_mno345', toolId: 'bridge_asset', tier: 'PARTIAL' as const, amount: 1.0 },
  { mintId: 22, taskId: 'task_20260315_pqr678', toolId: 'price_feed', tier: 'FULL' as const, amount: 2.0 },
];

function TierBadge({ tier }: { tier: 'FULL' | 'PARTIAL' }) {
  if (tier === 'FULL') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-dim text-green border border-green/20">
        FULL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-dim text-amber border border-amber/20">
      PARTIAL
    </span>
  );
}

function StepItem({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-full bg-purple-dim border border-border-hi flex items-center justify-center text-sm font-bold text-lavender shrink-0">
        {number}
      </div>
      <div>
        <p className="text-sm font-semibold text-text mb-0.5">{title}</p>
        <p className="text-xs text-text-dim">{description}</p>
      </div>
    </div>
  );
}

export default function AgentRedeemPage() {
  const [selectedMints, setSelectedMints] = useState<number[]>([]);
  const [tokenAmount, setTokenAmount] = useState('');

  const selectedTotal = MOCK_AVAILABLE_MINTS.filter((m) =>
    selectedMints.includes(m.mintId)
  ).reduce((sum, m) => sum + m.amount, 0);

  const effectiveAmount = tokenAmount
    ? Math.min(parseFloat(tokenAmount) || 0, selectedTotal)
    : selectedTotal;
  const usdcOutput = effectiveAmount * USDC_RATE;

  const toggleMint = (mintId: number) => {
    setSelectedMints((prev) =>
      prev.includes(mintId)
        ? prev.filter((id) => id !== mintId)
        : [...prev, mintId]
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright mb-8">Redeem Tokens</h1>

      {/* Balance Display */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-dim text-sm mb-1">Your GREP Balance</p>
            <p className="text-3xl sm:text-4xl font-bold text-text font-mono">
              {MOCK_BALANCE}
              <span className="text-base font-normal text-text-secondary ml-2">GREP</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-dim text-xs mb-1">Estimated Value</p>
            <p className="text-lg font-bold font-mono text-text-secondary">
              {(MOCK_BALANCE * USDC_RATE).toFixed(2)}
              <span className="text-xs font-normal text-text-dim ml-1">USDC</span>
            </p>
          </div>
        </div>
      </div>

      {/* Redemption Status Banner */}
      {REDEMPTION_ENABLED ? (
        <div className="bg-green-dim border border-green/20 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <IconUnlock size={18} className="text-green shrink-0" />
          <span className="text-green text-sm font-medium">Redemption is open!</span>
        </div>
      ) : (
        <div className="bg-amber-dim border border-amber/20 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
          <IconLock size={18} className="text-amber shrink-0 mt-0.5" />
          <div>
            <span className="text-amber text-sm font-semibold block mb-1">
              Vault redemption is not yet active.
            </span>
            <span className="text-amber/70 text-sm leading-relaxed">
              Your testnet tokens are accumulating as on-chain contribution records.
              When the vault opens, you&apos;ll be able to redeem them for USDC.
            </span>
          </div>
        </div>
      )}

      {/* Redemption Form */}
      <div
        className={`bg-surface border border-border rounded-xl p-6 mb-6 space-y-6 ${
          !REDEMPTION_ENABLED ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {/* Token Amount Input */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Token Amount</label>
          <div className="relative">
            <input
              type="number"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder={`Max: ${selectedTotal.toFixed(1)}`}
              disabled={!REDEMPTION_ENABLED}
              className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-text font-mono text-sm placeholder:text-text-dim focus:outline-none focus:border-border-hi disabled:cursor-not-allowed"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim text-sm">
              GREP
            </span>
          </div>
        </div>

        {/* Select Mint IDs */}
        <div>
          <label className="block text-sm font-medium text-text mb-3">Select Mint Records</label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {MOCK_AVAILABLE_MINTS.map((mint) => (
              <label
                key={mint.mintId}
                className={`flex items-center gap-3 bg-elevated border rounded-lg px-4 py-3 cursor-pointer transition-all ${
                  selectedMints.includes(mint.mintId)
                    ? 'border-border-hi bg-purple-dim'
                    : 'border-border hover:border-border-hi'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedMints.includes(mint.mintId)}
                  onChange={() => toggleMint(mint.mintId)}
                  disabled={!REDEMPTION_ENABLED}
                  className="w-4 h-4 rounded border-border accent-blue"
                />
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-secondary">#{mint.mintId}</span>
                    <span className="text-sm text-text">{mint.toolId}</span>
                    <TierBadge tier={mint.tier} />
                  </div>
                  <span className="font-mono text-sm text-text">
                    {mint.amount.toFixed(1)} <span className="text-text-dim">GREP</span>
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Expected USDC Output */}
        <div className="bg-elevated border border-border rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-text-secondary">Expected USDC Output</span>
          <span className="text-xl font-bold font-mono text-text">
            {usdcOutput.toFixed(2)} <span className="text-sm font-normal text-text-dim">USDC</span>
          </span>
        </div>

        {/* Redeem Button */}
        <button
          disabled={!REDEMPTION_ENABLED || selectedMints.length === 0}
          className={`w-full btn-gradient py-3 px-6 rounded-lg text-sm font-semibold transition-all ${
            !REDEMPTION_ENABLED || selectedMints.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          {REDEMPTION_ENABLED ? 'Redeem' : 'Coming Soon'}
        </button>
      </div>

      {/* How Redemption Works */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text mb-5">How Redemption Works</h2>
        <div className="space-y-5">
          <StepItem
            number={1}
            title="Tokens Verified"
            description="Your GREP token balance and ownership of selected mint records are verified on-chain."
          />
          <StepItem
            number={2}
            title="Mint Records Validated"
            description="Each mint record is cross-referenced with the Registry call record hash to confirm authenticity."
          />
          <StepItem
            number={3}
            title="USDC Transferred"
            description="Upon successful validation, the equivalent USDC amount is transferred from the Vault to your wallet."
          />
        </div>
      </div>
    </div>
  );
}
