"use server";

import { revalidatePath } from "next/cache";
import { createSupabase } from "@/lib/supabase";
import { getAuthSession, requireActionRole } from "@/lib/auth";
import {
  duplicateProductMessage,
  normalizeProductField,
  tuplesEqual,
  type ProductTuple,
} from "@/lib/product-tuple";

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
  if (
    (m.includes("duplicate key") || m.includes("unique constraint")) &&
    m.includes("stock")
  ) {
    return `${message} Stock has a unique constraint involving product and/or brand — each combination may appear only once.`;
  }
  return message;
}

type StockFks = {
  brand_name: string | null;
  product: string | null;
};

const DRAFT_NEW = "__new__";

function draftPick(
  formData: FormData,
  selectName: string,
  customName: string,
): string | null {
  const sel = formData.get(selectName)?.toString() ?? "";
  if (sel === DRAFT_NEW) return emptyToNull(formData.get(customName));
  if (sel === "") return null;
  return emptyToNull(sel);
}

function parseProductDraftFromForm(formData: FormData): ProductTuple {
  return {
    product_name: normalizeProductField(
      draftPick(formData, "draft_product_name", "draft_product_name_custom"),
    ),
    product_description: normalizeProductField(
      draftPick(formData, "draft_product_description", "draft_product_description_custom"),
    ),
    style: normalizeProductField(draftPick(formData, "draft_style", "draft_style_custom")),
    fabric: normalizeProductField(draftPick(formData, "draft_fabric", "draft_fabric_custom")),
  };
}

async function findProductIdByTuple(
  supabase: ReturnType<typeof createSupabase>,
  brandId: string,
  tuple: ProductTuple,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("Products")
    .select("id, product_name, product_description, style, fabric")
    .eq("brand_name", brandId);
  if (error || !data?.length) return null;
  for (const row of data) {
    const r = row as {
      id: string;
      product_name: string | null;
      product_description: string | null;
      style: string | null;
      fabric: string | null;
    };
    if (
      tuplesEqual(tuple, {
        product_name: r.product_name,
        product_description: r.product_description,
        style: r.style,
        fabric: r.fabric,
      })
    ) {
      return r.id;
    }
  }
  return null;
}

