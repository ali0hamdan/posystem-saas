import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchProducts } from '@/api/products.api';
import { getApiErrorMessage } from '@/api/client';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import { ProductLabelSheet } from '@/features/product-labels/ProductLabelSheet';
import {
  DEFAULT_SHEET_LAYOUT,
  LABEL_SIZE_PRESETS,
  type LabelSizePresetId,
} from '@/features/product-labels/label-presets';
import {
  expandLabelSlots,
  toLabelFields,
  type ProductLabelFields,
} from '@/features/product-labels/label-utils';
import { useStoreSettings } from '@/hooks/use-store-settings';
import type { Product } from '@/types/product';

export type ProductLabelsNavState = {
  initialRows?: { product: ProductLabelFields; quantity: number }[];
};

type Row = { product: ProductLabelFields; quantity: number };

function mergeInitialRows(prev: Row[], incoming: Row[]): Row[] {
  const map = new Map<string, Row>();
  for (const r of prev) {
    map.set(r.product.id, { ...r });
  }
  for (const r of incoming) {
    const cur = map.get(r.product.id);
    const q = Math.min(500, Math.max(1, Math.trunc(r.quantity) || 1));
    if (cur) {
      map.set(r.product.id, { product: cur.product, quantity: Math.min(500, cur.quantity + q) });
    } else {
      map.set(r.product.id, { product: r.product, quantity: q });
    }
  }
  return [...map.values()];
}

