'use client';

import { usePathname } from 'next/navigation';
import { useSidebar } from '@/providers/SidebarProvider';
import BottomNav from '@/components/BottomNav';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const isLanding = pathname === '/';

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <div
      className={`pt-14 lg:pt-0 min-h-screen pb-16 lg:pb-0 transition-[margin-left] duration-300 ${
        collapsed ? 'lg:ml-16' : 'lg:ml-60'
      }`}
    >
      {children}
      <BottomNav />
    </div>
  );
}
