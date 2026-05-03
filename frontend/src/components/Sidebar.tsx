'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context';
import {
  Home,
  Target,
  Brain,
  BarChart3,
  FolderOpen,
  Settings,
  X,
  Bird,
  ChevronRight,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'New Goal', href: '/goal', icon: Target },
  { name: 'Training', href: '/train', icon: Brain },
  { name: 'Monitor', href: '/monitor', icon: BarChart3 },
  { name: 'Models', href: '/models', icon: FolderOpen },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar, activeWorkflowId, workflowStatus } = useApp();
  const isCollapsed = !isSidebarOpen;

  const sidebarClass = cn(
    "fixed inset-y-0 left-0 z-50 w-64 lg:w-16 bg-[200%_100%] bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 animate-gradient-x backdrop-blur-md shadow-2xl flex flex-col transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] lg:w-64",
    isSidebarOpen ? "translate-x-0" : "-translate-x-full",
    !isSidebarOpen ? "lg:w-16 lg:shadow-lg" : "lg:w-64 lg:shadow-2xl"
  );

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={sidebarClass}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 lg:px-2 backdrop-blur-lg bg-black/30 border-b border-white/20">
          <Link href="/" className="flex items-center space-x-2 text-white p-2 rounded-xl group hover:scale-105 transition-all">
            <Bird className="h-6 w-6 lg:h-7 lg:w-7 animate-float-in lg:mx-auto" />
            <span className={cn("text-xl font-bold bg-gradient-to-r from-white to-orange-200 bg-clip-text text-transparent origin-left transition-all duration-300", isCollapsed && "lg:scale-0 lg:invisible")}>Auga RLAI</span>
          </Link>
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1 rounded-full text-white hover:text-orange-200 hover:scale-110 transition-all duration-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-hidden">
          {navigation.map((item, index) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const badgeCount = item.name === 'Models' ? 12 : 0;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex transition-all duration-300 rounded-xl shadow-md hover:shadow-xl hover:drop-shadow-2xl backdrop-blur-sm hover:scale-[1.02] animate-float-in',
                  isCollapsed ? 'p-3 justify-center w-full lg:p-2.5' : 'px-4 py-3',
                  isActive
                    ? 'bg-white/20 ring-2 ring-white/50 shadow-lg animate-pulse-glow font-semibold'
                    : 'hover:bg-white/20 text-white/80 hover:text-white'
                )}
                style={{ animationDelay: `${index * 0.08}s` }}
                title={isCollapsed ? item.name : undefined}
              >
                <div className={cn('flex items-center', isCollapsed ? 'w-full justify-center' : '')}>
                  <Icon
                    className={cn(
                      'h-5 w-5 lg:h-6 lg:w-6 transition-all duration-300 shrink-0 mx-auto lg:mx-0',
                      isCollapsed ? 'lg:mx-auto' : 'mr-3',
                      isActive ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,1)] animate-pulse-glow' : 'text-white/70 group-hover:text-white group-hover:scale-110 group-hover:animate-[wiggle_0.5s_ease-in-out]'
                    )}
                  />
                  <ChevronRight className={cn(
                    'h-4 w-4 ml-1 transition-transform duration-300 group-hover:rotate-180 opacity-70',
                    isCollapsed && 'hidden lg:block'
                  )} />
                  <span className={cn(
                    isCollapsed ? 'hidden lg:hidden scale-0 opacity-0' : 'block origin-left'
                  )}>
                    {item.name}
                  </span>
                  {badgeCount > 0 && (
                    <span className={cn(
                      "ml-auto px-2 py-0.5 bg-white/20 rounded-full text-xs font-mono text-white/80",
                      isCollapsed && "hidden"
                    )}>
                      ({badgeCount})
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Active workflow indicator */}
        {activeWorkflowId && !isCollapsed && (
          <div className="mx-4 mb-4 p-4 bg-black/30 backdrop-blur-md rounded-xl shadow-lg border border-white/20 animate-float-in">
            <div className="text-xs text-white/70 mb-1 font-medium tracking-wide">Active Workflow</div>
            <div className="text-sm text-white font-mono truncate bg-black/50 px-2 py-1 rounded">{activeWorkflowId}</div>
            <div className="flex items-center mt-3">
              <span
                className={cn(
                  'h-3 w-3 rounded-full mr-2 shadow-lg transition-all duration-500 flex-shrink-0',
                  workflowStatus === 'running' ? 'bg-gradient-to-r from-yellow-400 to-orange-400 animate-[pulse-glow_1.5s_infinite] animate-spin-slow' : '',
                  workflowStatus === 'completed' ? 'bg-emerald-400 animate-bounce-slow' : '',
                  workflowStatus === 'failed' ? 'bg-red-400 animate-[wiggle_1s_infinite]' : 'bg-gray-400/50'
                )}
              />
              <span className="text-xs text-white/90 font-medium capitalize tracking-wide">{workflowStatus || 'idle'}</span>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="px-4 py-4 lg:px-2 border-t border-white/20">
          <Link
            href="/settings"
            className={cn(
              'flex transition-all duration-300 rounded-xl shadow-md hover:shadow-xl hover:drop-shadow-2xl hover:scale-[1.02] animate-float-in backdrop-blur-sm',
              isCollapsed ? 'p-3 justify-center w-full lg:p-2.5' : 'px-4 py-3',
              'text-white/90 hover:bg-white/20 hover:text-white'
            )}
            style={{ animationDelay: '0.4s' }}
            title={isCollapsed ? 'Settings' : undefined}
          >
            <div className="flex items-center w-full lg:justify-center">
              <Settings 
                className={cn(
                  'h-5 w-5 lg:h-6 lg:w-6 transition-all duration-300 shrink-0 mx-auto lg:mx-0',
                  isCollapsed ? 'mx-auto' : 'mr-3',
                  'text-white/70 group-hover:text-white group-hover:scale-110 group-hover:animate-[wiggle_0.5s_ease-in-out]'
                )} 
              />
              <ChevronRight className="h-4 w-4 ml-1 transition-transform duration-300 group-hover:rotate-180 opacity-70 hidden lg:block" />
              <span className={cn(isCollapsed ? 'hidden lg:hidden scale-0 opacity-0' : 'block origin-left')}>Settings</span>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
