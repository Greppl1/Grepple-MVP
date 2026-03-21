'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  IconArrowRight,
  IconBuilder,
  IconRegistry,
  IconBarChart,
  IconTrendingUp,
  IconSparkles,
} from '@/components/Icons';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Floating nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-16 bg-bg-nav backdrop-blur-md border-b border-border/50">
        <span className="text-xl font-bold tracking-tight">
          <span className="logo-grep">grep</span><span className="logo-p2">p</span><span className="logo-l">l</span><span className="logo-e2">e</span>
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
      <div className="fixed top-16 left-0 right-0 z-40 testnet-banner text-center text-xs py-1.5 px-4 bg-amber/10 border-b border-amber/20 text-amber">
        You&apos;re on BSC Testnet &mdash; all data is simulated, no real funds involved.
      </div>

      {/* Hero */}
      <section className="hero-gradient pt-36 pb-20 px-6 lg:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-dim border border-border text-sm text-lavender mb-8 animate-fade-in">
            <IconSparkles size={14} />
            Built on BNB Chain &middot; Testnet
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-slide-up">
            Your MCP tools deserve
            <br />
            to be <span className="text-blue-bright">found</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
            Agents can&apos;t use tools they can&apos;t understand. Submit yours for automated diagnosis &mdash; get quality scores, improvement suggestions, and a spot in the public registry.
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
          {[
            { label: 'Tools Listed', value: '47', icon: IconRegistry },
            { label: 'Avg Score', value: '84.2', icon: IconBarChart },
            { label: 'Test Calls', value: '1.2K', icon: IconTrendingUp },
            { label: 'Builders', value: '23', icon: IconBuilder },
          ].map((stat) => (
            <div key={stat.label} className="px-6 py-5 text-center">
              <p className="text-2xl font-bold font-mono text-white">{stat.value}</p>
              <p className="text-xs text-text-dim mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 lg:px-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            How <span className="logo-grep">grep</span><span className="logo-ple">ple</span> works
          </h2>
          <p className="text-text-secondary text-center mb-14 max-w-xl mx-auto">
            Three steps from &ldquo;my tool exists&rdquo; to &ldquo;agents are using it.&rdquo;
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 stagger-children">
            {[
              {
                step: '01',
                title: 'Submit',
                desc: 'Point us at your MCP server URL. Our diagnostic agent connects, discovers every tool, and tests each endpoint automatically.',
              },
              {
                step: '02',
                title: 'Diagnose',
                desc: 'Get a quality score across schema health, discoverability, and callability. See exactly what to fix with AI-generated suggestions.',
              },
              {
                step: '03',
                title: 'Publish',
                desc: 'List your tool in the public registry. Agents discover it, call it, and you earn reputation on-chain for quality.',
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

      {/* CTA */}
      <section className="py-16 px-6 lg:px-10 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-text-secondary mb-8">
            Connect your wallet and submit your first tool in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/builder/submit"
              className="btn-gradient px-8 py-3.5 rounded-xl text-sm font-semibold"
            >
              Submit a Tool
            </Link>
            <Link
              href="/registry"
              className="btn-secondary px-8 py-3.5 rounded-xl text-sm font-semibold"
            >
              Browse Registry
            </Link>
          </div>
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
