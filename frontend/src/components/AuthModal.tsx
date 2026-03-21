'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { IconX } from './Icons';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const { signUp, signIn } = useAuth();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: err } = await signUp(email, password);
        if (err) {
          setError(err);
        } else {
          setSuccess('Check your email for a confirmation link, or you may already be logged in.');
          setTimeout(() => onClose(), 2000);
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err);
        } else {
          onClose();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[91] flex items-center justify-center p-4">
        <div
          className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/40 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">
              {mode === 'signup' ? 'Create Account' : 'Sign In'}
            </h2>
            <button
              onClick={onClose}
              className="text-text-dim hover:text-text transition-colors"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-text-secondary mb-6">
            {mode === 'signup'
              ? 'Sign up with your email. We\u2019ll auto-generate a BSC Testnet wallet for you.'
              : 'Sign in to access your tools, wallet, and rewards.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-elevated border border-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-text-dim focus:outline-none focus:border-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                required
                minLength={6}
                className="w-full bg-elevated border border-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-text-dim focus:outline-none focus:border-blue transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-dim border border-red/20 rounded-lg px-3 py-2 text-red text-xs">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-dim border border-green/20 rounded-lg px-3 py-2 text-green text-xs">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full btn-gradient py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
                  </svg>
                  {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                mode === 'signup' ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-5 text-center text-xs text-text-dim">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
                  className="text-blue-bright hover:text-white transition-colors font-medium"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  className="text-blue-bright hover:text-white transition-colors font-medium"
                >
                  Create one
                </button>
              </>
            )}
          </div>

          {/* Testnet note */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] text-text-dim text-center leading-relaxed">
              BSC Testnet only. A wallet will be auto-created for receiving test tokens.
              No real funds involved.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
