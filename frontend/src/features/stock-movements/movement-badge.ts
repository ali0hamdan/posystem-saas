import type { BadgeProps } from '@/components/ui/badge';
import type { StockMovementType } from '@/types/stock-movement';

export function movementTypeBadgeVariant(type: StockMovementType): BadgeProps['variant'] {
  switch (type) {
    case 'SALE':
      return 'danger';
    case 'RETURN':
    case 'PURCHASE':
      return 'success';
    case 'DAMAGE':
    case 'EXPIRED':
      return 'warning';
    case 'ADJUSTMENT':
    default:
      return 'muted';
  }
}

export function formatMovementTypeLabel(t: string): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}
