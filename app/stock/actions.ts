"use server";

import { revalidatePath } from "next/cache";
import { createSupabase } from "@/lib/supabase";
import { getAuthSession, requireActionRole } from "@/lib/auth";
import { STOCK_BARCODE_MIN } from "./types";

export type ActionResult = { error: string | null };

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = value?.toString().trim();
  return s ? s : null;
}

function parseOptionalFloat(
  value: FormDataEntryValue | null,
): { n: number | null; error: string | null } {
  const s = value?.toString().trim();
  if (!s) return { n: null, error: null };
  const n = Number(s);
  if (Number.isNaN(n)) return { n: null, error: "Invalid number value" };
  return { n, error: null };
}

function parseOptionalInt(
  value: FormDataEntryValue | null,
): { n: number | null; error: string | null } {
  const s = value?.toString().trim();
  if (!s) return { n: null, error: null };
  if (!/^-?\d+$/.test(s)) return { n: null, error: "Pieces must be a whole number" };
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return { n: null, error: "Pieces is out of range" };
  return { n, error: null };
}

const STOCK_BARCODE_FLOOR = STOCK_BARCODE_MIN - 1;

function mapSupabaseError(message: string) {
  if (message.includes("row-level security")) {
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Stock.`;
  }
  const m = message.toLowerCase();
  if (m.includes("stock_inventory_number_fkey")) {
    return `${message} inventory_number must reference an existing row in Inventory.`;
  }
  if (m.includes("stock_brand_name_fkey")) {
    return `${message} brand_name must reference an existing row in Brand.`;
  }
  if (m.includes("stock_product_fkey")) {
    return `${message} product must reference an existing row in Products.`;
  }
  if (m.includes("stock_style_fkey")) {
    return `${message} style must reference an existing row in Style.`;
  }
  if (m.includes("stock_fabric_fkey")) {
    return `${message} Fabric must reference an existing row in Fabric.`;
  }
  if (m.includes("stock_size_fkey")) {
    return `${message} size must reference an existing row in Sizes.`;
  }
  if (
    (m.includes("duplicate key") || m.includes("unique constraint")) &&
    m.includes("stock")
  ) {
    return `${message} Stock has a unique constraint — adjust fields so the row is unique.`;
  }
  return message;
}

type StockRefs = {
  brand_name: string | null;
  product: string | null;
  style: string | null;
  Fabric: string | null;
};

function emptyRefs(): StockRefs {
  return { brand_name: null, product: null, style: null, Fabric: null };
}

function parseStockRefsFromForm(formData: FormData): {
  refs: StockRefs;
  error: string | null;
} {
  const locked = formData.get("stock_product_locked")?.toString() === "1";
  const brand_name = emptyToNull(formData.get("brand_name"));
  const product = locked
    ? emptyToNull(formData.get("product_id"))
    : emptyToNull(formData.get("product"));
  const style = emptyToNull(formData.get("style"));
  const Fabric = emptyToNull(formData.get("Fabric"));

  if (!brand_name) {
    return { refs: emptyRefs(), error: "Select a brand." };
  }
  if (!product) {
    return { refs: { brand_name, product: null, style: null, Fabric: null }, error: "Select a product." };
  }

  return {
    refs: { brand_name, product, style, Fabric },
    error: null,
  };
}

export async function createStock(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin", "user"]);
  if (authError) return { error: authError };

  const stock_number = emptyToNull(formData.get("stock_number"));
  const inventory_number = emptyToNull(formData.get("inventory_number"));
  const HSN_code = emptyToNull(formData.get("HSN_code"));
  const GST_group = emptyToNull(formData.get("GST_group"));
  const size = emptyToNull(formData.get("size"));

  const { n: cost_price, error: costErr } = parseOptionalFloat(
    formData.get("cost_price"),
  );
  if (costErr) return { error: costErr };

  const { n: selling_price, error: sellErr } = parseOptionalFloat(
    formData.get("selling_price"),
  );
  if (sellErr) return { error: sellErr };

  const { n: mrp, error: mrpErr } = parseOptionalFloat(formData.get("mrp"));
  if (mrpErr) return { error: mrpErr };
  const { n: pieces, error: piecesErr } = parseOptionalInt(formData.get("pieces"));
  if (piecesErr) return { error: piecesErr };

  const { refs, error: refErr } = parseStockRefsFromForm(formData);
  if (refErr) return { error: refErr };

  const supabase = createSupabase();

  const { data: maxBarcodeRow, error: maxBarcodeErr } = await supabase
    .from("Stock")
    .select("barcode")
    .not("barcode", "is", null)
    .order("barcode", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxBarcodeErr) return { error: mapSupabaseError(maxBarcodeErr.message) };

  const maxExisting =
    typeof maxBarcodeRow?.barcode === "number" && Number.isFinite(maxBarcodeRow.barcode)
      ? maxBarcodeRow.barcode
      : null;
  const barcode = Math.max(maxExisting ?? 0, STOCK_BARCODE_FLOOR) + 1;

  const { error } = await supabase.from("Stock").insert({
    barcode,
    stock_number,
    inventory_number,
    brand_name: refs.brand_name,
    product: refs.product,
    style: refs.style,
    Fabric: refs.Fabric,
    HSN_code,
    GST_group,
    cost_price,
    selling_price,
    mrp,
    pieces,
    size,
  });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/stock");
  return { error: null };
}

export async function duplicateStock(id: string): Promise<ActionResult> {
  const authError = await requireActionRole(["admin", "user"]);
  if (authError) return { error: authError };

  if (!id.trim()) return { error: "Missing stock id" };

  const supabase = createSupabase();

  const { data: src, error: fetchErr } = await supabase
    .from("Stock")
    .select(
      "stock_number, inventory_number, brand_name, product, style, Fabric, HSN_code, GST_group, cost_price, selling_price, mrp, pieces, size",
    )
    .eq("id", id.trim())
    .maybeSingle();

  if (fetchErr) return { error: mapSupabaseError(fetchErr.message) };
  if (!src) return { error: "Stock row not found" };

  const { data: maxBarcodeRow, error: maxBarcodeErr } = await supabase
    .from("Stock")
    .select("barcode")
    .not("barcode", "is", null)
    .order("barcode", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxBarcodeErr) return { error: mapSupabaseError(maxBarcodeErr.message) };

  const maxExisting =
    typeof maxBarcodeRow?.barcode === "number" && Number.isFinite(maxBarcodeRow.barcode)
      ? maxBarcodeRow.barcode
      : null;
  const barcode = Math.max(maxExisting ?? 0, STOCK_BARCODE_FLOOR) + 1;

  const row = src as Record<string, unknown>;
  const { error } = await supabase.from("Stock").insert({
    barcode,
    stock_number: row.stock_number ?? null,
    inventory_number: row.inventory_number ?? null,
    brand_name: row.brand_name ?? null,
    product: row.product ?? null,
    style: row.style ?? null,
    Fabric: row.Fabric ?? null,
    HSN_code: row.HSN_code ?? null,
    GST_group: row.GST_group ?? null,
    cost_price: row.cost_price ?? null,
    selling_price: row.selling_price ?? null,
    mrp: row.mrp ?? null,
    pieces: row.pieces ?? null,
    size: row.size ?? null,
  });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/stock");
  return { error: null };
}

type StockParsed = StockRefs & {
  stock_number: string | null;
  inventory_number: string | null;
  HSN_code: string | null;
  GST_group: string | null;
  size: string | null;
  cost_price: number | null;
  selling_price: number | null;
  mrp: number | null;
  pieces: number | null;
};

export async function updateStock(formData: FormData): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Not authenticated. Please log in." };
  if (session.role !== "admin" && session.role !== "user") {
    return { error: "You do not have permission to perform this action." };
  }

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing stock id" };

  const stock_number = emptyToNull(formData.get("stock_number"));
  const inventory_number = emptyToNull(formData.get("inventory_number"));
  const HSN_code = emptyToNull(formData.get("HSN_code"));
  const GST_group = emptyToNull(formData.get("GST_group"));
  const size = emptyToNull(formData.get("size"));

  const { n: cost_price, error: costErr } = parseOptionalFloat(
    formData.get("cost_price"),
  );
  if (costErr) return { error: costErr };

  const { n: selling_price, error: sellErr } = parseOptionalFloat(
    formData.get("selling_price"),
  );
  if (sellErr) return { error: sellErr };

  const { n: mrp, error: mrpErr } = parseOptionalFloat(formData.get("mrp"));
  if (mrpErr) return { error: mrpErr };
  const { n: pieces, error: piecesErr } = parseOptionalInt(formData.get("pieces"));
  if (piecesErr) return { error: piecesErr };

  const { refs, error: refErr } = parseStockRefsFromForm(formData);
  if (refErr) return { error: refErr };

  const parsed: StockParsed = {
    stock_number,
    inventory_number,
    ...refs,
    HSN_code,
    GST_group,
    size,
    cost_price,
    selling_price,
    mrp,
    pieces,
  };

  const supabase = createSupabase();

  const { error } = await supabase
    .from("Stock")
    .update({
      ...parsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/stock");
  return { error: null };
}

export async function deleteStock(id: string): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  if (!id) return { error: "Missing stock id" };

  const supabase = createSupabase();
  const { error } = await supabase.from("Stock").delete().eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/stock");
  return { error: null };
}

export async function deleteStockMany(ids: string[]): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { error: "Select at least one stock row to delete." };

  const supabase = createSupabase();
  const { error } = await supabase.from("Stock").delete().in("id", uniqueIds);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/stock");
  return { error: null };
}
