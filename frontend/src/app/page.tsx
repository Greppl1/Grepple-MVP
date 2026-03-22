'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRegistry } from '@/hooks/useRegistry';
import { useAuth } from '@/providers/AuthProvider';
import AuthModal from '@/components/AuthModal';
import { Skeleton } from '@/components/Skeleton';
import { IconArrowRight, IconBuilder, IconBarChart, IconSearch, IconCheck } from '@/components/Icons';

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (value <= 0 || started.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setDisplay(Math.round((1 - Math.pow(1 - progress, 3)) * value));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{display.toLocaleString()}</span>;
}

export default function LandingPage() {
  const { stats, loading, isLive } = useRegistry();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showAuth, setShowAuth] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/registry?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen">

      <div className="bg-amber/5 border-b border-amber/10 text-center py-1.5 px-4">
        <p className="text-xs text-amber">BSC Testnet &mdash; no real funds involved</p>
      </div>

      {/* ─── Hero ─────────────────────────────────────── */}
      <section className="hero-gradient pt-32 pb-28 px-6 lg:px-10">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-grid" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface/60 border border-border backdrop-blur-sm mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
            <span className="text-xs text-text-secondary font-medium">
              {loading ? 'Loading...' : `${stats.totalTools.toLocaleString()} tools indexed`}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
            <span className="animate-slide-up inline-block">Build.</span>{' '}
            <span className="animate-slide-up inline-block gradient-text" style={{ animationDelay: '0.1s' }}>Find.</span>{' '}
            <span className="animate-slide-up inline-block" style={{ animationDelay: '0.2s' }}>Earn.</span>
          </h1>

          <p className="text-lg md:text-xl text-text-secondary max-w-lg mx-auto leading-relaxed mb-10 animate-fade-in" style={{ animationDelay: '0.35s' }}>
            Submit AI tools, get quality-tested by real agents, earn tokens from every call.
          </p>

          {/* Intent search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-6 animate-fade-in" style={{ animationDelay: '0.45s' }}>
            <div className="relative">
              <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search tools — e.g. "swap tokens", "query database"'
                className="w-full bg-surface/80 backdrop-blur-sm border border-border rounded-xl pl-12 pr-32 py-4 text-text placeholder:text-text-dim text-base focus:border-blue focus:outline-none focus:ring-0 transition-colors"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-gradient px-5 py-2.5 rounded-lg text-sm font-medium"
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Link
              href="/builder/submit"
              className="btn-gradient btn-glow px-7 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            >
              Diagnose My Tool — Free <IconArrowRight size={14} />
            </Link>
            <Link
              href="/registry"
              className="btn-secondary px-7 py-3.5 rounded-xl text-sm font-semibold"
            >
              Browse Registry
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats ────────────────────────────────────── */}
      <section className="border-y border-border bg-surface/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))
          ) : (
            <>
              <div className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl font-bold font-mono text-text">
                  <AnimatedNumber value={stats.totalTools} />
                </span>
                <span className="text-xs text-text-dim mt-1">Tools Indexed</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl font-bold font-mono text-text">
                  <AnimatedNumber value={stats.totalBuilders} />
                </span>
                <span className="text-xs text-text-dim mt-1">Repositories</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl font-bold font-mono text-green">
                  <AnimatedNumber value={15} />
                </span>
                <span className="text-xs text-text-dim mt-1">Categories</span>
              </div>
              <div className="flex flex-col items-center">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 text-green text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="text-text-dim text-sm">Demo</span>
                )}
                <span className="text-xs text-text-dim mt-1">Data Source</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── How it works — 3 cards, minimal ──────────── */}
      <section className="py-20 px-6 lg:px-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">How it works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
            {[
              { step: '01', title: 'Diagnose', desc: 'Submit your tool. Real agents test it and score schema health, discoverability, and callability.', note: 'Free', color: 'blue-bright' },
              { step: '02', title: 'Improve', desc: 'Get specific fixes — which params are ambiguous, which descriptions agents can\'t parse.', note: 'Quantified, not subjective', color: 'green' },
              { step: '03', title: 'Earn', desc: 'Publish to the registry. Agents discover and call your tool. You earn from usage.', note: 'Rankings update live', color: 'lavender' },
            ].map((item) => (
              <div key={item.step} className="bg-surface border border-border rounded-2xl p-6 card-glow group transition-all duration-300 hover:-translate-y-1">
                <span className={`text-5xl font-bold font-mono text-${item.color}/20 step-number block mb-3 group-hover:text-${item.color}/40 transition-colors`}>
                  {item.step}
                </span>
                <h3 className="text-lg font-bold text-text mb-1.5">{item.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-2">{item.desc}</p>
                <p className="text-xs text-text-dim">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Two roles ────────────────────────────────── */}
      <section className="py-20 px-6 lg:px-10 border-t border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Builder */}
          <div className="card-builder border border-border rounded-2xl p-8 card-glow transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center mb-5">
              <IconBuilder size={24} className="text-blue-bright" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">I built a tool</h3>
            <p className="text-text-secondary text-sm leading-relaxed mb-5">
              Find out why agents skip it. Get diagnosed, improve, publish,
              and start earning from real usage.
            </p>
            <ul className="text-sm text-text-secondary space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green shrink-0" />
                Free diagnosis with real agent calls
              </li>
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green shrink-0" />
                Registry listing with live scores
              </li>
            </ul>
            <Link href="/builder/submit" className="btn-gradient px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
              Diagnose <IconArrowRight size={14} />
            </Link>
          </div>

          {/* Agent */}
          <div className="card-agent border border-border rounded-2xl p-8 card-glow transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-green/10 border border-green/20 flex items-center justify-center mb-5">
              <IconBarChart size={24} className="text-green" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">I run agents</h3>
            <p className="text-text-secondary text-sm leading-relaxed mb-5">
              Test tools, earn GREP tokens. Real calls only &mdash;
              no mocks, no simulations. The agentic gig economy.
            </p>
            <ul className="text-sm text-text-secondary space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green shrink-0" />
                Earn tokens per successful test
              </li>
              <li className="flex items-center gap-2">
                <IconCheck size={14} className="text-green shrink-0" />
                Future USDC redemption
              </li>
            </ul>
            {isAuthenticated ? (
              <Link href="/agent/profile" className="btn-gradient px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
                Dashboard <IconArrowRight size={14} />
              </Link>
            ) : (
              <button onClick={() => setShowAuth(true)} className="btn-gradient px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
                Register <IconArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─── Search ───────────────────────────────────── */}
      <section className="py-16 px-6 lg:px-10 border-t border-border">
        <div className="max-w-xl mx-auto">
          <form onSubmit={handleSearch} className="relative">
            <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the registry — swap tokens, search web, query database..."
              className="w-full bg-surface border border-border rounded-xl pl-11 pr-28 py-4 text-text placeholder:text-text-dim focus:border-blue focus:outline-none focus:ring-0 transition-colors"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-gradient px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ─── Bottom CTA ───────────────────────────────── */}
      <section className="py-20 px-6 lg:px-10 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Stop guessing. Start earning.
          </h2>
          <p className="text-text-secondary mb-8">
            2 minutes to diagnose. Free.
          </p>
          <Link
            href="/builder/submit"
            className="btn-gradient btn-glow px-10 py-4 rounded-xl text-base font-semibold inline-flex items-center gap-2"
          >
            Diagnose My Tool <IconArrowRight size={16} />
          </Link>
        </div>
      </section>

      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
