import { useEffect, useRef, useState } from 'react';
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Barcode, RefreshCw, ScanLine, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/api/client';
import { fetchStoreSettings } from '@/api/settings.api';
import {
  createProduct,
  updateProduct,
  generateSku,
  generateBarcode,
  checkBarcode,
  type CreateProductBody,
  type UpdateProductBody,
} from '@/api/products.api';
import type { Product } from '@/types/product';

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t && t.length > 0 ? t : undefined;
  });

function numAtLeast(min: number) {
  return z
    .union([z.string(), z.number()])
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return min;
      const n = typeof val === 'number' ? val : Number(val);
      return Number.isFinite(n) ? n : min;
    })
    .pipe(z.number().min(min));
}

function optionalIntMin(min: number) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const n = typeof val === 'number' ? val : Number(val);
      if (!Number.isFinite(n)) return undefined;
      return Math.trunc(n);
    })
    .pipe(z.number().int().min(min).optional());
}

const baseFields = {
  name: z.string().min(1, 'Name is required').max(255),
  categoryId: z.string().refine((s) => z.string().uuid().safeParse(s).success, { message: 'Pick a category' }),
  barcode: optionalTrimmed.pipe(z.string().max(100).optional()),
  sku: optionalTrimmed.pipe(z.string().max(100).optional()),
  supplierId: z
    .string()
    .optional()
    .refine((s) => !s || s.trim() === '' || z.string().uuid().safeParse(s).success, {
      message: 'Invalid supplier',
    }),
  costPrice: numAtLeast(0),
  sellingPrice: numAtLeast(0),
  minStock: optionalIntMin(0),
  unitType: z.string().max(32).optional(),
  imageUrl: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t && t.length > 0 ? t : undefined;
    }),
};

const createSchema = z.object({
  ...baseFields,
  quantity: optionalIntMin(0),
  isActive: z.boolean().optional(),
});

