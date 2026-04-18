import { cn } from './utils';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-content-tertiary" />
        </div>
      )}
      <h3 className="text-heading-2 text-content-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-content-secondary max-w-md mb-5">{description}</p>
      )}
      {action}
    </div>
  );
}
