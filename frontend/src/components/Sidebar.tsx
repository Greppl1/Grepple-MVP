'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const NAV_ITEMS = [
  { href: '/registry', label: 'Registry', icon: '⬡' },
  { href: '/builder/submit', label: 'Builder', icon: '⚡' },
  { href: '/agent/profile', label: 'Agent', icon: '◎' },
  { href: '/agent/redeem', label: 'Rewards', icon: '✦' },
];

function Logo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <span className="text-xl font-bold">
        <span className="text-white">g</span>
      </span>
    );
  }
  return (
    <span className="text-xl font-bold tracking-tight">
      <span className="text-white">g</span>
      <span className="text-purple">r</span>
      <span className="text-lavender">e</span>
      <span className="text-white">p</span>
      <span className="text-blue">p</span>
      <span className="text-blue-bright">l</span>
      <span className="text-white">e</span>
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-surface border-r border-border flex flex-col z-50 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <Link href="/">
          <Logo collapsed={collapsed} />
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-text-dim hover:text-text transition-colors text-sm"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-purple-dim text-white border border-border-hi'
                  : 'text-text-secondary hover:text-white hover:bg-elevated'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Wallet */}
      <div className="p-3 border-t border-border">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-elevated border border-border" />
          </div>
        ) : (
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <button
                  onClick={connected ? openAccountModal : openConnectModal}
                  className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold transition-all btn-gradient"
                >
                  {connected
                    ? `${account.displayName}`
                    : 'Connect Wallet'}
                </button>
              );
            }}
          </ConnectButton.Custom>
        )}
      </div>
    </aside>
  );
}
