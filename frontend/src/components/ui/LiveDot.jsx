import { cn } from './utils';

/**
 * Breathing "live" indicator - more refined than aggressive pulse.
 * Uses custom keyframe for subtle opacity + scale breathing.
 */
export default function LiveDot({ tone = 'danger', size = 'md', className }) {
  const tones = {
    danger: 'bg-danger-fg',
    success: 'bg-success-fg',
    brand: 'bg-brand-500',
    warning: 'bg-warning-fg',
  };
  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };
  const haloSizes = {
    sm: 'w-3 h-3 -inset-0.5',
    md: 'w-4 h-4 -inset-1',
    lg: 'w-5 h-5 -inset-1',
  };

  return (
    <span className={cn('relative inline-flex items-center justify-center', className)}>
      <span className={cn('absolute rounded-full animate-ping-subtle opacity-60', tones[tone], haloSizes[size])} />
      <span className={cn('relative rounded-full', tones[tone], sizes[size])} />
    </span>
  );
}
