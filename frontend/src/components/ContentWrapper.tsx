'use client';

import { useApp } from '@/lib/context';
import { cn } from '@/lib/utils';

export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useApp();

  return (
    <div className={cn(
      "flex flex-col flex-1 min-h-screen transition-all duration-300 ease-out",
      isSidebarOpen ? "ml-64" : "ml-16",
      "max-lg:ml-0" // Mobile: no margin
    )}>
      {children}
    </div>
  );
}
