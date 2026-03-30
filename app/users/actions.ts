"use server";

import { revalidatePath } from "next/cache";
import { createSupabase } from "@/lib/supabase";
import { requireActionRole } from "@/lib/auth";

export type ActionResult = { error: string | null };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapSupabaseError(message: string) {
  if (message.includes("row-level security")) {
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Users and Roles.`;
  }
  if (message.includes("foreign key") || message.includes("Users_role_fkey")) {
    return `${message} The selected role id must exist in Roles.`;
  }
  return message;
}

function parseRoleId(
  formData: FormData,
): { role: string | null; error: string | null } {
  const raw = formData.get("role")?.toString().trim() ?? "";
  if (!raw) return { role: null, error: null };
  if (!UUID_RE.test(raw)) {
    return { role: null, error: "Invalid role selection" };
  }
  return { role: raw, error: null };
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const name = emptyToNull(formData.get("name"));
  const username = emptyToNull(formData.get("username"));
  const password = emptyToNull(formData.get("password"));
  const { role, error: roleErr } = parseRoleId(formData);
  if (roleErr != null) return { error: roleErr };

  const supabase = createSupabase();
  const { error } = await supabase
    .from("Users")
    .insert({ name, username, password, role });

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  revalidatePath("/users");
  return { error: null };
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };

  const id = formData.get("id")?.toString();
  if (!id) {
    return { error: "Missing user id" };
  }
  const name = emptyToNull(formData.get("name"));
  const username = emptyToNull(formData.get("username"));
  const password = emptyToNull(formData.get("password"));
  const { role, error: roleErr } = parseRoleId(formData);
  if (roleErr != null) return { error: roleErr };

  const supabase = createSupabase();
  const { error } = await supabase
    .from("Users")
    .update({
      name,
      username,
      password,
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }
  revalidatePath("/users");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null) {
  const s = value?.toString().trim();
  return s ? s : null;
}
