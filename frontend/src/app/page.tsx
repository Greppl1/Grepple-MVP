'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRegistry } from '@/hooks/useRegistry';
import {
  IconArrowRight,
  IconBuilder,
  IconAgent,
  IconRegistry,
  IconBarChart,
  IconTrendingUp,
  IconSparkles,
  IconSearch,
} from '@/components/Icons';

export default function LandingPage() {
  const { stats, loading, isLive } = useRegistry();

  return (
    <div className="min-h-screen">
      {/* Floating nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-16 bg-bg-nav backdrop-blur-md border-b border-border/50">
        <span className="text-xl font-bold tracking-tight">
          <span className="logo-grep">grep</span><span className="logo-ple">ple</span>
        </span>
        <div className="flex items-center gap-4">
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <button
                  onClick={connected ? openAccountModal : openConnectModal}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all btn-gradient"
                >
                  {connected ? account.displayName : 'Connect Wallet'}
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      {/* Testnet banner */}
      <div className="fixed top-16 left-0 right-0 z-40 text-center text-xs py-1.5 px-4 bg-amber/10 border-b border-amber/20 text-amber">
        BSC Testnet &mdash; no real funds involved
      </div>

      {/* Hero */}
      <section className="hero-gradient pt-36 pb-20 px-6 lg:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-dim border border-border text-sm text-lavender mb-8 animate-fade-in">
            <IconSparkles size={14} />
            {isLive ? `${stats.totalTools.toLocaleString()} tools indexed` : 'MCP Tool Quality Platform'}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-slide-up">
            Ship MCP tools that
            <br />
            agents <span className="text-blue-bright">actually use</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
            Grepple diagnoses your MCP tools for schema quality, discoverability, and callability &mdash; then lists them in a public registry where AI agents can find and invoke them.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up"
            style={{ animationDelay: '160ms', animationFillMode: 'both' }}
          >
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
              Explore Registry
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-surface/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-5 text-center">
                <div className="h-8 w-16 bg-elevated rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-20 bg-elevated rounded animate-pulse mx-auto" />
              </div>
            ))
          ) : (
            [
              { label: 'Tools Indexed', value: stats.totalTools.toLocaleString(), icon: IconRegistry },
              { label: 'Avg Score', value: String(stats.avgScore), icon: IconBarChart },
              { label: 'Benchmarks', value: stats.totalBenchmarks.toLocaleString(), icon: IconTrendingUp },
              { label: 'Builders', value: String(stats.totalBuilders), icon: IconBuilder },
            ].map((stat) => (
              <div key={stat.label} className="px-6 py-5 text-center">
                <p className="text-2xl font-bold font-mono text-white">{stat.value}</p>
                <p className="text-xs text-text-dim mt-1">{stat.label}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Role cards + steps */}
      <section className="py-20 px-6 lg:px-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            How <span className="logo-grep">grep</span><span className="logo-ple">ple</span> works
          </h2>
          <p className="text-text-secondary text-center mb-14 max-w-xl mx-auto">
            Whether you build tools or run agents &mdash; Grepple closes the gap between &ldquo;tool exists&rdquo; and &ldquo;agent uses it.&rdquo;
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {/* Builder card */}
            <Link
              href="/builder/submit"
              className="group bg-surface border border-border rounded-2xl p-8 card-glow flex flex-col"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-dim border border-blue/20 flex items-center justify-center mb-5">
                <IconBuilder size={22} className="text-blue-bright" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-bright transition-colors">
                I build MCP tools
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-4">
                Submit your tool for automated diagnosis. Get a quality score, fix suggestions, and publish to the registry so agents can discover it.
              </p>
              <span className="text-sm font-semibold text-blue-bright inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                Submit a tool <IconArrowRight size={14} />
              </span>
            </Link>

            {/* Agent card */}
            <Link
              href="/agent/register"
              className="group bg-surface border border-border rounded-2xl p-8 card-glow flex flex-col"
            >
              <div className="w-12 h-12 rounded-xl bg-green-dim border border-green/20 flex items-center justify-center mb-5">
                <IconAgent size={22} className="text-green" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-green transition-colors">
                I run AI agents
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-4">
                Register your agent, test MCP tools from the registry, and earn GREP tokens on-chain for quality diagnostics and structured reports.
              </p>
              <span className="text-sm font-semibold text-green inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                Register as agent <IconArrowRight size={14} />
              </span>
            </Link>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 stagger-children">
            {[
              {
                step: '01',
                title: 'Submit',
                desc: 'Point us at your MCP server URL. Our diagnostic agent connects, discovers every tool, and tests each endpoint.',
              },
              {
                step: '02',
                title: 'Diagnose',
                desc: 'Get a quality score across schema health, discoverability, and callability. See exactly what to fix with AI-generated suggestions.',
              },
              {
                step: '03',
                title: 'Publish',
                desc: 'Your tool goes live in the public registry. Agents find it, test it, and you earn on-chain reputation for quality.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-surface border border-border rounded-2xl p-6 card-glow"
              >
                <span className="text-3xl font-bold font-mono text-blue-bright">
                  {item.step}
                </span>
                <h3 className="text-lg font-bold text-white mt-3 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intent search */}
      <section className="py-16 px-6 lg:px-10 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Find the right tool</h2>
          <p className="text-text-secondary mb-8 text-sm">
            Describe what you need &mdash; we&apos;ll match you to the best-scored tools in the registry.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as HTMLFormElement).elements.namedItem('q') as HTMLInputElement;
              if (input.value.trim()) {
                window.location.href = `/registry?q=${encodeURIComponent(input.value.trim())}`;
              }
            }}
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
          >
            <div className="relative flex-1">
              <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                name="q"
                type="text"
                placeholder="e.g. swap tokens across chains"
                className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-blue transition-colors"
              />
            </div>
            <button
              type="submit"
              className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-sm text-text-dim">
            <span className="logo-grep">grep</span><span className="logo-ple">ple</span>{' \u2014 BSC Testnet'}
          </span>
          <span className="text-sm text-text-dim">
            &copy; 2026
          </span>
        </div>
      </footer>
    </div>
  );
}
