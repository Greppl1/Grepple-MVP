'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SubNavItem {
  href: string;
  label: string;
}

interface SubNavProps {
  items: SubNavItem[];
}

export default function SubNav({ items }: SubNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 mb-8 border-b border-border pb-px overflow-x-auto">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
              isActive
                ? 'text-white border-blue'
                : 'text-text-secondary hover:text-white border-transparent hover:border-border-hi'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export const BUILDER_NAV: SubNavItem[] = [
  { href: '/builder/tools', label: 'My Tools' },
  { href: '/builder/submit', label: 'Submit' },
  { href: '/builder/budget', label: 'Budget' },
];

export const AGENT_NAV: SubNavItem[] = [
  { href: '/agent/profile', label: 'Profile' },
  { href: '/agent/register', label: 'Register' },
  { href: '/agent/redeem', label: 'Redeem' },
];
