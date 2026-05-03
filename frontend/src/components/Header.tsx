'use client';

import { useApp } from '@/lib/context';
import { Menu, X, Bell, Search, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function Header() {
  const { toggleSidebar, isSidebarOpen, theme, setTheme } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const isCollapsed = !isSidebarOpen;

  return (
    <header className={cn(
      "fixed left-0 top-0 right-0 z-40 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 px-6 py-3 shadow-lg transition-all duration-700",
      isCollapsed 
        ? "bg-gradient-to-r from-amber-400/60 via-orange-400/60 to-red-500/60 shadow-2xl pl-6 lg:pl-20"
        : "bg-white/80 dark:bg-gray-800/80 shadow-lg pl-6 lg:pl-80"
    )}>
      <div className="flex items-center justify-between w-full">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          {/* Mobile toggle */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-xl hover:bg-white/30 backdrop-blur-sm hover:scale-110 transition-all duration-300 shadow-md hover:shadow-orange-500/50 group"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5 text-red-200 group-hover:text-white group-hover:rotate-90 group-hover:scale-110 transition-all duration-300" />
            ) : (
              <Menu className="h-5 w-5 text-orange-300 group-hover:text-white group-hover:animate-[wiggle_0.4s] transition-all duration-300" />
            )}
          </button>

          {/* Search */}
          <div className="flex items-center space-x-2 min-w-0 flex-1 lg:flex-auto lg:max-w-lg">
            <Search className={cn(
              "h-5 w-5 lg:h-6 lg:w-6 flex-shrink-0 transition-all duration-500",
              isCollapsed ? "text-orange-200 drop-shadow-lg hover:text-white" : "text-gray-400 hover:text-primary-500"
            )} />
            <input
              type="text"
              placeholder="Search models, experiments..."
              className={cn(
                "px-4 py-1.5 backdrop-blur-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 flex-1 lg:w-72 xl:w-96 transition-all duration-700 shadow-sm",
                isCollapsed ? "bg-white/40 dark:bg-gray-700/40 hover:shadow-2xl hover:ring-orange-400/50 text-white/90 font-medium shadow-lg" : "bg-white/50 dark:bg-gray-700/50 hover:shadow-md"
              )}
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          {/* Desktop toggle */}
          <button
            onClick={toggleSidebar}
            className="lg:flex hidden p-2 rounded-xl hover:bg-white/30 backdrop-blur-sm hover:scale-110 transition-all duration-300 shadow-md hover:shadow-orange-500/50 group"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5 text-red-200 group-hover:text-white group-hover:rotate-90 group-hover:scale-110 transition-all duration-300" />
            ) : (
              <Menu className="h-5 w-5 text-orange-300 group-hover:text-white group-hover:animate-[wiggle_0.4s] transition-all duration-300" />
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-gradient-to-br from-blue-400/30 to-indigo-400/30 backdrop-blur-sm hover:scale-110 transition-all duration-300 shadow-md hover:shadow-blue-500/30 group"
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === 'light' ? (
                <Moon className="h-5 w-5 text-gray-600 group-hover:text-blue-400 transition-all duration-300" />
              ) : (
                <Sun className="h-5 w-5 text-gray-300 group-hover:text-yellow-300 transition-all duration-300" />
              )
            ) : null}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl hover:bg-gradient-to-br from-purple-400/30 via-pink-400/30 backdrop-blur-sm hover:scale-110 transition-all duration-300 shadow-md hover:shadow-purple-500/30 group relative"
            >
              <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300 group-hover:text-purple-400 transition-all duration-300" />
              <span className="absolute top-1 right-0 h-2.5 w-2.5 bg-red-400 rounded-full shadow-lg animate-[pulse_1.5s_infinite]" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 z-50 animate-float-in">
                <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                </div>
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  No new notifications
                </div>
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-green-100/60 to-emerald-100/60 dark:from-green-900/60 dark:to-emerald-900/60 backdrop-blur-sm rounded-xl shadow-lg animate-pulse-glow transition-all duration-300">
            <span className="h-2.5 w-2.5 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full shadow-lg animate-[pulse-glow_2s_infinite]" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-300 tracking-wide">
              System Operational
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