export function ProductLabelsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const appliedNav = useRef(false);
  const { settings, currency } = useStoreSettings();
  const storeName = settings?.storeName?.trim() ?? '';

  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 320);
  const [presetId, setPresetId] = useState<LabelSizePresetId>('SHELF_LABEL');
  const [customW, setCustomW] = useState(60);
  const [customH, setCustomH] = useState(30);
  const [showSku, setShowSku] = useState(true);
  const [showStoreName, setShowStoreName] = useState(false);
  const [sheetMarginMm, setSheetMarginMm] = useState<number>(DEFAULT_SHEET_LAYOUT.sheetMarginMm);
  const [labelGapMm, setLabelGapMm] = useState<number>(DEFAULT_SHEET_LAYOUT.labelGapMm);

  useEffect(() => {
    if (appliedNav.current) return;
    const st = location.state as ProductLabelsNavState | null;
    if (st?.initialRows?.length) {
      appliedNav.current = true;
      setRows((prev) => mergeInitialRows(prev, st.initialRows!));
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const searchQuery = useQuery({
    queryKey: ['products', 'label-search', debouncedSearch],
    queryFn: () => fetchProducts({ q: debouncedSearch.trim(), limit: 12, page: 1 }),
    enabled: debouncedSearch.trim().length >= 1,
  });

  const preset = useMemo(() => LABEL_SIZE_PRESETS.find((p) => p.id === presetId)!, [presetId]);
  const labelWidthMm = presetId === 'CUSTOM' ? customW : preset.widthMm;
  const labelHeightMm = presetId === 'CUSTOM' ? customH : preset.heightMm;
  const fontScale = preset.fontScale;

  const slots = useMemo(() => expandLabelSlots(rows), [rows]);

  const addProduct = useCallback((p: Product) => {
    const lf = toLabelFields(p);
    setRows((prev) => mergeInitialRows(prev, [{ product: lf, quantity: 1 }]));
    setSearch('');
    toast.success(`Added ${p.name}`);
  }, []);

  const updateQty = (id: string, quantity: number) => {
    const q = Math.min(500, Math.max(1, Math.trunc(quantity) || 1));
    setRows((prev) => prev.map((r) => (r.product.id === id ? { ...r, quantity: q } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.product.id !== id));
  };

  const handlePrint = useCallback(() => {
    if (!rows.length) {
      toast.error('Add at least one product.');
      return;
    }
    const cleanup = () => {
      document.documentElement.classList.remove('product-label-print-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    document.documentElement.classList.add('product-label-print-mode');
    window.addEventListener('afterprint', cleanup);
    requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 1200);
    });
  }, [rows.length]);

  const previewScale = 0.42;

  const inputCls =
    'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';
  const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted';

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-12">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Product labels</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Build a print sheet from your catalog. Barcodes use each product&apos;s barcode, or SKU if the barcode is
          empty. Configure layout, preview, then print on A4.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Add products</h2>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU, or barcode…"
                className="w-full rounded-lg border border-line bg-canvas py-2.5 pl-10 pr-3 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
              />
            </div>
            {debouncedSearch.trim().length >= 1 ? (
              <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line bg-canvas p-2">
                {searchQuery.isLoading ? (
                  <li className="px-2 py-2 text-sm text-ink-muted">Searching…</li>
                ) : searchQuery.isError ? (
                  <li className="px-2 py-2 text-sm text-danger-600">
                    {getApiErrorMessage(searchQuery.error, 'Search failed')}
                  </li>
                ) : !(searchQuery.data?.data ?? []).length ? (
                  <li className="px-2 py-2 text-sm text-ink-muted">No matches.</li>
                ) : (
                  (searchQuery.data?.data ?? []).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm text-ink hover:bg-surface"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-ink-faint">
                          {p.sku ? `SKU ${p.sku}` : '—'} · {p.barcode ? `BC ${p.barcode}` : 'no barcode'}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Label queue</h2>
            {!rows.length ? (
              <p className="mt-3 text-sm text-ink-muted">No products yet. Search and add items above.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {rows.map((r) => (
                  <li
                    key={r.product.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.product.name}</span>
                    <label className="flex items-center gap-1 text-xs text-ink-muted">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={500}
                        className="w-16 rounded-lg border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
                        value={r.quantity}
                        onChange={(e) => updateQty(r.product.id, Number(e.target.value))}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRow(r.product.id)}
                      className="rounded p-1.5 text-ink-faint hover:bg-surface hover:text-danger-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Layout</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="lbl-preset" className={labelCls}>
                  Label size
                </label>
                <select
                  id="lbl-preset"
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value as LabelSizePresetId)}
                  className={inputCls}
                >
                  {LABEL_SIZE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.description}
                    </option>
                  ))}
                </select>
              </div>
              {presetId === 'CUSTOM' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Width (mm)</label>
                    <input
                      type="number"
                      min={25}
                      max={200}
                      className={inputCls}
                      value={customW}
                      onChange={(e) => setCustomW(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Height (mm)</label>
                    <input
                      type="number"
                      min={15}
                      max={120}
                      className={inputCls}
                      value={customH}
                      onChange={(e) => setCustomH(Number(e.target.value))}
                    />
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Sheet margin (mm)</label>
                  <input
                    type="number"
                    min={4}
                    max={25}
                    className={inputCls}
                    value={sheetMarginMm}
                    onChange={(e) => setSheetMarginMm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Gap between labels (mm)</label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    className={inputCls}
                    value={labelGapMm}
                    onChange={(e) => setLabelGapMm(Number(e.target.value))}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="rounded border-line text-primary-500"
                  checked={showSku}
                  onChange={(e) => setShowSku(e.target.checked)}
                />
                Show SKU when set
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="rounded border-line text-primary-500"
                  checked={showStoreName}
                  onChange={(e) => setShowStoreName(e.target.checked)}
                />
                Show store name
              </label>
            </div>
          </section>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!rows.length}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Printer className="h-4 w-4" />
            Print sheet
          </button>
        </div>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Print preview</h2>
          <p className="mt-1 text-xs text-ink-faint">
            A4 sheet · {labelWidthMm}×{labelHeightMm} mm labels · {slots.length} label{slots.length === 1 ? '' : 's'}{' '}
            · preview scaled for screen
          </p>
          <div className="mt-4 max-h-[70vh] overflow-auto rounded-lg border border-line bg-canvas p-4">
            {!rows.length ? (
              <p className="text-sm text-ink-muted">Nothing to preview.</p>
            ) : (
              <div
                className="origin-top-left"
                style={{
                  transform: `scale(${previewScale})`,
                  width: `${100 / previewScale}%`,
                }}
              >
                <ProductLabelSheet
                  slots={slots}
                  currency={currency}
                  labelWidthMm={labelWidthMm}
                  labelHeightMm={labelHeightMm}
                  fontScale={fontScale}
                  showSku={showSku}
                  showStoreName={showStoreName}
                  storeName={storeName}
                  sheetMarginMm={sheetMarginMm}
                  labelGapMm={labelGapMm}
                />
              </div>
            )}
          </div>

          {/* Print-only version rendered as a portal directly into body — no ancestor
              transforms or overflow containers, so it prints at the correct 1:1 scale. */}
          {rows.length > 0 && createPortal(
            <div id="product-label-print-target">
              <ProductLabelSheet
                slots={slots}
                currency={currency}
                labelWidthMm={labelWidthMm}
                labelHeightMm={labelHeightMm}
                fontScale={fontScale}
                showSku={showSku}
                showStoreName={showStoreName}
                storeName={storeName}
                sheetMarginMm={sheetMarginMm}
                labelGapMm={labelGapMm}
              />
            </div>,
            document.body,
          )}
        </section>
      </div>
    </div>
  );
}
