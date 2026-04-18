import { Check } from 'lucide-react';
import { cn } from './utils';

/**
 * Linear progress steps with labels.
 * - current step: highlighted, ring
 * - done: filled with checkmark
 * - future: outlined, muted
 */
export default function ProgressSteps({ steps, currentStep, onStepClick, className }) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isClickable = onStepClick && (isDone || idx === currentStep);

          return (
            <div key={idx} className="flex-1 flex items-center last:flex-initial">
              <button
                type="button"
                onClick={isClickable ? () => onStepClick(idx) : undefined}
                disabled={!isClickable}
                className={cn(
                  'group flex flex-col items-center gap-2 shrink-0',
                  isClickable && 'cursor-pointer',
                  !isClickable && 'cursor-default'
                )}
              >
                <span
                  className={cn(
                    'relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all',
                    isDone && 'bg-brand-600 text-white shadow-sm',
                    isCurrent && 'bg-brand-600 text-white ring-4 ring-brand-600/20 shadow-md scale-110',
                    !isDone && !isCurrent && 'bg-surface-2 text-content-tertiary border border-border'
                  )}
                >
                  {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : idx + 1}
                </span>
                <span
                  className={cn(
                    'text-2xs font-medium text-center max-w-[80px] leading-tight hidden sm:block transition-colors',
                    isCurrent ? 'text-content-primary' : 'text-content-tertiary'
                  )}
                >
                  {step}
                </span>
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-[2px] mx-1 -mt-5 sm:-mt-6 transition-colors',
                    isDone ? 'bg-brand-600' : 'bg-border-subtle'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
