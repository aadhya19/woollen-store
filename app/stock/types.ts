export type StockRow = {
  id: string;
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
