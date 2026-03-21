'use client';

import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/';

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <div className="lg:ml-60 pt-14 lg:pt-0 min-h-screen pb-16 lg:pb-0">
      {children}
      <BottomNav />
    </div>
  );
}