const editSchema = z.object({
  ...baseFields,
  isActive: z.boolean(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

const defaultCreate: CreateForm = {
  name: '',
  categoryId: '',
  supplierId: '',
  barcode: undefined,
  sku: undefined,
  costPrice: 0,
  sellingPrice: 0,
  quantity: 0,
  minStock: 5,
  unitType: 'PIECE',
  imageUrl: undefined,
  isActive: true,
};

function toCreateBody(values: CreateForm, minStockDefault: number): CreateProductBody {
  return {
    name: values.name.trim(),
    categoryId: values.categoryId,
    barcode: values.barcode,
    sku: values.sku,
    supplierId: values.supplierId && values.supplierId.length > 0 ? values.supplierId : undefined,
    costPrice: values.costPrice,
    sellingPrice: values.sellingPrice,
    quantity: values.quantity ?? 0,
    minStock: values.minStock ?? minStockDefault,
    unitType: values.unitType?.trim() || 'PIECE',
    imageUrl: values.imageUrl,
    isActive: values.isActive ?? true,
  };
}

function productToEditDefaults(p: Product): EditForm {
  return {
    name: p.name,
    categoryId: p.categoryId,
    barcode: p.barcode ?? undefined,
    sku: p.sku ?? undefined,
    supplierId: p.supplierId ?? '',
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    minStock: p.minStock,
    unitType: p.unitType || 'PIECE',
    imageUrl: p.imageUrl ?? undefined,
    isActive: p.isActive,
  };
}

type ProductFormModalProps = {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  product: Product | null;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  /** After a successful create, called before the modal closes. */
  onCreateSuccess?: (product: Product, options: { printLabels: boolean }) => void;
};

export function ProductFormModal({
  mode,
  open,
  onClose,
  product,
  categories,
  suppliers,
  onCreateSuccess,
}: ProductFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';
  const [printLabelsAfterCreate, setPrintLabelsAfterCreate] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['store-settings'],
    queryFn: fetchStoreSettings,
    staleTime: 60_000,
  });
  const minStockDefault = settingsQuery.data?.lowStockDefault ?? 5;

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema) as Resolver<CreateForm>,
    defaultValues: defaultCreate,
  });

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema) as Resolver<EditForm>,
    defaultValues: {
      name: '',
      categoryId: '',
      supplierId: '',
      barcode: undefined,
      sku: undefined,
      costPrice: 0,
      sellingPrice: 0,
      minStock: 0,
      unitType: 'PIECE',
      imageUrl: undefined,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) {
      setPrintLabelsAfterCreate(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (isEdit && product) {
      editForm.reset(productToEditDefaults(product));
    }
    if (!isEdit) {
      createForm.reset({
        ...defaultCreate,
        minStock: minStockDefault,
      });
    }
  }, [open, isEdit, product, createForm, editForm, minStockDefault]);

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (created) => {
      toast.success('Product created');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onCreateSuccess?.(created, { printLabels: printLabelsAfterCreate });
      setPrintLabelsAfterCreate(false);
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not create product'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductBody }) => updateProduct(id, body),
    onSuccess: () => {
      toast.success('Product updated');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not update product'));
    },
  });

  const busy = createMutation.isPending || updateMutation.isPending;

  function handleCreateSubmit(values: CreateForm) {
    createMutation.mutate(toCreateBody(values, minStockDefault));
  }

  function handleEditSubmit(values: EditForm) {
    if (!product) return;
    const body: UpdateProductBody = {
      name: values.name.trim(),
      categoryId: values.categoryId,
      barcode: values.barcode,
      sku: values.sku,
      supplierId: values.supplierId && values.supplierId.length > 0 ? values.supplierId : undefined,
      costPrice: values.costPrice,
      sellingPrice: values.sellingPrice,
      minStock: values.minStock,
      unitType: values.unitType?.trim() || 'PIECE',
      imageUrl: values.imageUrl,
      isActive: values.isActive,
    };
    updateMutation.mutate({ id: product.id, body });
  }

  const title = isEdit ? 'Edit product' : 'Create product';
  const description = isEdit
    ? 'Stock quantity is adjusted via stock movements, not here.'
    : 'Add a catalog item with pricing and optional starting stock.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (isEdit && !product)}
            onClick={() => void (isEdit ? editForm.handleSubmit(handleEditSubmit)() : createForm.handleSubmit(handleCreateSubmit)())}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
        </div>
      }
    >
      {isEdit && !product ? (
        <p className="text-sm text-ink-muted">No product selected.</p>
      ) : isEdit ? (
        <EditFields form={editForm} categories={categories} suppliers={suppliers} productId={product?.id} />
      ) : (
        <CreateFields
          form={createForm}
          categories={categories}
          suppliers={suppliers}
          printLabelsAfterCreate={printLabelsAfterCreate}
          onPrintLabelsAfterCreateChange={setPrintLabelsAfterCreate}
        />
      )}
    </Modal>
  );
}

const fieldBase =
  'w-full rounded-lg border bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-500/25';
const fieldNormal = `${fieldBase} border-line focus:border-primary-400`;
const fieldError = `${fieldBase} border-danger-400 focus:border-danger-400`;
const fieldReadOnly = `${fieldBase} border-line cursor-not-allowed bg-surface text-ink-muted`;
const labelCls = 'mb-1.5 block text-sm font-medium text-ink';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger-600">{message}</p>;
}

