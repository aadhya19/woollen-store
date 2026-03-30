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
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Fabric.`;
  }
  return message;
}

export async function createFabric(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const fabric_name = emptyToNull(formData.get("fabric_name"));
  const supabase = createSupabase();
  const { error } = await supabase.from("Fabric").insert({ fabric_name });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/fabric");
  revalidatePath("/stock");
  return { error: null };
}

export async function updateFabric(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing fabric id" };

  const fabric_name = emptyToNull(formData.get("fabric_name"));
  const supabase = createSupabase();
  const { error } = await supabase
    .from("Fabric")
    .update({
      fabric_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/fabric");
  revalidatePath("/stock");
  return { error: null };
}
