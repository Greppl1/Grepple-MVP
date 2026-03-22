'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red/10 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-text mb-2">Something went wrong</h1>
        <p className="text-text-secondary mb-6 text-sm">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button onClick={reset} className="btn-gradient px-5 py-2.5 rounded-lg text-sm font-medium">
          Try again
        </button>
      </div>
    </div>
  );
}
