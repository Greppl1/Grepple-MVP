'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-dim border border-red/20 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF4757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Something went wrong</h2>
        <p className="text-text-secondary text-sm mb-8 leading-relaxed">
          An unexpected error occurred. This has been logged and we&apos;ll look into it.
        </p>
        <button
          onClick={reset}
          className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
