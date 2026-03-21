'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { truncateAddress } from '@/lib/wallet';
import AuthModal from './AuthModal';
import Identicon from './Identicon';
import { IconExternalLink } from './Icons';

interface UserButtonProps {
  /** Compact mode for collapsed sidebar or mobile */
  compact?: boolean;
}

export default function UserButton({ compact = false }: UserButtonProps) {
  const { user, wallet, isAuthenticated, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!isAuthenticated) {
    if (compact) {
      return (
        <>
          <button
            onClick={() => setShowAuth(true)}
            className="w-10 h-10 rounded-full bg-elevated border border-border hover:border-border-hi flex items-center justify-center transition-all mx-auto"
            aria-label="Sign in"
          >
            <span className="w-2 h-2 rounded-full bg-text-dim" />
          </button>
          <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
        </>
      );
    }

    return (
      <>
        <button
          onClick={() => setShowAuth(true)}
          className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold transition-all btn-gradient"
        >
          Get Started
        </button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </>
    );
  }

  // Authenticated
  const email = user?.email || '';
  const displayEmail = email.length > 20 ? email.slice(0, 17) + '...' : email;
  const walletAddr = wallet?.address || '';

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-10 h-10 rounded-full overflow-hidden border border-border hover:border-border-hi transition-all mx-auto flex items-center justify-center"
          aria-label="Account"
        >
          {walletAddr ? (
            <Identicon address={walletAddr} size={40} />
          ) : (
            <span className="text-xs font-mono text-text">{email.slice(0, 2).toUpperCase()}</span>
          )}
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute bottom-12 left-0 z-50 bg-surface border border-border rounded-xl p-3 shadow-xl shadow-black/40 min-w-[200px] animate-scale-in">
              <p className="text-xs text-text-secondary truncate mb-2">{email}</p>
              {walletAddr && (
                <p className="text-[10px] text-text-dim font-mono mb-2">{truncateAddress(walletAddr)}</p>
              )}
              <button
                onClick={() => { signOut(); setShowMenu(false); }}
                className="w-full text-left text-xs text-red hover:text-white transition-colors py-1"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg bg-elevated border border-border hover:border-border-hi transition-all text-left"
      >
        {walletAddr ? (
          <Identicon address={walletAddr} size={28} />
        ) : (
          <div className="w-7 h-7 rounded-full bg-purple-dim flex items-center justify-center text-xs font-semibold text-lavender">
            {email.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text truncate">{displayEmail}</p>
          {walletAddr && (
            <p className="text-[10px] text-text-dim font-mono">{truncateAddress(walletAddr)}</p>
          )}
        </div>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-full left-0 right-0 z-50 mb-2 bg-surface border border-border rounded-xl p-4 shadow-xl shadow-black/40 animate-scale-in">
            <p className="text-xs text-text-secondary mb-1">Signed in as</p>
            <p className="text-sm text-text font-medium truncate mb-3">{email}</p>

            {walletAddr && (
              <div className="bg-elevated rounded-lg px-3 py-2 mb-3">
                <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">Auto Wallet (Testnet)</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-lavender font-mono flex-1 truncate">{walletAddr}</p>
                  <a
                    href={`https://testnet.bscscan.com/address/${walletAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-dim hover:text-lavender transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconExternalLink size={10} />
                  </a>
                </div>
              </div>
            )}

            <button
              onClick={() => { signOut(); setShowMenu(false); }}
              className="w-full py-2 rounded-lg text-xs font-medium text-red hover:bg-red-dim transition-all border border-transparent hover:border-red/20"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
