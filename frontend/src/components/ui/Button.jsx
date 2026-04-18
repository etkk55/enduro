import { forwardRef } from 'react';
import { cn } from './utils';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 shadow-sm',
  secondary: 'bg-surface text-content-primary border border-border hover:bg-surface-2 active:bg-surface-3',
  ghost: 'bg-transparent text-content-secondary hover:bg-surface-2 hover:text-content-primary',
  danger: 'bg-danger-fg text-white hover:opacity-90 active:opacity-85 shadow-sm',
  success: 'bg-success-fg text-white hover:opacity-90 active:opacity-85 shadow-sm',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
  xl: 'h-12 px-5 text-base gap-2',
  icon: 'h-9 w-9',
  'icon-sm': 'h-8 w-8',
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, leftIcon, rightIcon, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" className="opacity-75" />
        </svg>
      ) : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});

export default Button;
