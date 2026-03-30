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
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Style.`;
  }
  return message;
}

export async function createStyle(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const style_name = emptyToNull(formData.get("style_name"));
  const supabase = createSupabase();
  const { error } = await supabase.from("Style").insert({ style_name });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/style");
  revalidatePath("/stock");
  return { error: null };
}

export async function updateStyle(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing style id" };

  const style_name = emptyToNull(formData.get("style_name"));
  const supabase = createSupabase();
  const { error } = await supabase
    .from("Style")
    .update({
      style_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/style");
  revalidatePath("/stock");
  return { error: null };
}
