'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  return (
    <main
      className={`min-h-screen transition-all duration-300 ${
        isLandingPage ? '' : 'lg:ml-60 pt-14 lg:pt-0'
      }`}
    >
      {children}
    </main>
  );
}
