'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import UserButton from '@/components/UserButton';
import { useAuth } from '@/providers/AuthProvider';
import {
  IconRegistry,
  IconBuilder,
  IconPlus,
  IconBarChart,
  IconRewards,
  IconChevronLeft,
  IconChevronRight,
  IconMenu,
  IconX,
} from '@/components/Icons';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  authRequired?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/registry', label: 'Registry', icon: IconRegistry },
  { href: '/builder/submit', label: 'Submit Tool', icon: IconPlus },
  { href: '/builder/tools', label: 'My Tools', icon: IconBuilder, authRequired: true },
  { href: '/agent/profile', label: 'Dashboard', icon: IconBarChart, authRequired: true },
  { href: '/agent/redeem', label: 'Rewards', icon: IconRewards, authRequired: true },
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
      <span className="logo-grep">grep</span>
      <span className="logo-ple">ple</span>
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLandingPage = pathname === '/';

  // Close mobile menu on route change
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
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  if (isLandingPage) {
    return null;
  }

  const publicItems = NAV_ITEMS.filter((item) => !item.authRequired);
  const authItems = NAV_ITEMS.filter((item) => item.authRequired);

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
          isActive
            ? 'bg-elevated text-text'
            : 'text-text-secondary hover:text-text hover:bg-elevated/50'
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue rounded-r" />
        )}
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  const sidebarContent = (
    <aside
      className={`fixed top-0 left-0 h-full bg-surface border-r border-border flex flex-col z-50 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo + toggle */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <Link href="/" onClick={() => setMobileOpen(false)}>
          <Logo collapsed={collapsed} />
        </Link>
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-text-dim hover:text-text transition-colors hidden lg:flex items-center justify-center"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="text-text-dim hover:text-text transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <IconX size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {/* Public items */}
        <div className="space-y-1">
          {publicItems.map(renderNavItem)}
        </div>

        {/* Authenticated items */}
        {isAuthenticated && authItems.length > 0 && (
          <>
            <div className="mx-3 my-3 border-t border-border" />
            <div className="space-y-1">
              {authItems.map(renderNavItem)}
            </div>
          </>
        )}
      </nav>

      {/* User button at bottom */}
      <div className="p-3 border-t border-border">
        <UserButton compact={collapsed} />
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
        {/* Spacer to keep logo centered */}
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

      {/* Sidebar */}
      <div className={`${mobileOpen ? 'block animate-slide-left' : 'hidden'} lg:block`}>
        {sidebarContent}
      </div>
    </>
  );
}
