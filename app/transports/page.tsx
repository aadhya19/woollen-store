import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { TransportsManager } from "./transports-manager";
import type { TransportRow } from "./types";

export const dynamic = "force-dynamic";

export default async function TransportsPage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("Transport")
    .select("id, transport_name, created_at, updated_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Transports"
        description={
          <>
            CRUD for <code className="text-xs">public.Transport</code>.
          </>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="font-medium">Could not load transports</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <TransportsManager transports={(data ?? []) as TransportRow[]} />
      )}
    </div>
  );
}

