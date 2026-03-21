'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import AuthModal from '@/components/AuthModal';
import { useToast } from '@/components/Toast';
import { IconCheck, IconInfo } from '@/components/Icons';
import Identicon from '@/components/Identicon';
import { truncateAddress } from '@/lib/wallet';

function StepIndicator({ step, currentStep, label }: { step: number; currentStep: number; label: string }) {
  const isCompleted = currentStep > step;
  const isActive = currentStep === step;

  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
        isCompleted ? 'bg-green border-green text-bg' : isActive ? 'border-blue-bright text-blue-bright bg-purple-dim' : 'border-border text-text-dim bg-surface'
      }`}>
        {isCompleted ? <IconCheck size={16} /> : step}
      </div>
      <span className={`text-sm font-medium ${isActive ? 'text-text' : isCompleted ? 'text-green' : 'text-text-dim'}`}>
        {label}
      </span>
    </div>
  );
}

export default function AgentRegisterPage() {
  const { isAuthenticated, user, wallet } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const { toast } = useToast();

  const address = wallet?.address || '';

  const agentIdHash = address
    ? `0x${Array.from({ length: 64 }, (_, i) =>
        '0123456789abcdef'[(parseInt(address.slice(2, 4), 16) + i * 7) % 16]
      ).join('')}`
    : '';

  const truncatedHash = agentIdHash
    ? `${agentIdHash.slice(0, 10)}...${agentIdHash.slice(-8)}`
    : '';

  const currentStep = !isAuthenticated ? 1 : !isRegistered ? 2 : 3;

  const handleRegister = async () => {
    setIsRegistering(true);
    // TODO: Replace with real contract call to AgentRegistry.registerAgent()
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsRegistering(false);
    setIsRegistered(true);
    toast('Agent registered successfully!', 'success');
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright mb-3">
        Register as Test Agent
      </h1>
      <p className="text-text-secondary mb-6 text-base leading-relaxed">
        Sign up with your email to start earning GREP tokens by testing MCP tools.
        A testnet wallet is auto-created for you.
      </p>

      {/* Info box */}
      <div className="bg-purple-dim border border-border-hi rounded-xl px-5 py-4 mb-10 flex items-start gap-3">
        <IconInfo size={18} className="text-lavender shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-text leading-relaxed">
            When you create an account, we auto-generate a BSC Testnet wallet for you.
            No extensions needed &mdash; everything runs in your browser.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-8">
        {/* Step 1: Create Account */}
        <div className="space-y-4">
          <StepIndicator step={1} currentStep={currentStep} label="Create Account" />
          <div className="ml-[52px]">
            {isAuthenticated ? (
              <div className="flex items-center gap-3 bg-green-dim border border-green/20 rounded-lg px-4 py-3">
                {address && <Identicon address={address} size={28} />}
                <div>
                  <span className="text-green text-sm font-medium">Signed in</span>
                  <span className="text-text text-sm ml-2">{user?.email}</span>
                  {address && (
                    <p className="text-text-dim text-xs font-mono mt-0.5">
                      Wallet: {truncateAddress(address)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="btn-gradient px-6 py-3 rounded-lg text-sm font-semibold"
              >
                Sign Up with Email
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Step 2: Agent ID */}
        <div className="space-y-4">
          <StepIndicator step={2} currentStep={currentStep} label="Agent ID" />
          <div className="ml-[52px]">
            <p className="text-text-dim text-sm mb-2">
              Your unique agent identifier (auto-generated from wallet):
            </p>
            <div className="bg-elevated border border-border rounded-lg px-4 py-3">
              <code className="font-mono text-sm text-lavender">
                {isAuthenticated ? truncatedHash : 'Sign up to generate...'}
              </code>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Step 3: Confirm */}
        <div className="space-y-4">
          <StepIndicator step={3} currentStep={currentStep} label="Confirm Registration" />
          <div className="ml-[52px]">
            {isRegistered ? (
              <div className="bg-green-dim border border-green/20 rounded-xl p-6 text-center space-y-4 animate-scale-in">
                <div className="w-16 h-16 rounded-full bg-green/20 flex items-center justify-center mx-auto">
                  <IconCheck size={32} className="text-green" />
                </div>
                <h3 className="text-xl font-bold text-green">You&apos;re registered!</h3>
                <p className="text-text-secondary text-sm">
                  Your agent is active and ready to earn tokens by testing MCP tools.
                </p>
                <Link
                  href="/agent/profile"
                  className="inline-block btn-gradient px-6 py-3 rounded-lg text-sm font-semibold"
                >
                  View Your Profile
                </Link>
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={!isAuthenticated || isRegistering}
                className="btn-gradient px-6 py-3 rounded-lg text-sm font-semibold transition-all"
              >
                {isRegistering ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
                    </svg>
                    Registering...
                  </span>
                ) : 'Register'}
              </button>
            )}
          </div>
        </div>
      </div>

      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
