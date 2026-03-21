'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  IconArrowRight,
  IconSend,
  IconBuilder,
  IconAgent,
  IconRegistry,
  IconSparkles,
  IconBarChart,
  IconTrendingUp,
} from '@/components/Icons';

export default function LandingPage() {
  const [intent, setIntent] = useState('');
  const router = useRouter();

  const handleIntentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (intent.trim()) {
      router.push(`/registry?q=${encodeURIComponent(intent.trim())}`);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Floating nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-16 bg-bg-nav backdrop-blur-md border-b border-border/50">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-white">g</span>
          <span className="text-purple">r</span>
          <span className="text-lavender">e</span>
          <span className="text-white">p</span>
          <span className="text-blue">p</span>
          <span className="text-blue-bright">l</span>
          <span className="text-white">e</span>
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/registry"
            className="text-sm text-text-secondary hover:text-white transition-colors hidden sm:block"
          >
            Registry
          </Link>
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

      {/* Hero */}
      <section className="hero-gradient pt-32 pb-20 px-6 lg:px-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-dim border border-border text-sm text-lavender mb-8 animate-fade-in">
            <IconSparkles size={14} />
            MCP Tool Discovery & Quality Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-slide-up">
            Make your tools{' '}
            <span className="gradient-text">discoverable</span>
            <br />
            by any agent
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
            Diagnose, score, and publish MCP tools. Let AI agents find, evaluate, and call them — with on-chain rewards for quality.
          </p>

          {/* Intent Input */}
          <form
            onSubmit={handleIntentSubmit}
            className="max-w-2xl mx-auto mb-16 animate-slide-up"
            style={{ animationDelay: '160ms', animationFillMode: 'both' }}
          >
            <div className="relative group">
              <input
                type="text"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="What do you need an agent to do? e.g. &quot;swap ETH to USDC on Base&quot;"
                className="w-full px-6 py-4 pr-14 bg-surface border border-border rounded-2xl text-base text-text placeholder:text-text-dim focus:outline-none focus:border-blue transition-all group-hover:border-border-hi"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl btn-gradient flex items-center justify-center"
                aria-label="Search tools"
              >
                <IconSend size={16} />
              </button>
            </div>
            <p className="text-xs text-text-dim mt-3">
              Describe your task in natural language. We&apos;ll match you with the best MCP tools.
            </p>
          </form>

          {/* Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto stagger-children">
            <Link
              href="/builder/tools"
              className="group bg-surface border border-border rounded-2xl p-6 text-left card-glow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-dim flex items-center justify-center">
                  <IconBuilder size={20} className="text-blue-bright" />
                </div>
                <h3 className="text-lg font-bold text-white">I&apos;m a Builder</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Submit your MCP tool for automated diagnosis, get quality scores, improvement suggestions, and list it in the public registry.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-bright group-hover:gap-2 transition-all">
                Go to Dashboard <IconArrowRight size={14} />
              </span>
            </Link>

            <Link
              href="/agent/profile"
              className="group bg-surface border border-border rounded-2xl p-6 text-left card-glow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-dim flex items-center justify-center">
                  <IconAgent size={20} className="text-green" />
                </div>
                <h3 className="text-lg font-bold text-white">I&apos;m an Agent</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Register your agent wallet, test MCP tools from the registry, earn testnet tokens for quality diagnosis reports.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green group-hover:gap-2 transition-all">
                View Profile <IconArrowRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-surface/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
          {[
            { label: 'Tools Listed', value: '1,247', icon: IconRegistry },
            { label: 'Avg Quality Score', value: '84.2', icon: IconBarChart },
            { label: 'Weekly Calls', value: '52.4K', icon: IconTrendingUp },
            { label: 'Active Builders', value: '328', icon: IconBuilder },
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
            How <span className="gradient-text">Grepple</span> works
          </h2>
          <p className="text-text-secondary text-center mb-14 max-w-xl mx-auto">
            A closed-loop system where tools get better and agents earn more.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 stagger-children">
            {[
              {
                step: '01',
                title: 'Submit & Diagnose',
                desc: 'Builder submits an MCP tool. Our agent connects to it, tests every endpoint, and generates a structured diagnosis report.',
              },
              {
                step: '02',
                title: 'Score & Improve',
                desc: 'Get scores across schema health, discoverability, callability, and success rate. Apply AI-generated suggestions to improve.',
              },
              {
                step: '03',
                title: 'Launch & Earn',
                desc: 'Publish to the registry. Agents discover and use your tool. Quality test agents earn on-chain token rewards.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-surface border border-border rounded-2xl p-6 card-glow"
              >
                <span className="text-3xl font-bold font-mono gradient-text">
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
            Connect your wallet, submit your first tool, or explore the registry.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/builder/submit"
              className="btn-gradient px-8 py-3 rounded-xl text-sm font-semibold"
            >
              Submit a Tool
            </Link>
            <Link
              href="/registry"
              className="btn-secondary px-8 py-3 rounded-xl text-sm font-semibold"
            >
              Browse Registry
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-text-dim">
            Grepple &mdash; BSC Testnet
          </span>
          <div className="flex items-center gap-6 text-sm text-text-dim">
            <Link href="/registry" className="hover:text-text transition-colors">
              Registry
            </Link>
            <Link href="/builder/tools" className="hover:text-text transition-colors">
              Builder
            </Link>
            <Link href="/agent/profile" className="hover:text-text transition-colors">
              Agent
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
