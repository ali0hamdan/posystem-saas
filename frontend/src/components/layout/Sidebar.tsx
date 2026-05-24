import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { Loader2, LogOut, PanelLeftClose, PanelLeft } from 'lucide-react';
import { visibleNavSections } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { formatRoleLabel } from '@/lib/format-user';
import { useAuthStore } from '@/stores/auth-store';
import { logout as logoutApi } from '@/api/auth.api';

const STORAGE_KEY = 'pos-sidebar-collapsed';

type SidebarProps = {
  onNavigate?: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function Sidebar({ onNavigate, collapsed, onCollapsedChange }: SidebarProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logoutApi();
    } catch {
      /* still clear */
    } finally {
      queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      clearAuth();
      onNavigate?.();
      setIsLoggingOut(false);
    }
  }

  const sections = visibleNavSections(user?.role);
  const widthClass = collapsed ? 'w-[68px]' : 'w-60';

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar-bg transition-[width] duration-200 ease-out',
        widthClass,
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-sidebar-border py-4',
          collapsed ? 'flex-col px-2 py-4' : 'px-4',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white shadow-sm">
          POS
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="font-display text-[13px] font-semibold tracking-tight text-ink">Stock POS</p>
            <p className="text-[11px] text-ink-faint">Store operations</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition hover:bg-canvas hover:text-ink-muted',
            collapsed ? 'mt-1' : 'ml-auto hidden lg:flex',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-none">
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.id}>
              {!collapsed ? (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                  {section.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-line" aria-hidden />
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-100',
                          collapsed && 'justify-center px-2',
                          isActive
                            ? 'bg-primary-600/10 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400'
                            : 'text-ink-muted hover:bg-canvas hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && !collapsed && (
                            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-600 dark:bg-primary-400" />
                          )}
                          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                          {!collapsed ? <span>{item.label}</span> : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className={cn('border-t border-sidebar-border p-2', collapsed && 'px-2')}>
        {!collapsed ? (
          <div className="mb-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
              {(user?.name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-ink">{user?.name ?? '—'}</p>
              <p className="truncate text-[11px] text-ink-faint">
                {formatRoleLabel(user?.role)}
              </p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-muted transition hover:bg-canvas hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-50',
            collapsed && 'justify-center px-2',
          )}
          aria-busy={isLoggingOut}
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden />
          )}
          {!collapsed ? <span>{isLoggingOut ? 'Signing out…' : 'Sign out'}</span> : null}
        </button>
      </div>
    </aside>
  );
}

export function readInitialSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
