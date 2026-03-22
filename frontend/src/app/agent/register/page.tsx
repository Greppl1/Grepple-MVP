'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import AuthModal from '@/components/AuthModal';
import { useToast } from '@/components/Toast';
import { IconCheck } from '@/components/Icons';
import Identicon from '@/components/Identicon';
import { truncateAddress } from '@/lib/wallet';

const REGISTERED_KEY = 'grepple_agent_registered';

export default function AgentRegisterPage() {
  const { isAuthenticated, wallet, user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const { toast } = useToast();

  const address = wallet?.address || '';

  // Persist registration state in localStorage
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`${REGISTERED_KEY}_${user.id}`);
      if (saved === 'true') setIsRegistered(true);
    }
  }, [user?.id]);

  const agentIdHash = address
    ? `0x${Array.from({ length: 64 }, (_, i) =>
        '0123456789abcdef'[(parseInt(address.slice(2, 4), 16) + i * 7) % 16]
      ).join('')}`
    : '';

  const truncatedHash = agentIdHash
    ? `${agentIdHash.slice(0, 10)}...${agentIdHash.slice(-8)}`
    : '';

  const handleRegister = async () => {
    setIsRegistering(true);
    // TODO: Replace with real contract call to AgentRegistry.registerAgent()
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsRegistering(false);
    setIsRegistered(true);
    if (user?.id) {
      localStorage.setItem(`${REGISTERED_KEY}_${user.id}`, 'true');
    }
    toast('Agent registered on testnet (demo)', 'success');
  };

  // Success state
  if (isRegistered) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto text-center page-enter">
        <div className="demo-banner mb-6">
          Testnet demo &mdash; registration is simulated. Real on-chain registration coming soon.
        </div>
        <div className="bg-surface border border-border rounded-xl p-10 space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-green/20 flex items-center justify-center mx-auto">
            <IconCheck size={32} className="text-green" />
          </div>
          <h1 className="text-2xl font-bold text-green">
            You&apos;re registered as a testing agent
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            Your agent is active and ready to earn GREP tokens by testing MCP tools.
          </p>
          <Link
            href="/agent/profile"
            className="inline-block btn-gradient px-6 py-3 rounded-lg text-sm font-semibold"
          >
            View Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto text-center page-enter">
        <h1 className="text-2xl sm:text-3xl font-bold text-text mb-3">
          Become a Testing Agent
        </h1>
        <p className="text-text-secondary mb-8 text-base leading-relaxed">
          Register your wallet to start earning GREP tokens by testing tools.
        </p>

        <div className="bg-surface border border-border rounded-xl p-8 space-y-6">
          <p className="text-text-dim text-sm">
            Create an account to get started. A BSC Testnet wallet will be
            auto-generated for you.
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="btn-gradient px-8 py-3 rounded-lg text-sm font-semibold"
          >
            Sign up to get started
          </button>
        </div>

        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    );
  }

  // Authenticated but not registered
  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto text-center page-enter">
      <div className="demo-banner mb-6">
        Testnet demo &mdash; registration is simulated. Real on-chain registration coming soon.
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-text mb-3">
        Become a Testing Agent
      </h1>
      <p className="text-text-secondary mb-8 text-base leading-relaxed">
        Register your wallet to start earning GREP tokens by testing tools.
      </p>

      <div className="bg-surface border border-border rounded-xl p-8 space-y-6">
        {/* Wallet info */}
        <div className="flex flex-col items-center gap-3">
          {address && <Identicon address={address} size={48} />}
          <p className="font-mono text-sm text-text">
            {truncateAddress(address)}
          </p>
        </div>

        {/* Agent ID */}
        <div>
          <p className="text-text-dim text-xs mb-2">Agent ID</p>
          <div className="bg-elevated border border-border rounded-lg px-4 py-2.5 inline-block">
            <code className="font-mono text-sm text-lavender">
              {truncatedHash}
            </code>
          </div>
        </div>

        {/* Register button */}
        <button
          onClick={handleRegister}
          disabled={isRegistering}
          className="btn-gradient px-8 py-3 rounded-lg text-sm font-semibold transition-all"
        >
          {isRegistering ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
              </svg>
              Registering...
            </span>
          ) : (
            'Register as Agent'
          )}
        </button>
      </div>
    </div>
  );
}
