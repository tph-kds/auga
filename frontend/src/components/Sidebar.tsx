'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/context';
import {
  Home,
  Target,
  Brain,
  BarChart3,
  FolderOpen,
  Settings,
  Menu,
  X,
  Bird,
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
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-64 bg-gradient-to-b from-amber-500 via-orange-500 to-red-500
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          flex flex-col
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 bg-black bg-opacity-20">
          <Link href="/" className="flex items-center space-x-2 text-white">
            <Bird className="h-8 w-8" />
            <span className="text-xl font-bold">Auga RLAI</span>
          </Link>
          <button
            onClick={toggleSidebar}
            className="lg:hidden text-white hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center px-4 py-3 rounded-lg
                  transition-all duration-200 group
                  ${
                    isActive
                      ? 'bg-white bg-opacity-20 text-white font-semibold'
                      : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-white'
                  }
                `}
              >
                <Icon
                  className={`
                    h-5 w-5 mr-3 transition-colors
                    ${isActive ? 'text-white' : 'text-white text-opacity-70 group-hover:text-white'}
                  `}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Active workflow indicator */}
        {activeWorkflowId && (
          <div className="mx-4 mb-4 p-3 bg-black bg-opacity-20 rounded-lg">
            <div className="text-xs text-white text-opacity-70 mb-1">Active Workflow</div>
            <div className="text-sm text-white font-mono truncate">{activeWorkflowId}</div>
            <div className="flex items-center mt-2">
              <span
                className={`
                  h-2 w-2 rounded-full mr-2
                  ${workflowStatus === 'running' ? 'bg-yellow-400 animate-pulse' : ''}
                  ${workflowStatus === 'completed' ? 'bg-green-400' : ''}
                  ${workflowStatus === 'failed' ? 'bg-red-400' : ''}
                `}
              />
              <span className="text-xs text-white capitalize">{workflowStatus}</span>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="px-4 py-4 border-t border-white border-opacity-20">
          <Link
            href="/settings"
            className="flex items-center px-4 py-2 rounded-lg text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 transition-colors"
          >
            <Settings className="h-5 w-5 mr-3" />
            Settings
          </Link>
        </div>
      </aside>
    </>
  );
}
