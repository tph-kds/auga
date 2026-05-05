'use client';

import { useApp } from '@/lib/context';
import { Menu, X, Bell, Search, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function Header() {
  const { toggleSidebar, isSidebarOpen, theme, setTheme, backendOnline } = useApp();
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!backendOnline) return;
    const poll = async () => {
      try {
        const r = await fetch('http://localhost:8000/notifications/unread-count');
        if (r.ok) { const d = await r.json(); setUnread(d.count || 0); }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [backendOnline]);

  return (
    <header className={cn(
      "fixed top-0 right-0 z-40 h-16 flex items-center px-6 transition-all duration-300",
      "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/30",
      isSidebarOpen ? "left-64" : "left-16"
    )}>
      <div className="flex items-center justify-between w-full">
        {/* Left */}
        <div className="flex items-center space-x-4">
          <button onClick={toggleSidebar}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle sidebar">
            {isSidebarOpen
              ? <X className="h-5 w-5 text-gray-500"/>
              : <Menu className="h-5 w-5 text-gray-500"/>}
          </button>

          <div className="hidden md:flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 w-72 lg:w-96">
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0"/>
            <input type="text" placeholder="Search models, experiments..."
              className="bg-transparent outline-none text-sm flex-1 text-gray-700 dark:text-gray-300 placeholder-gray-400"/>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center space-x-2">
          {mounted && (
            <div className={cn(
              'hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-500',
              backendOnline
                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40'
                : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40'
            )}>
              {backendOnline
                ? <><Wifi className="h-3 w-3"/>API Online</>
                : <><WifiOff className="h-3 w-3"/>API Offline</>}
            </div>
          )}

          <button onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme">
            {mounted && (theme === 'light'
              ? <Moon className="h-5 w-5 text-gray-500 hover:text-blue-500 transition-colors"/>
              : <Sun className="h-5 w-5 text-gray-400 hover:text-yellow-400 transition-colors"/>
            )}
          </button>

          <Link href="/notifications"
            className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Bell className="h-5 w-5 text-gray-500"/>
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
