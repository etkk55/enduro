import { NavLink as RouterNavLink } from 'react-router-dom';
import { cn } from './ui/utils';

function SidebarLink({ to, icon: Icon, label, collapsed }) {
  return (
    <RouterNavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md text-sm font-medium',
          'transition-colors duration-150',
          collapsed ? 'h-10 w-10 justify-center' : 'h-9 px-3',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-100 dark:text-brand-500'
            : 'text-content-secondary hover:bg-surface-2 hover:text-content-primary'
        )
      }
      title={collapsed ? label : undefined}
    >
      {Icon && <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />}
      {!collapsed && <span className="truncate">{label}</span>}
    </RouterNavLink>
  );
}

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="h-px bg-border-subtle my-2 mx-2" />;
  return (
    <div className="text-overline px-3 pt-5 pb-2">{children}</div>
  );
}

export default function Sidebar({ groups, collapsed, onToggle, footer }) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 z-30',
        'flex flex-col bg-surface border-r border-border-subtle',
        'transition-[width] duration-200 ease-out-expo',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo area */}
      <div className={cn('h-14 flex items-center border-b border-border-subtle', collapsed ? 'justify-center px-0' : 'px-4')}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold text-content-primary">Enduro FMI</div>
              <div className="text-2xs text-content-tertiary">Timing System</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && <SectionLabel collapsed={collapsed}>{group.label}</SectionLabel>}
            {group.items.map((item) => (
              <SidebarLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {footer && (
        <div className={cn('border-t border-border-subtle p-2', collapsed && 'flex flex-col items-center')}>
          {footer(collapsed)}
        </div>
      )}
    </aside>
  );
}
