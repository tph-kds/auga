'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastNotif {
  id: string;
  level: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  exiting?: boolean;
}

let _push: ((n: Omit<ToastNotif, 'id'>) => void) | null = null;

/** Call from anywhere: pushNotification({ level:'success', title:'Done', message:'...' }) */
export function pushNotification(n: Omit<ToastNotif, 'id'>) {
  _push?.(n);
}

const ICONS = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

const BG = {
  success: 'border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-950/40',
  error:   'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40',
  warning: 'border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-950/40',
  info:    'border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/40',
};

export default function NotificationToaster() {
  const [toasts, setToasts] = useState<ToastNotif[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  const push = useCallback((n: Omit<ToastNotif, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [{ ...n, id }, ...prev].slice(0, 5));
    setTimeout(() => remove(id), n.level === 'error' ? 8000 : 5000);
  }, [remove]);

  useEffect(() => { _push = push; return () => { _push = null; }; }, [push]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl
            backdrop-blur-md ${BG[toast.level]}
            ${toast.exiting ? 'notif-exit' : 'notif-enter'}`}
        >
          <div className="flex-shrink-0 mt-0.5">{ICONS[toast.level]}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{toast.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>
          <button onClick={() => remove(toast.id)} className="flex-shrink-0 p-0.5 hover:opacity-70 transition-opacity">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      ))}
    </div>
  );
}
