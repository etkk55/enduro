// Toast system: provider + hook + viewport.
// Uso:
//   const { toast } = useToast();
//   toast({ title: 'Pilota eliminato', description: 'Operazione riuscita', variant: 'success', action: { label: 'Annulla', onClick: () => ... } });
//
// Monta <ToastViewport /> una sola volta (tipicamente in App.jsx vicino al root).
// Il provider è globale via modulo (nessun React Context necessario per semplicità).

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

const listeners = new Set();
let counter = 0;

export function toast(opts) {
  const t = { id: ++counter, duration: 4000, variant: 'default', ...opts, createdAt: Date.now() };
  listeners.forEach(l => l({ type: 'add', toast: t }));
  if (t.duration > 0) setTimeout(() => dismiss(t.id), t.duration);
  return t.id;
}

export function dismiss(id) {
  listeners.forEach(l => l({ type: 'remove', id }));
}

export function useToast() {
  return { toast, dismiss };
}

const VARIANT_ICON = {
  default: Info,
  success: CheckCircle2,
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_CLASS = {
  default: 'bg-surface border-border-subtle',
  success: 'bg-success-bg/95 border-success-border text-success-fg',
  danger:  'bg-danger-bg/95 border-danger-border text-danger-fg',
  warning: 'bg-warning-bg/95 border-warning-border text-warning-fg',
  info:    'bg-info-bg/95 border-info-border text-info-fg',
};

export function ToastViewport() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function handler(ev) {
      if (ev.type === 'add') setItems(prev => [...prev, ev.toast]);
      else if (ev.type === 'remove') setItems(prev => prev.filter(t => t.id !== ev.id));
    }
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
      {items.map(t => {
        const Icon = VARIANT_ICON[t.variant] || Info;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto border rounded-xl shadow-lg overflow-hidden animate-slide-up ${VARIANT_CLASS[t.variant] || VARIANT_CLASS.default}`}
          >
            <div className="flex items-start gap-2.5 p-3">
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {t.title && <div className="text-sm font-semibold leading-snug">{t.title}</div>}
                {t.description && <div className="text-xs opacity-80 mt-0.5">{t.description}</div>}
              </div>
              {t.action && (
                <button
                  onClick={() => { t.action.onClick && t.action.onClick(); dismiss(t.id); }}
                  className="text-xs font-bold underline-offset-2 hover:underline flex-shrink-0"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 opacity-60 hover:opacity-100 -mt-0.5 -mr-0.5 p-0.5"
                aria-label="Chiudi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
