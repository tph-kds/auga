'use client';

import { useApp } from '@/lib/context';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ContentWrapperProps {
  children: ReactNode;
  className?: string;
}

export default function ContentWrapper({ children, className }: ContentWrapperProps) {
  const { isSidebarOpen } = useApp();

  const contentClass = cn(
    'flex-1 flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
    'lg:ml-16', 
    isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
  );

  return (
    <div className={contentClass + (className ? ` ${className}` : '')}>
      {children}
    </div>
  );
}