// ---------------------------------------------------------------------------
// SKU field: read-only display + Generate/Regenerate button
// ---------------------------------------------------------------------------
function SkuField({
  value,
  onChange,
  categoryId,
  productName,
  excludeId,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  categoryId: string;
  productName: string;
  excludeId?: string;
}) {
  const [generating, setGenerating] = useState(false);
  const hasCategory = Boolean(categoryId);
  const hasName = Boolean(productName.trim());
  const canGenerate = hasCategory && hasName;
  const hasValue = Boolean(value);
  const isEditMode = Boolean(excludeId);

  function getDisabledHint(): string | undefined {
    if (!hasCategory && !hasName) return 'Select a category and enter a product name first';
    if (!hasCategory) return 'Select category before generating SKU.';
    if (!hasName) return 'Enter product name before generating SKU.';
    return undefined;
  }

  async function handleGenerate() {
    if (!hasCategory) {
      toast.error('Select category before generating SKU.');
      return;
    }
    if (!hasName) {
      toast.error('Enter product name before generating SKU.');
      return;
    }
    setGenerating(true);
    try {
      const result = await generateSku({ categoryId, productName, excludeId });
      onChange(result.sku);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not generate SKU'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <label className={labelCls}>SKU</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={value ?? ''}
          className={`${fieldReadOnly} flex-1`}
          placeholder="Generate from category + name"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          title={getDisabledHint()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : hasValue ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {generating ? '…' : hasValue ? 'Regenerate SKU' : 'Generate SKU'}
        </button>
      </div>
      {!hasValue && (
        <p className="mt-1 text-xs text-ink-faint">SKU will be generated from category and product name.</p>
      )}
      {hasValue && isEditMode && (
        <p className="mt-1 text-xs text-warning-600">Changing SKU may affect reports and product labels.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barcode field: read-only display + Generate + Scan buttons
// ---------------------------------------------------------------------------
function BarcodeField({
  value,
  onChange,
  excludeId,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  excludeId?: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [conflictName, setConflictName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scanMode) {
      setScanInput('');
      setScanError(null);
      setConflictName(null);
      requestAnimationFrame(() => scanRef.current?.focus());
    }
  }, [scanMode]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateBarcode();
      onChange(result.barcode);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not generate barcode'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = scanInput.trim();
    if (!trimmed) return;
    setChecking(true);
    setScanError(null);
    setConflictName(null);
    try {
      const result = await checkBarcode({ barcode: trimmed, excludeId });
      if (result.available) {
        onChange(trimmed);
        setScanMode(false);
        setScanInput('');
      } else {
        setScanError('A product with this barcode already exists.');
        setConflictName(result.conflictProductName ?? null);
      }
    } catch (err) {
      setScanError(getApiErrorMessage(err, 'Could not verify barcode'));
    } finally {
      setChecking(false);
    }
  }

  function handleCancelScan() {
    setScanMode(false);
    setScanInput('');
    setScanError(null);
    setConflictName(null);
  }

  return (
    <div>
      <label className={labelCls}>Barcode</label>
      {!scanMode ? (
        <div className="flex gap-2">
          <input
            readOnly
            value={value ?? ''}
            className={`${fieldReadOnly} flex-1`}
            placeholder="Use buttons to set barcode"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            title="Generate internal numeric barcode"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
          >
            {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Barcode className="h-3 w-3" />}
            {generating ? '…' : 'Generate Barcode'}
          </button>
          <button
            type="button"
            onClick={() => setScanMode(true)}
            title="Scan a physical barcode"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-muted hover:bg-canvas hover:text-ink"
          >
            <ScanLine className="h-3 w-3" />
            Scan Barcode
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              ref={scanRef}
              value={scanInput}
              onChange={(e) => {
                setScanInput(e.target.value);
                setScanError(null);
                setConflictName(null);
              }}
              onKeyDown={handleScanKeyDown}
              disabled={checking}
              className={cn(scanError ? fieldError : fieldNormal, 'flex-1')}
              placeholder="Scanner mode active. Scan the barcode now."
            />
            <button
              type="button"
              onClick={handleCancelScan}
              disabled={checking}
              className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-muted hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
          {scanError ? (
            <div>
              <p className="text-xs text-danger-600">{scanError}</p>
              {conflictName && (
                <p className="text-xs text-ink-muted">
                  Existing product: <span className="font-medium text-ink">{conflictName}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-primary-600 font-medium">
              {checking ? 'Checking barcode…' : 'Scanner mode active. Scan the barcode now.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create fields
// ---------------------------------------------------------------------------
function CreateFields({
  form,
  categories,
  suppliers,
  printLabelsAfterCreate,
  onPrintLabelsAfterCreateChange,
}: {
  form: UseFormReturn<CreateForm>;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  printLabelsAfterCreate: boolean;
  onPrintLabelsAfterCreateChange: (v: boolean) => void;
}) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const categoryId = watch('categoryId') ?? '';
  const productName = watch('name') ?? '';
  const barcode = watch('barcode');
  const sku = watch('sku');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls}>Name</label>
        <input
          {...register('name')}
          className={cn(errors.name ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <select
          {...register('categoryId')}
          className={cn(errors.categoryId ? fieldError : fieldNormal)}
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError message={errors.categoryId?.message} />
      </div>
      <div>
        <label className={labelCls}>Supplier (optional)</label>
        <select {...register('supplierId')} className={fieldNormal}>
          <option value="">None</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <BarcodeField
          value={barcode}
          onChange={(v) => setValue('barcode', v, { shouldValidate: true })}
        />
        <FieldError message={errors.barcode?.message} />
      </div>
      <div>
        <SkuField
          value={sku}
          onChange={(v) => setValue('sku', v, { shouldValidate: true })}
          categoryId={categoryId}
          productName={productName}
        />
        <FieldError message={errors.sku?.message} />
      </div>
      <div>
        <label className={labelCls}>Cost price</label>
        <input
          type="number"
          step="0.01"
          min={0}
          {...register('costPrice')}
          className={cn(errors.costPrice ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.costPrice?.message} />
      </div>
      <div>
        <label className={labelCls}>Selling price</label>
        <input
          type="number"
          step="0.01"
          min={0}
          {...register('sellingPrice')}
          className={cn(errors.sellingPrice ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.sellingPrice?.message} />
      </div>
      <div>
        <label className={labelCls}>Min stock</label>
        <input
          type="number"
          min={0}
          step={1}
          {...register('minStock')}
          className={fieldNormal}
        />
        <FieldError message={errors.minStock?.message} />
      </div>
      <div>
        <label className={labelCls}>Starting quantity</label>
        <input
          type="number"
          min={0}
          step={1}
          {...register('quantity')}
          className={fieldNormal}
        />
        <FieldError message={errors.quantity?.message} />
      </div>
      <div>
        <label className={labelCls}>Unit type</label>
        <input {...register('unitType')} className={fieldNormal} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Image URL (optional)</label>
        <input
          {...register('imageUrl')}
          className={cn(errors.imageUrl ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.imageUrl?.message} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
        <input
          id="create-print-labels"
          type="checkbox"
          checked={printLabelsAfterCreate}
          onChange={(e) => onPrintLabelsAfterCreateChange(e.target.checked)}
          className="h-4 w-4 rounded border-line text-primary-500"
        />
        <label htmlFor="create-print-labels" className="text-sm text-ink">
          Open product labels after create (for printing)
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit fields
// ---------------------------------------------------------------------------
function EditFields({
  form,
  categories,
  suppliers,
  productId,
}: {
  form: UseFormReturn<EditForm>;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  productId?: string;
}) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const categoryId = watch('categoryId') ?? '';
  const productName = watch('name') ?? '';
  const barcode = watch('barcode');
  const sku = watch('sku');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
        <input id="edit-active" type="checkbox" {...register('isActive')} className="h-4 w-4 rounded border-line text-primary-500" />
        <label htmlFor="edit-active" className="text-sm text-ink">
          Product is active (visible to cashiers when on)
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Name</label>
        <input
          {...register('name')}
          className={cn(errors.name ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <select
          {...register('categoryId')}
          className={cn(errors.categoryId ? fieldError : fieldNormal)}
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError message={errors.categoryId?.message} />
      </div>
      <div>
        <label className={labelCls}>Supplier (optional)</label>
        <select {...register('supplierId')} className={fieldNormal}>
          <option value="">None</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <BarcodeField
          value={barcode}
          onChange={(v) => setValue('barcode', v, { shouldValidate: true })}
          excludeId={productId}
        />
        <FieldError message={errors.barcode?.message} />
      </div>
      <div>
        <SkuField
          value={sku}
          onChange={(v) => setValue('sku', v, { shouldValidate: true })}
          categoryId={categoryId}
          productName={productName}
          excludeId={productId}
        />
        <FieldError message={errors.sku?.message} />
      </div>
      <div>
        <label className={labelCls}>Cost price</label>
        <input
          type="number"
          step="0.01"
          min={0}
          {...register('costPrice')}
          className={cn(errors.costPrice ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.costPrice?.message} />
      </div>
      <div>
        <label className={labelCls}>Selling price</label>
        <input
          type="number"
          step="0.01"
          min={0}
          {...register('sellingPrice')}
          className={cn(errors.sellingPrice ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.sellingPrice?.message} />
      </div>
      <div>
        <label className={labelCls}>Min stock</label>
        <input
          type="number"
          min={0}
          step={1}
          {...register('minStock')}
          className={fieldNormal}
        />
        <FieldError message={errors.minStock?.message} />
      </div>
      <div>
        <label className={labelCls}>Unit type</label>
        <input {...register('unitType')} className={fieldNormal} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Image URL (optional)</label>
        <input
          {...register('imageUrl')}
          className={cn(errors.imageUrl ? fieldError : fieldNormal)}
        />
        <FieldError message={errors.imageUrl?.message} />
      </div>
    </div>
  );
}
