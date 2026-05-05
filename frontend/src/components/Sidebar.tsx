'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context';
import {
  Home, Brain, BarChart3, FolderOpen,
  Settings, Bird, ChevronLeft, ChevronRight,
  Gamepad2, Bell, Zap, Database, Activity,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const NAV_GROUPS = [
  {
    label: 'Pipeline',
    items: [
      { name: 'Dashboard',          href: '/',           icon: Home     },
      { name: 'Training Pipeline',  href: '/train',      icon: Brain    },
      { name: 'Live Monitor',       href: '/monitor',    icon: Activity },
      { name: 'Run Agent',          href: '/inference',  icon: Zap      },
    ],
  },
  {
    label: 'Management',
    items: [
      { name: 'Model Registry',  href: '/models',        icon: Database  },
      { name: 'Simulation',      href: '/simulation',    icon: Gamepad2  },
      { name: 'Notifications',   href: '/notifications', icon: Bell      },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar, activeWorkflowId, workflowStatus } = useApp();
  const isCollapsed = !isSidebarOpen;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('http://localhost:8000/notifications/unread-count');
        if (r.ok) { const d = await r.json(); setUnread(d.count || 0); }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  const NavItem = ({ item }: { item: { name: string; href: string; icon: React.ElementType } }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        title={isCollapsed ? item.name : undefined}
        className={cn(
          'group flex items-center rounded-xl transition-all duration-200 relative',
          isCollapsed ? 'px-3 py-2.5 justify-center' : 'px-3 py-2.5',
          isActive
            ? 'bg-white/20 text-white shadow-sm'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon className={cn(
          'h-5 w-5 flex-shrink-0',
          isCollapsed ? '' : 'mr-3',
          isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
        )} />
        {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}

        {/* Notification badge on Notifications item */}
        {item.name === 'Notifications' && unread > 0 && (
          <span className={cn(
            'absolute flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold border border-white/30',
            isCollapsed ? 'top-1 right-1 w-4 h-4' : 'ml-auto w-5 h-5 text-[10px]'
          )}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}

        {/* Active pipeline pulse on Training Pipeline */}
        {item.name === 'Training Pipeline' && activeWorkflowId && workflowStatus === 'running' && (
          <span className={cn(
            'absolute flex items-center justify-center rounded-full bg-yellow-400',
            isCollapsed ? 'top-1 right-1 w-2.5 h-2.5' : 'ml-auto w-2.5 h-2.5'
          )}>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75" />
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={toggleSidebar} />
      )}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-out',
        'bg-gradient-to-b from-orange-600 via-red-700 to-rose-800',
        'dark:from-gray-900 dark:via-gray-900 dark:to-gray-950',
        'shadow-2xl shadow-orange-900/30 dark:shadow-black/40',
        isCollapsed ? 'w-16' : 'w-64',
        isCollapsed && 'max-lg:-translate-x-full',
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link href="/" className="flex items-center space-x-2.5 text-white">
            <div className="relative">
              <Bird className={cn('h-7 w-7', isCollapsed && 'mx-auto')} />
              {activeWorkflowId && workflowStatus === 'running' && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              )}
            </div>
            {!isCollapsed && <span className="text-lg font-bold tracking-tight">Auga RLAI</span>}
          </Link>
          <button onClick={toggleSidebar} className="hidden lg:flex p-1 rounded-lg hover:bg-white/10">
            {isCollapsed
              ? <ChevronRight className="h-4 w-4 text-white/60" />
              : <ChevronLeft className="h-4 w-4 text-white/60" />
            }
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto scrollbar-thin">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {!isCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map(item => <NavItem key={item.href} item={item} />)}
              </div>
            </div>
          ))}
        </nav>

        {/* Active workflow indicator */}
        {activeWorkflowId && !isCollapsed && (
          <div className="mx-3 mb-3 p-3 bg-black/20 rounded-xl border border-white/10">
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Active Pipeline</div>
            <div className="text-xs text-white/80 font-mono truncate">{activeWorkflowId}</div>
            <div className="flex items-center mt-2">
              <span className={cn(
                'h-2 w-2 rounded-full mr-2 flex-shrink-0',
                workflowStatus === 'running'   ? 'bg-yellow-400 animate-pulse' : '',
                workflowStatus === 'completed' ? 'bg-green-400' : '',
                workflowStatus === 'failed'    ? 'bg-red-400' : 'bg-gray-400'
              )} />
              <span className="text-[11px] text-white/70 capitalize">{workflowStatus || 'idle'}</span>
            </div>
          </div>
        )}

        {/* Phase badge when collapsed */}
        {isCollapsed && activeWorkflowId && (
          <div className="mx-2 mb-3 p-2 bg-black/20 rounded-xl border border-white/10 flex justify-center">
            <span className={cn(
              'h-3 w-3 rounded-full',
              workflowStatus === 'running'   ? 'bg-yellow-400 animate-pulse' : '',
              workflowStatus === 'completed' ? 'bg-green-400' : '',
              workflowStatus === 'failed'    ? 'bg-red-400' : 'bg-gray-400'
            )} />
          </div>
        )}
      </aside>
    </>
  );
}
