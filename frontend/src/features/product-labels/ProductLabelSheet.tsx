import { ProductLabelCell } from '@/features/product-labels/ProductLabelCell';
import { DEFAULT_SHEET_LAYOUT } from '@/features/product-labels/label-presets';
import type { ProductLabelFields } from '@/features/product-labels/label-utils';
import { gridColumnCount } from '@/features/product-labels/label-utils';

type ProductLabelSheetProps = {
  slots: ProductLabelFields[];
  currency: string;
  labelWidthMm: number;
  labelHeightMm: number;
  fontScale: number;
  showSku: boolean;
  showStoreName: boolean;
  storeName: string;
  sheetWidthMm?: number;
  sheetMarginMm?: number;
  labelGapMm?: number;
};

export function ProductLabelSheet({
  slots,
  currency,
  labelWidthMm,
  labelHeightMm,
  fontScale,
  showSku,
  showStoreName,
  storeName,
  sheetWidthMm = DEFAULT_SHEET_LAYOUT.sheetWidthMm,
  sheetMarginMm = DEFAULT_SHEET_LAYOUT.sheetMarginMm,
  labelGapMm = DEFAULT_SHEET_LAYOUT.labelGapMm,
}: ProductLabelSheetProps) {
  const cols = gridColumnCount(sheetWidthMm, sheetMarginMm, labelWidthMm, labelGapMm);

  return (
    <div
      className="product-label-sheet box-border bg-white text-black"
      style={{
        width: `${sheetWidthMm}mm`,
        maxWidth: `${sheetWidthMm}mm`,
        padding: `${sheetMarginMm}mm`,
        boxSizing: 'border-box',
      }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${labelWidthMm}mm)`,
          gap: `${labelGapMm}mm`,
        }}
      >
        {slots.map((p, idx) => (
          <ProductLabelCell
            key={`${p.id}-${idx}`}
            product={p}
            currency={currency}
            widthMm={labelWidthMm}
            heightMm={labelHeightMm}
            fontScale={fontScale}
            showSku={showSku}
            showStoreName={showStoreName}
            storeName={storeName}
          />
        ))}
      </div>
    </div>
  );
}
