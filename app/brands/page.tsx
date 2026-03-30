import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { BrandsManager } from "./brands-manager";
import type { BrandRow } from "./types";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("Brand")
    .select("id, brand_name, created_at, updated_at")
    .order("brand_name", { ascending: true, nullsFirst: false });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Brands"
        description=""
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not load brands</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <BrandsManager brands={(data ?? []) as BrandRow[]} />
      )}
    </div>
  );
}
