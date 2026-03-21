'use client';

import Link from 'next/link';
import { useRegistry } from '@/hooks/useRegistry';
import { useAuth } from '@/providers/AuthProvider';
import { Skeleton } from '@/components/Skeleton';
import { IconArrowRight } from '@/components/Icons';

export default function LandingPage() {
  const { stats, loading, isLive } = useRegistry();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen animate-fade-in">

      {/* Hero */}
      <section className="hero-gradient pt-32 pb-24 px-6 lg:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
            The quality layer
            <br />
            for <span className="text-blue-bright">AI tools</span>
          </h1>

          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed">
            Submit your tool. We test it with real AI agents.
            The best tools get discovered and rewarded.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/builder/submit"
              className="btn-gradient px-8 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            >
              Submit a Tool <IconArrowRight size={14} />
            </Link>
            <Link
              href="/registry"
              className="btn-secondary px-8 py-3.5 rounded-xl text-sm font-semibold"
            >
              Browse Tools
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm text-text-dim">
          {loading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-28" />
              <span className="text-border">&middot;</span>
              <Skeleton className="h-4 w-24" />
              <span className="text-border">&middot;</span>
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <>
              <span>{stats.totalTools.toLocaleString()} tools indexed</span>
              <span className="text-border">&middot;</span>
              <span>{stats.totalBuilders} repositories</span>
              <span className="text-border">&middot;</span>
              <span>Live on BSC Testnet</span>
            </>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            How it works
          </h2>

          <div className="space-y-16">
            {[
              {
                step: '01',
                title: 'Submit',
                desc: 'Point us to your tool\u2019s endpoint. We auto-detect the schema and validate the configuration.',
              },
              {
                step: '02',
                title: 'Diagnose',
                desc: 'Our AI agents run real tests against your tool \u2014 not mock calls, real invocations with structured scoring.',
              },
              {
                step: '03',
                title: 'Launch',
                desc: 'Passing tools enter the public registry. Top performers earn GREP tokens as agents adopt them.',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-6 md:gap-8">
                <span className="text-4xl md:text-5xl font-bold font-mono text-blue-bright/30 leading-none shrink-0 pt-1">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-text mb-2">
                    {item.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 lg:px-10 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to ship?
          </h2>
          <Link
            href="/builder/submit"
            className="btn-gradient px-8 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 mb-4"
          >
            Submit Your First Tool <IconArrowRight size={14} />
          </Link>
          <p className="text-sm text-text-dim">
            Or{' '}
            <Link href="/registry" className="text-blue-bright hover:underline">
              browse the registry
            </Link>{' '}
            to see what&apos;s already live.
          </p>
        </div>
      </section>

    </div>
  );
}
