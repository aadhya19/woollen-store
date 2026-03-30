import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { StyleManager } from "./style-manager";
import type { StyleRow } from "./types";

export const dynamic = "force-dynamic";

export default async function StylePage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("Style")
    .select("id, style_name, created_at, updated_at")
    .order("style_name", { ascending: true, nullsFirst: false });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Style" description="" />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not load styles</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <StyleManager styles={(data ?? []) as StyleRow[]} />
      )}
    </div>
  );
}
