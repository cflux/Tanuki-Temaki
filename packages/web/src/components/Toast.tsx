import { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, type: Toast['type'] = 'info') {
  useToastStore.getState().addToast(message, type);
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const borderColor =
    t.type === 'error'
      ? 'border-red-500'
      : t.type === 'success'
        ? 'border-green-500'
        : 'border-cyber-accent';

  return (
    <div
      className={`bg-cyber-bg-elevated border ${borderColor} px-4 py-3 font-mono text-sm text-cyber-text-bright uppercase tracking-wide transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <span className="flex-1">{t.message}</span>
        <button
          onClick={onDismiss}
          className="text-cyber-text-dim hover:text-cyber-text-bright"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const handleDismiss = useCallback(
    (id: number) => removeToast(id),
    [removeToast]
  );

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => handleDismiss(t.id)} />
      ))}
    </div>
  );
}
