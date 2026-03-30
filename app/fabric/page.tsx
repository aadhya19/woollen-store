import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { FabricManager } from "./fabric-manager";
import type { FabricRow } from "./types";

export const dynamic = "force-dynamic";

export default async function FabricPage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("Fabric")
    .select("id, fabric_name, created_at, updated_at")
    .order("fabric_name", { ascending: true, nullsFirst: false });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Fabric" description="" />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not load fabric</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <FabricManager fabrics={(data ?? []) as FabricRow[]} />
      )}
    </div>
  );
}
