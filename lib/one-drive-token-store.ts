import { createSupabaseService } from "@/lib/supabase";

const TABLE = "One Drive";

export async function getOneDriveRefreshToken(): Promise<string | null> {
  const supabase = createSupabaseService();
  const { data, error } = await supabase
    .from(TABLE)
    .select("refresh_token")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const t = data?.refresh_token;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

export async function saveOneDriveRefreshToken(refreshToken: string): Promise<void> {
  const supabase = createSupabaseService();
  const trimmed = refreshToken.trim();
  if (!trimmed) {
    throw new Error("Cannot persist an empty Microsoft refresh token.");
  }

  const { data: existing, error: selErr } = await supabase
    .from(TABLE)
    .select("id")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;

  const now = new Date().toISOString();

  if (existing?.id) {
    const { error } = await supabase
      .from(TABLE)
      .update({ refresh_token: trimmed, updated_at: now })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(TABLE).insert({
    refresh_token: trimmed,
    updated_at: now,
  });
  if (error) throw error;
}
