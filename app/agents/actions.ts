"use server";

import { revalidatePath } from "next/cache";
import { createSupabase } from "@/lib/supabase";
import { requireActionRole } from "@/lib/auth";

export type ActionResult = { error: string | null };

function emptyToNull(value: FormDataEntryValue | null) {
  const s = value?.toString().trim();
  return s ? s : null;
}

function mapSupabaseError(message: string) {
  if (message.includes("row-level security")) {
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on the Agent table.`;
  }
  return message;
}

export async function createAgent(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const agent_name = emptyToNull(formData.get("agent_name"));

  const supabase = createSupabase();
  const { error } = await supabase
    .from("Agent")
    .insert({ agent_name })
    .select("id")
    .single();

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/agents");
  return { error: null };
}

export async function updateAgent(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing agent id" };

  const agent_name = emptyToNull(formData.get("agent_name"));

  const supabase = createSupabase();
  const { error } = await supabase
    .from("Agent")
    .update({ agent_name, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/agents");
  return { error: null };
}

