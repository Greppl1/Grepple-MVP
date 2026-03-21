'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import CommandPalette from './CommandPalette';
import { useRegistry } from '@/hooks/useRegistry';

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  const { tools } = useRegistry();

  // Map tools for command palette search
  const paletteTools = tools.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
  }));

  return (
    <>
      <CommandPalette tools={paletteTools} />
      <main
        className={`min-h-screen transition-all duration-300 ${
          isLandingPage ? '' : 'lg:ml-60 pt-14 lg:pt-0'
        }`}
      >
        {children}
      </main>
    </>
  );
}
