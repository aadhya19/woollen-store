import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { AgentsManager } from "./agents-manager";
import type { AgentRow } from "./types";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("Agent")
    .select("id, agent_name, created_at, updated_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Agents"
        description={
          <>
            CRUD for <code className="text-xs">public.Agent</code>.
          </>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="font-medium">Could not load agents</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <AgentsManager agents={(data ?? []) as AgentRow[]} />
      )}
    </div>
  );
}

