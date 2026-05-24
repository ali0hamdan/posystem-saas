import { NavLink } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { visibleSaasNavSections } from '@/saas/config/saas-navigation';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';

export function SaasSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const role = useSaasAuthStore((s) => s.admin?.role);
  const sections = visibleSaasNavSections(role);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-line bg-canvas-raised text-ink transition-[width]',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-line px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Shield className="h-5 w-5" aria-hidden />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">Stock POS</p>
            <p className="truncate text-[11px] text-ink-muted">Platform Admin</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.id} className="mb-6">
            {!collapsed ? (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-primary-600/20 text-primary-100 ring-1 ring-inset ring-primary-400/40'
                          : 'text-ink-muted hover:bg-surface hover:text-ink',
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface hover:text-ink"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition', collapsed && 'rotate-180')} />
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}

