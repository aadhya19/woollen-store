"use server";

import { revalidatePath } from "next/cache";
import { createSupabase } from "@/lib/supabase";
import { requireActionRole } from "@/lib/auth";

export type ActionResult = { error: string | null };

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = value?.toString().trim();
  return s ? s : null;
}

function mapSupabaseError(message: string) {
  if (message.includes("row-level security")) {
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Products.`;
  }
  return message;
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const product_name = emptyToNull(formData.get("product_name"));
  if (!product_name) return { error: "Product name is required." };

  const supabase = createSupabase();
  const { error } = await supabase.from("Products").insert({ product_name });

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
  if (!product_name) return { error: "Product name is required." };

  const supabase = createSupabase();
  const { error } = await supabase
    .from("Products")
    .update({
      product_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/inventory");
  return { error: null };
}
