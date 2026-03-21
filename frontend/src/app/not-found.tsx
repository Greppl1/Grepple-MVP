import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-elevated border border-border flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold font-mono text-text-dim">?</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-text-secondary text-sm mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist, may have been moved, or the tool ID is invalid.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold">
            Back to home
          </Link>
          <Link href="/registry" className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-semibold">
            Browse Registry
          </Link>
        </div>
      </div>
    </div>
  );
}
