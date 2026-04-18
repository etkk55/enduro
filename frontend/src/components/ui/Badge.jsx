import { cn } from './utils';

const VARIANTS = {
  neutral: 'bg-surface-3 text-content-secondary border-border-subtle',
  brand: 'bg-brand-50 text-brand-700 border-brand-100 dark:text-brand-500',
  success: 'bg-success-bg text-success-fg border-success-border',
  warning: 'bg-warning-bg text-warning-fg border-warning-border',
  danger: 'bg-danger-bg text-danger-fg border-danger-border',
  info: 'bg-info-bg text-info-fg border-info-border',
};

const SIZES = {
  sm: 'h-5 px-1.5 text-2xs gap-1',
  md: 'h-6 px-2 text-xs gap-1',
  lg: 'h-7 px-2.5 text-sm gap-1.5',
};

export default function Badge({ variant = 'neutral', size = 'md', dot, className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium whitespace-nowrap',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
