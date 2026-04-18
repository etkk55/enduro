import { cn } from './utils';

/**
 * Podium/position indicator.
 * 1st-3rd: subtle gradient chip with medal color.
 * 4+: compact numeric badge with tabular-nums.
 */
export default function PodiumBadge({ position, size = 'md', className }) {
  const style = {
    1: 'text-amber-700 bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 dark:text-amber-300 dark:from-amber-900/40 dark:to-amber-800/40 dark:border-amber-700/60',
    2: 'text-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 dark:text-slate-300 dark:from-slate-800/60 dark:to-slate-700/60 dark:border-slate-600',
    3: 'text-orange-800 bg-gradient-to-br from-orange-100 to-orange-200 border border-orange-300 dark:text-orange-300 dark:from-orange-900/40 dark:to-orange-800/40 dark:border-orange-700/60',
  }[position];

  const sizes = {
    sm: 'h-6 min-w-[1.75rem] text-xs',
    md: 'h-7 min-w-[2rem] text-sm',
    lg: 'h-9 min-w-[2.5rem] text-base',
  };

  if (style) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-md font-bold px-2 font-mono tabular-nums shadow-sm',
          sizes[size], style, className
        )}
        aria-label={`Posizione ${position}`}
      >
        {position}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md font-mono tabular-nums font-semibold',
        'text-content-primary bg-surface-2',
        sizes[size], className
      )}
      aria-label={`Posizione ${position}`}
    >
      {position}
    </span>
  );
}
