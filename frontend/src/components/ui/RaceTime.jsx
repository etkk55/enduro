import { cn } from './utils';

/**
 * Race time display with tabular-nums and hierarchy.
 * Small sub-seconds, large main minutes/seconds.
 * Handles: "4'41.21", "mm:ss.d", "DNF", "RIT", numbers (seconds).
 */
export default function RaceTime({ time, size = 'md', muted, className }) {
  const formatted = formatRaceTime(time);

  const sizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl',
  };

  if (!formatted || formatted === 'DNF' || formatted === 'RIT') {
    return (
      <span className={cn('font-mono tabular-nums text-content-tertiary font-medium', sizes[size], className)}>
        {formatted || '—'}
      </span>
    );
  }

  const [main, sub] = formatted.split('.');

  return (
    <span className={cn(
      'font-mono tabular-nums font-semibold',
      muted ? 'text-content-secondary' : 'text-content-primary',
      sizes[size], className
    )}>
      <span>{main}</span>
      {sub !== undefined && (
        <span className={cn(
          'text-content-tertiary',
          size === 'xl' && 'text-base',
          size === 'lg' && 'text-sm',
          size === 'md' && 'text-xs',
          size === 'sm' && 'text-2xs',
          size === 'xs' && 'text-2xs'
        )}>.{sub}</span>
      )}
    </span>
  );
}

function formatRaceTime(time) {
  if (time === null || time === undefined) return '';
  if (typeof time === 'string') {
    const upper = time.toUpperCase();
    if (upper === 'DNF' || upper === 'RIT' || upper === 'RITIRATO') return upper;
    // Input "4'41.21" or "41.21" or "1:23.45"
    const normalized = time.replace("'", ':');
    return normalized;
  }
  if (typeof time === 'number' && !isNaN(time)) {
    const mins = Math.floor(time / 60);
    const secs = (time % 60).toFixed(2);
    const padded = Number(secs) < 10 ? `0${secs}` : secs;
    return mins > 0 ? `${mins}:${padded}` : `${padded}`;
  }
  return '';
}
