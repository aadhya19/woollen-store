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
    return `${message} Enable INSERT/UPDATE policies for the anon (or authenticated) role on Sizes.`;
  }
  return message;
}

export async function createSize(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const size = emptyToNull(formData.get("size"));
  const supabase = createSupabase();
  const { error } = await supabase.from("Sizes").insert({ size });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/sizes");
  revalidatePath("/stock");
  return { error: null };
}

export async function updateSize(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing size id" };

  const size = emptyToNull(formData.get("size"));
  const supabase = createSupabase();
  const { error } = await supabase
    .from("Sizes")
    .update({
      size,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/sizes");
  revalidatePath("/stock");
  return { error: null };
}
