"use server";

import { redirect } from "next/navigation";
import { createSupabase } from "@/lib/supabase";
import { setAuthCookie, clearAuthCookie, type UserRole } from "@/lib/auth";

export async function login(formData: FormData) {
  const username = formData.get("username")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString().trim() ?? "";
  if (!username || !password) {
    redirect("/login?error=invalid");
  }

  const supabase = createSupabase();

  const { data: user, error: userError } = await supabase
    .from("Users")
    .select("id, role, name")
    .eq("username", username)
    .eq("password", password)
    .maybeSingle();

  if (userError || !user?.role) {
    redirect("/login?error=invalid");
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("Roles")
    .select("role")
    .eq("id", user.role)
    .maybeSingle();

  const roleText = roleRow?.role?.toLowerCase().trim();
  const role: UserRole | null =
    roleError || !roleText
      ? null
      : roleText === "admin"
        ? "admin"
        : roleText === "user" || roleText === "employee"
          ? "user"
          : null;

  if (!role) {
    redirect("/login?error=role");
  }

  await setAuthCookie(role, user.id, user.name?.trim() || username);
  redirect("/");
}

export async function logout() {
  await clearAuthCookie();
  redirect("/login");
}
