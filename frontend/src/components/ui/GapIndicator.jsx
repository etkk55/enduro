import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from './utils';

/**
 * Position change indicator between two stages.
 * - positive delta => gained positions (green, up)
 * - negative delta => lost positions (red, down)
 * - zero => neutral dash
 */
export function PositionDelta({ delta, size = 'md', className }) {
  const sizes = {
    sm: 'text-2xs gap-0.5',
    md: 'text-xs gap-1',
    lg: 'text-sm gap-1',
  };
  const iconSizes = { sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-3.5 h-3.5' };

  if (!delta || delta === 0) {
    return (
      <span className={cn('inline-flex items-center text-content-tertiary', sizes[size], className)}>
        <Minus className={iconSizes[size]} />
      </span>
    );
  }

  if (delta > 0) {
    return (
      <span className={cn('inline-flex items-center font-semibold text-success-fg', sizes[size], className)}>
        <TrendingUp className={iconSizes[size]} />
        <span className="tabular-nums">{delta}</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center font-semibold text-danger-fg', sizes[size], className)}>
      <TrendingDown className={iconSizes[size]} />
      <span className="tabular-nums">{Math.abs(delta)}</span>
    </span>
  );
}

/**
 * Time gap from leader or reference.
 * Color-coded: green (gained), red (lost), neutral.
 */
export function TimeGap({ seconds, size = 'md', showSign = true, className }) {
  if (seconds === null || seconds === undefined) {
    return <span className={cn('text-content-tertiary font-mono tabular-nums', className)}>—</span>;
  }

  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (seconds === 0) {
    return (
      <span className={cn('font-mono tabular-nums text-content-secondary font-medium', sizes[size], className)}>
        —
      </span>
    );
  }

  const abs = Math.abs(seconds);
  const formatted = abs < 60
    ? abs.toFixed(2)
    : `${Math.floor(abs / 60)}:${(abs % 60).toFixed(2).padStart(5, '0')}`;

  const tone = seconds > 0 ? 'text-danger-fg' : 'text-success-fg';
  const sign = showSign ? (seconds > 0 ? '+' : '-') : '';

  return (
    <span className={cn('font-mono tabular-nums font-semibold', tone, sizes[size], className)}>
      {sign}{formatted}
    </span>
  );
}
