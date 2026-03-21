import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in">
      <div className="text-center max-w-md">
        <h1 className="text-8xl font-bold text-blue-bright mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-text mb-3">Page not found</h2>
        <p className="text-text-dim mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="btn-secondary px-5 py-2.5 rounded-lg text-sm font-semibold">
            Back to home
          </Link>
          <Link href="/registry" className="text-sm font-semibold text-lavender hover:text-blue-bright transition-colors">
            Browse Registry
          </Link>
        </div>
      </div>
    </div>
  );
}
