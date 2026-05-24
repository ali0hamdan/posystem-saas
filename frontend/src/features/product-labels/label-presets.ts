export type LabelSizePresetId = 'SMALL_STICKER' | 'SHELF_LABEL' | 'CUSTOM';

export type LabelSizePreset = {
  id: LabelSizePresetId;
  label: string;
  description: string;
  /** Label cell width in millimetres */
  widthMm: number;
  /** Label cell height in millimetres */
  heightMm: number;
  /** Multiplier for base font sizes inside the cell */
  fontScale: number;
};

export const LABEL_SIZE_PRESETS: readonly LabelSizePreset[] = [
  {
    id: 'SMALL_STICKER',
    label: 'Small sticker',
    description: 'Compact price gun style (~48×25 mm)',
    widthMm: 48,
    heightMm: 25,
    fontScale: 0.92,
  },
  {
    id: 'SHELF_LABEL',
    label: 'Shelf label',
    description: 'Wider shelf strip (~100×32 mm)',
    widthMm: 100,
    heightMm: 32,
    fontScale: 1,
  },
  {
    id: 'CUSTOM',
    label: 'Custom size',
    description: 'Set width and height in millimetres',
    widthMm: 60,
    heightMm: 30,
    fontScale: 1,
  },
] as const;

export const DEFAULT_SHEET_LAYOUT = {
  /** ISO A4 width */
  sheetWidthMm: 210,
  sheetMarginMm: 10,
  labelGapMm: 3,
} as const;
