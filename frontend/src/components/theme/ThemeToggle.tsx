import { Laptop, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme, type ThemeMode } from '@/theme/use-theme';

const ORDER: ThemeMode[] = ['light', 'dark', 'system'];

function nextTheme(current: ThemeMode): ThemeMode {
  const idx = ORDER.indexOf(current);
  return ORDER[(idx + 1) % ORDER.length] ?? 'system';
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const Icon = theme === 'system' ? Laptop : resolvedTheme === 'dark' ? Moon : Sun;
  const label = theme === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => setTheme(nextTheme(theme))}
      title={`Theme: ${label}. Click to switch.`}
      className={compact ? 'px-2' : undefined}
    >
      <Icon className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} aria-hidden />
      {!compact ? label : null}
    </Button>
  );
}