async function resolveOrCreateProductForStock(
  supabase: ReturnType<typeof createSupabase>,
  brandId: string,
  tuple: ProductTuple,
): Promise<{ productId: string | null; error: string | null }> {
  if (!tuple.product_name) {
    return { productId: null, error: "Product name is required (choose or enter a name)." };
  }

  const existingId = await findProductIdByTuple(supabase, brandId, tuple);
  if (existingId) return { productId: existingId, error: null };

  const { data: inserted, error } = await supabase
    .from("Products")
    .insert({
      brand_name: brandId,
      product_name: tuple.product_name,
      product_description: tuple.product_description,
      style: tuple.style,
      fabric: tuple.fabric,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    const em = error.message.toLowerCase();
    if (em.includes("duplicate") || em.includes("unique")) {
      return { productId: null, error: duplicateProductMessage() };
    }
    return { productId: null, error: error.message };
  }

  const id = (inserted as { id?: string } | null)?.id ?? null;
  if (!id) return { productId: null, error: "Could not create product." };
  revalidatePath("/products");
  return { productId: id, error: null };
}

async function parseStockFksFromForm(
  supabase: ReturnType<typeof createSupabase>,
  formData: FormData,
): Promise<{ fks: StockFks; error: string | null }> {
  const locked = formData.get("stock_product_locked")?.toString() === "1";
  const productDirect = emptyToNull(formData.get("product_id"));

  if (locked) {
    if (!productDirect) {
      return { fks: emptyFks(), error: "Missing product reference." };
    }
    let brand_name = emptyToNull(formData.get("brand_name"));
    if (!brand_name) {
      const { data, error } = await supabase
        .from("Products")
        .select("brand_name")
        .eq("id", productDirect)
        .maybeSingle();
      if (error) return { fks: emptyFks(), error: mapSupabaseError(error.message) };
      brand_name = (data?.brand_name as string | null) ?? null;
    }
    return {
      fks: { brand_name, product: productDirect },
      error: null,
    };
  }

  const brand_name = emptyToNull(formData.get("brand_name"));
  if (!brand_name) {
    return { fks: emptyFks(), error: "Select a brand first." };
  }

  const tuple = parseProductDraftFromForm(formData);
  const { productId, error } = await resolveOrCreateProductForStock(
    supabase,
    brand_name,
    tuple,
  );
  if (error) return { fks: emptyFks(), error };
  if (!productId) return { fks: emptyFks(), error: "Could not resolve product." };

  return {
    fks: {
      brand_name,
      product: productId,
    },
    error: null,
  };
}

function emptyFks(): StockFks {
  return {
    brand_name: null,
    product: null,
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

  const supabase = createSupabase();
  const { fks, error: fkErr } = await parseStockFksFromForm(supabase, formData);
  if (fkErr) return { error: fkErr };

  const { error } = await supabase.from("Stock").insert({
    stock_number,
    inventory_number,
    ...fks,
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

type StockParsed = StockFks & {
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

function stockStrEmpty(v: string | null | undefined): boolean {
  if (v == null) return true;
  return String(v).trim() === "";
}

function mergeStockForRestrictedUser(
  existing: Record<string, unknown>,
  next: StockParsed,
): StockParsed {
  const g = (k: string) => existing[k];
  return {
    stock_number: stockStrEmpty(g("stock_number") as string | null)
      ? next.stock_number
      : (g("stock_number") as string | null),
    inventory_number: stockStrEmpty(g("inventory_number") as string | null)
      ? next.inventory_number
      : (g("inventory_number") as string | null),
    brand_name: stockStrEmpty(g("brand_name") as string | null)
      ? next.brand_name
      : (g("brand_name") as string | null),
    product: stockStrEmpty(g("product") as string | null)
      ? next.product
      : (g("product") as string | null),
    HSN_code: stockStrEmpty(g("HSN_code") as string | null)
      ? next.HSN_code
      : (g("HSN_code") as string | null),
    GST_group: stockStrEmpty(g("GST_group") as string | null)
      ? next.GST_group
      : (g("GST_group") as string | null),
    size: stockStrEmpty(g("size") as string | null) ? next.size : (g("size") as string | null),
    cost_price:
      g("cost_price") == null ? next.cost_price : (g("cost_price") as number | null),
    selling_price:
      g("selling_price") == null
        ? next.selling_price
        : (g("selling_price") as number | null),
    mrp: g("mrp") == null ? next.mrp : (g("mrp") as number | null),
    pieces: g("pieces") == null ? next.pieces : (g("pieces") as number | null),
  };
}

export async function updateStock(formData: FormData): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Not authenticated. Please log in." };
  if (session.role !== "admin" && session.role !== "user") {
    return { error: "You do not have permission to perform this action." };
  }
  const isAdmin = session.role === "admin";

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

  const supabase = createSupabase();
  const { fks, error: fkErr } = await parseStockFksFromForm(supabase, formData);
  if (fkErr) return { error: fkErr };

  const parsed: StockParsed = {
    stock_number,
    inventory_number,
    ...fks,
    HSN_code,
    GST_group,
    size,
    cost_price,
    selling_price,
    mrp,
    pieces,
  };

  if (isAdmin) {
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

  const { data: existing, error: fetchErr } = await supabase
    .from("Stock")
    .select(
      "stock_number, inventory_number, brand_name, product, HSN_code, GST_group, cost_price, selling_price, mrp, pieces, size",
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: mapSupabaseError(fetchErr.message) };
  if (!existing) return { error: "Stock row not found" };

  const merged = mergeStockForRestrictedUser(existing as Record<string, unknown>, parsed);

  const { error } = await supabase
    .from("Stock")
    .update({
      ...merged,
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
