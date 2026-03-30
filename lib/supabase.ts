import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  return url;
}

export function createSupabase(): SupabaseClient {
  const url = getSupabaseUrl();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!key) {
    throw new Error(
      "Missing a client key: set NEXT_PUBLIC_SUPABASE_ANON_KEY (recommended) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    );
  }

  return createClient(url, key);
}

/** Server-only: reads/writes OAuth refresh token in `"One Drive"`. Requires service role (bypasses RLS). */
export function createSupabaseService(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (server-only). Required to store Microsoft refresh tokens in the database.",
    );
  }
  return createClient(url, key);
}
