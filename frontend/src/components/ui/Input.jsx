import { forwardRef } from 'react';
import { cn } from './utils';

const Input = forwardRef(function Input(
  { className, leftIcon, rightIcon, error, ...props }, ref
) {
  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none">
          {leftIcon}
        </div>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full h-9 rounded-md border bg-surface text-content-primary placeholder:text-content-tertiary',
          'text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-danger-fg' : 'border-border',
          leftIcon ? 'pl-9' : 'pl-3',
          rightIcon ? 'pr-9' : 'pr-3',
          className
        )}
        {...props}
      />
      {rightIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary">
          {rightIcon}
        </div>
      )}
    </div>
  );
});

export default Input;

export const Select = forwardRef(function Select(
  { className, children, error, ...props }, ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full h-9 px-3 pr-8 rounded-md border bg-surface text-content-primary',
        'text-sm transition-colors appearance-none cursor-pointer',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%2394A3B8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")] bg-no-repeat bg-[length:1.25rem] bg-[right_0.5rem_center]',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error ? 'border-danger-fg' : 'border-border',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ className, children, required, ...props }) {
  return (
    <label className={cn('block text-xs font-medium text-content-secondary mb-1.5', className)} {...props}>
      {children}
      {required && <span className="text-danger-fg ml-0.5">*</span>}
    </label>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-danger-fg">{children}</p>;
}
