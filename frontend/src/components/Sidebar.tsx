'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  IconRegistry,
  IconBuilder,
  IconAgent,
  IconChevronLeft,
  IconChevronRight,
  IconMenu,
  IconX,
} from './Icons';

interface NavChild {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/registry', label: 'Registry', icon: IconRegistry },
  {
    href: '/builder',
    label: 'Builder',
    icon: IconBuilder,
    children: [
      { href: '/builder/tools', label: 'My Tools' },
      { href: '/builder/submit', label: 'Submit Tool' },
      { href: '/builder/budget', label: 'Budget' },
    ],
  },
  {
    href: '/agent',
    label: 'Agent',
    icon: IconAgent,
    children: [
      { href: '/agent/profile', label: 'Profile' },
      { href: '/agent/register', label: 'Register' },
      { href: '/agent/redeem', label: 'Rewards' },
    ],
  },
];

function Logo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <span className="text-xl font-bold">
        <span className="logo-grep">g</span>
      </span>
    );
  }
  return (
    <span className="text-xl font-bold tracking-tight">
      <span className="logo-grep">grep</span><span className="logo-ple">ple</span>
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLandingPage = pathname === '/';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (isLandingPage) {
    return null;
  }

  const sidebarContent = (
    <aside
      className={`fixed top-0 left-0 h-full bg-surface border-r border-border flex flex-col z-50 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <Link href="/" onClick={() => setMobileOpen(false)}>
          <Logo collapsed={collapsed} />
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-text-dim hover:text-text transition-colors hidden lg:flex items-center justify-center"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="text-text-dim hover:text-text transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <IconX size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isParentActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;

          return (
            <div key={item.href}>
              {/* Parent item */}
              <Link
                href={hasChildren ? item.children![0].href : item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isParentActive
                    ? 'text-white'
                    : 'text-text-secondary hover:text-white hover:bg-elevated'
                }`}
                onClick={() => { if (mobileOpen && !hasChildren) setMobileOpen(false); }}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>

              {/* Children */}
              {hasChildren && !collapsed && isParentActive && (
                <div className="ml-[30px] mt-1 space-y-0.5 border-l border-border pl-3">
                  {item.children!.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-3 py-1.5 rounded-md text-sm transition-all ${
                          isChildActive
                            ? 'text-white bg-purple-dim font-medium'
                            : 'text-text-dim hover:text-text-secondary'
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Testnet indicator */}
      {!collapsed && (
        <div className="px-3 mb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-amber bg-amber-dim border border-amber/20">
            <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
            BSC Testnet
          </div>
        </div>
      )}

      {/* Wallet */}
      <div className="p-3 border-t border-border">
        {collapsed ? (
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <button
                  onClick={connected ? openAccountModal : openConnectModal}
                  className="w-10 h-10 rounded-full bg-elevated border border-border hover:border-border-hi flex items-center justify-center transition-all mx-auto"
                  aria-label={connected ? 'Account' : 'Connect wallet'}
                >
                  {connected ? (
                    <span className="text-xs font-mono text-text">
                      {account.displayName.slice(0, 2)}
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-text-dim" />
                  )}
                </button>
              );
            }}
          </ConnectButton.Custom>
        ) : (
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <button
                  onClick={connected ? openAccountModal : openConnectModal}
                  className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold transition-all btn-gradient"
                >
                  {connected ? account.displayName : 'Connect Wallet'}
                </button>
              );
            }}
          </ConnectButton.Custom>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-bg-nav backdrop-blur-md border-b border-border z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-text-dim hover:text-text transition-colors"
          aria-label="Open menu"
        >
          <IconMenu size={22} />
        </button>
        <Link href="/">
          <Logo collapsed={false} />
        </Link>
        <div className="w-[22px]" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div className={`${mobileOpen ? 'block animate-slide-left' : 'hidden'} lg:block`}>
        {sidebarContent}
      </div>
    </>
  );
}
