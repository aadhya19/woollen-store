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
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Brand.`;
  }
  return message;
}

export async function createBrand(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const brand_name = emptyToNull(formData.get("brand_name"));
  const supabase = createSupabase();
  const { error } = await supabase.from("Brand").insert({ brand_name });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/brands");
  revalidatePath("/products");
  return { error: null };
}

export async function updateBrand(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing brand id" };

  const brand_name = emptyToNull(formData.get("brand_name"));
  const supabase = createSupabase();
  const { error } = await supabase
    .from("Brand")
    .update({
      brand_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/brands");
  revalidatePath("/products");
  return { error: null };
}

export async function deleteBrand(id: string): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  if (!id) return { error: "Missing brand id" };

  const supabase = createSupabase();
  const { error } = await supabase.from("Brand").delete().eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/brands");
  revalidatePath("/products");
  return { error: null };
}
