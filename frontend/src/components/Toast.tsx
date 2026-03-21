'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { IconCheck, IconX, IconInfo } from './Icons';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const iconMap = {
    success: <IconCheck size={16} className="text-green shrink-0" />,
    error: <IconX size={16} className="text-red shrink-0" />,
    info: <IconInfo size={16} className="text-blue-bright shrink-0" />,
  };

  const borderMap = {
    success: 'border-green/30',
    error: 'border-red/30',
    info: 'border-blue/30',
  };

  return (
    <ToastContext value={{ toast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 bg-surface border ${borderMap[t.type]} rounded-xl px-5 py-3 shadow-2xl shadow-black/30 animate-slide-in min-w-[280px] max-w-[420px]`}
          >
            {iconMap[t.type]}
            <span className="text-sm text-text flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-text-dim hover:text-text transition-colors shrink-0"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
