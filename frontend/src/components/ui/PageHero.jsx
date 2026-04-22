// Hero header standardizzato per ogni pagina top-level.
// Title Large 28-32px, subtitle, area azioni primarie a destra, tab segmented opzionali in basso.
export default function PageHero({ title, subtitle, icon, primaryAction, segmented, className = '' }) {
  return (
    <header className={`border-b border-border-subtle bg-surface/70 backdrop-blur-sm ${className}`}>
      <div className="px-4 lg:px-6 py-5 lg:py-6 flex items-start gap-4 flex-wrap">
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-surface-2 text-content-primary flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl lg:text-[28px] font-bold tracking-tight leading-tight text-content-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-content-secondary">{subtitle}</p>
          )}
        </div>
        {primaryAction && (
          <div className="flex items-center gap-2 flex-shrink-0">{primaryAction}</div>
        )}
      </div>
      {segmented && (
        <div className="px-4 lg:px-6 pb-3">
          {segmented}
        </div>
      )}
    </header>
  );
}
