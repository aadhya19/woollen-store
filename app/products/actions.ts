"use server";

import { revalidatePath } from "next/cache";
import { createSupabase } from "@/lib/supabase";
import { requireActionRole } from "@/lib/auth";
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

function mapSupabaseError(message: string) {
  if (message.includes("row-level security")) {
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Products.`;
  }
  if (message.includes("foreign key") || message.includes("Products_brand_name_fkey")) {
    return `${message} Choose a brand that exists in Brand.`;
  }
  const m = message.toLowerCase();
  if (
    (m.includes("duplicate key") || m.includes("unique constraint")) &&
    m.includes("product")
  ) {
    return duplicateProductMessage();
  }
  return message;
}

type ProductRowDb = {
  id: string;
  product_name: string | null;
  product_description: string | null;
  style: string | null;
  fabric: string | null;
};

async function findProductRowByTuple(
  supabase: ReturnType<typeof createSupabase>,
  brandId: string,
  tuple: ProductTuple,
): Promise<ProductRowDb | null> {
  const { data, error } = await supabase
    .from("Products")
    .select("id, product_name, product_description, style, fabric")
    .eq("brand_name", brandId);
  if (error || !data?.length) return null;
  for (const row of data as ProductRowDb[]) {
    if (
      tuplesEqual(tuple, {
        product_name: row.product_name,
        product_description: row.product_description,
        style: row.style,
        fabric: row.fabric,
      })
    ) {
      return row;
    }
  }
  return null;
}

async function hasDuplicateTupleForOtherProduct(
  supabase: ReturnType<typeof createSupabase>,
  brandId: string,
  tuple: ProductTuple,
  excludeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("Products")
    .select("id, product_name, product_description, style, fabric")
    .eq("brand_name", brandId);
  if (error || !data?.length) return false;
  for (const row of data as ProductRowDb[]) {
    if (row.id === excludeId) continue;
    if (
      tuplesEqual(tuple, {
        product_name: row.product_name,
        product_description: row.product_description,
        style: row.style,
        fabric: row.fabric,
      })
    ) {
      return true;
    }
  }
  return false;
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const product_name = emptyToNull(formData.get("product_name"));
  const product_description = emptyToNull(formData.get("product_description"));
  const style = emptyToNull(formData.get("style"));
  const fabric = emptyToNull(formData.get("fabric"));
  const brand_name = emptyToNull(formData.get("brand_name"));
  if (!brand_name) return { error: "Brand is required." };

  const tuple: ProductTuple = {
    product_name: normalizeProductField(product_name),
    product_description: normalizeProductField(product_description),
    style: normalizeProductField(style),
    fabric: normalizeProductField(fabric),
  };
  if (!tuple.product_name) return { error: "Product name is required." };

  const supabase = createSupabase();
  const existing = await findProductRowByTuple(supabase, brand_name, tuple);
  if (existing) return { error: duplicateProductMessage() };

  const { error } = await supabase.from("Products").insert({
    product_name: tuple.product_name,
    product_description: tuple.product_description,
    style: tuple.style,
    fabric: tuple.fabric,
    brand_name,
  });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/inventory");
  return { error: null };
}

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing product id" };

  const product_name = emptyToNull(formData.get("product_name"));
  const product_description = emptyToNull(formData.get("product_description"));
  const style = emptyToNull(formData.get("style"));
  const fabric = emptyToNull(formData.get("fabric"));
  const brand_name = emptyToNull(formData.get("brand_name"));
  if (!brand_name) return { error: "Brand is required." };

  const tuple: ProductTuple = {
    product_name: normalizeProductField(product_name),
    product_description: normalizeProductField(product_description),
    style: normalizeProductField(style),
    fabric: normalizeProductField(fabric),
  };
  if (!tuple.product_name) return { error: "Product name is required." };

  const supabase = createSupabase();
  const dup = await hasDuplicateTupleForOtherProduct(supabase, brand_name, tuple, id);
  if (dup) return { error: duplicateProductMessage() };

  const { error } = await supabase
    .from("Products")
    .update({
      product_name: tuple.product_name,
      product_description: tuple.product_description,
      style: tuple.style,
      fabric: tuple.fabric,
      brand_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/inventory");
  return { error: null };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  if (!id) return { error: "Missing product id" };

  const supabase = createSupabase();
  const { error } = await supabase.from("Products").delete().eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/inventory");
  return { error: null };
}
