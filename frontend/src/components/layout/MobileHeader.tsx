import { Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { formatRoleLabel } from '@/lib/format-user';

type MobileHeaderProps = {
  onOpenSidebar: () => void;
};

export function MobileHeader({ onOpenSidebar }: MobileHeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-ink-muted transition hover:bg-canvas-raised hover:text-ink"
        aria-label="Open menu"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-[10px] font-bold text-white">
          POS
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">Stock POS</p>
          {user ? (
            <p className="truncate text-[11px] text-ink-muted">
              <span className="font-medium text-ink">{user.name}</span>
              <span className="mx-1 text-ink-faint">·</span>
              <span className="text-primary-600 dark:text-primary-400">{formatRoleLabel(user.role)}</span>
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
