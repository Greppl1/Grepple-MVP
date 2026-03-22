import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl font-mono font-bold text-text-dim mb-4">404</div>
        <h1 className="text-xl font-semibold text-text mb-2">Page not found</h1>
        <p className="text-text-secondary mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-gradient px-5 py-2.5 rounded-lg text-sm font-medium">
            Home
          </Link>
          <Link href="/registry" className="btn-secondary px-5 py-2.5 rounded-lg text-sm font-medium">
            Browse Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
