'use client';

import Link from 'next/link';
import { IconLock } from '@/components/Icons';

export default function AgentRedeemPage() {
  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto text-center page-enter">
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright mb-3">
        Token Redemption
      </h1>
      <p className="text-text-secondary mb-8 text-base leading-relaxed">
        Convert GREP tokens to USDC from the vault.
      </p>

      <div className="bg-surface border border-border rounded-xl p-10 space-y-5">
        <div className="w-16 h-16 rounded-full bg-elevated flex items-center justify-center mx-auto">
          <IconLock size={28} className="text-text-dim" />
        </div>

        <h2 className="text-lg font-semibold text-text">
          Redemption is not yet active
        </h2>

        <p className="text-text-dim text-sm leading-relaxed max-w-sm mx-auto">
          Token redemption will be enabled once the vault is funded and audited.
          In the meantime, keep earning GREP by testing tools in the registry.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/registry"
            className="btn-gradient px-6 py-2.5 rounded-lg text-sm font-semibold"
          >
            Browse Tools
          </Link>
          <Link
            href="/agent/profile"
            className="btn-secondary px-6 py-2.5 rounded-lg text-sm font-semibold"
          >
            View Your Rewards
          </Link>
        </div>
      </div>
    </div>
  );
}
