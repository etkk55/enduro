import { cn } from './utils';

export function Card({ className, children, interactive, ...props }) {
  return (
    <div
      className={cn(
        'bg-surface border border-border-subtle rounded-lg',
        interactive && 'transition-shadow hover:shadow-md cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('px-5 py-4 border-b border-border-subtle', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 className={cn('text-heading-2 text-content-primary', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-caption mt-1', className)} {...props}>
      {children}
    </p>
  );
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div className={cn('px-5 py-3 border-t border-border-subtle bg-surface-2 rounded-b-lg', className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
