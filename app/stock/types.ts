/** Barcodes are auto-assigned from this value upward on new stock rows. */
export const STOCK_BARCODE_MIN = 15000;

export type StockRow = {
  id: string;
  /** Monotonic stock barcode; assigned from 15000 upward on create. */
  barcode: number | null;
  stock_number: string | null;
  inventory_number: string | null;
  brand_name: string | null;
  product: string | null;
  /** FK to Style.id */
  style: string | null;
  /** FK to Fabric.id (quoted column `"Fabric"` in Postgres) */
  Fabric: string | null;
  HSN_code: string | null;
  GST_group: string | null;
  cost_price: number | null;
  selling_price: number | null;
  mrp: number | null;
  pieces: number | null;
  size: string | null;
  created_at: string;
  updated_at: string | null;
};

/** Normalize `barcode` / `Barcode` from PostgREST into a safe integer or null. */
export function coerceStockBarcode(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && Number.isSafeInteger(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    if (!/^-?\d+$/.test(t)) return null;
    const n = Number(t);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

/** Attach coerced `barcode` to each API row (handles alternate JSON keys). */
export function normalizeStockRowsFromApi(rows: unknown[]): StockRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const barcode = coerceStockBarcode(r.barcode ?? r.Barcode);
    return { ...r, barcode } as StockRow;
  });
}

export type ProductOption = {
  id: string;
  product_name: string | null;
};

export type BrandOption = {
  id: string;
  brand_name: string | null;
};

export type StyleOption = {
  id: string;
  style_name: string | null;
};

export type FabricOption = {
  id: string;
  fabric_name: string | null;
};

export type SizeOption = {
  id: string;
  size: string | null;
};

/** Inventory row fields shown read-only when adding stock after picking an inventory number. */
export type InventoryStockContext = {
  inventory_number: string;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
  company_name: string | null;
  agent_name: string | null;
};
