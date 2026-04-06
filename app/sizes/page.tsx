import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { SizesManager } from "./sizes-manager";
import type { SizeRow } from "./types";

export const dynamic = "force-dynamic";

export default async function SizesPage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("Sizes")
    .select("id, size, created_at, updated_at")
    .order("size", { ascending: true, nullsFirst: false });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Sizes" description="" />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not load sizes</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <SizesManager sizes={(data ?? []) as SizeRow[]} />
      )}
    </div>
  );
}
