import { useEffect, useRef } from 'react';
import { formatMoney } from '@/lib/format-money';
import { cn } from '@/lib/utils';
import type { ProductLabelFields } from '@/features/product-labels/label-utils';
import { resolveLabelBarcodeValue } from '@/features/product-labels/label-utils';

type ProductLabelCellProps = {
  product: ProductLabelFields;
  currency: string;
  widthMm: number;
  heightMm: number;
  fontScale: number;
  showSku: boolean;
  showStoreName: boolean;
  storeName: string;
};

export function ProductLabelCell({
  product,
  currency,
  widthMm,
  heightMm,
  fontScale,
  showSku,
  showStoreName,
  storeName,
}: ProductLabelCellProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const encodeValue = resolveLabelBarcodeValue(product);
  const price = formatMoney(product.sellingPrice, currency);
  const base = 10 * fontScale;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !encodeValue) return;
    let cancelled = false;
    void import('jsbarcode').then((JB) => {
      if (cancelled) return;
      const draw = JB.default ?? JB;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      try {
        draw(svg, encodeValue, {
          format: 'CODE128',
          displayValue: true,
          fontSize: Math.max(7, 8 * fontScale),
          height: Math.max(18, 22 * fontScale),
          width: Math.max(0.8, 1 * fontScale),
          margin: 0,
        });
      } catch {
        /* invalid charset for CODE128 — leave svg empty */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [encodeValue, fontScale]);

  return (
    <div
      className={cn(
        'product-label-cell box-border flex flex-col justify-between overflow-hidden border border-neutral-900 bg-white p-[1.5mm] text-black',
      )}
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        fontSize: `${base}px`,
        lineHeight: 1.15,
      }}
    >
      <div className="min-h-0 flex-1">
        <p className="line-clamp-3 font-semibold leading-tight" style={{ fontSize: `${base * 1.05}px` }}>
          {product.name}
        </p>
        {showStoreName && storeName.trim() ? (
          <p className="mt-0.5 truncate text-neutral-600" style={{ fontSize: `${base * 0.78}px` }}>
            {storeName.trim()}
          </p>
        ) : null}
        {showSku && product.sku?.trim() ? (
          <p className="mt-0.5 truncate font-mono text-neutral-700" style={{ fontSize: `${base * 0.82}px` }}>
            SKU {product.sku.trim()}
          </p>
        ) : null}
        <p className="mt-1 font-semibold tabular-nums" style={{ fontSize: `${base * 1.15}px` }}>
          {price}
        </p>
      </div>
      <div className="mt-1 shrink-0">
        <svg ref={svgRef} className="max-h-[14mm] w-full" aria-hidden />
      </div>
    </div>
  );
}
