'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconRegistry, IconPlus, IconBarChart, IconSparkles, IconSearch } from '@/components/Icons';

const items = [
  { href: '/registry', label: 'Registry', icon: IconRegistry },
  { href: '/intent', label: 'Try', icon: IconSparkles },
  { href: '/builder/submit', label: 'Submit', icon: IconPlus },
  { href: '/agent/profile', label: 'Agent', icon: IconBarChart },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isLanding = pathname === '/';

  if (isLanding) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-surface/95 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                active
                  ? 'text-blue'
                  : 'text-text-dim hover:text-text-secondary'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
