import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { UsersManager } from "./users-manager";
import type { RoleRow, UserRow } from "./types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();

  const [usersRes, rolesRes] = await Promise.all([
    supabase
      .from("Users")
      .select("id, name, username, password, role, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("Roles")
      .select("id, role, created_at, updated_at")
      .order("role", { ascending: true, nullsFirst: false }),
  ]);

  const error = usersRes.error ?? rolesRes.error;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Users"
        description={
          <>
            CRUD on <code className="text-xs">Users</code> with <code className="text-xs">role</code>{" "}
            referencing <code className="text-xs">Roles</code>.
          </>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="font-medium">Could not load data</p>
          <p className="mt-1 opacity-90">{error.message}</p>
          <p className="mt-2 text-xs opacity-80">
            Match table names (<code>Users</code>, <code>Roles</code>) to Postgres. Ensure RLS
            allows <code>SELECT</code> (and writes) for your API key role.
          </p>
        </div>
      ) : (
        <UsersManager
          users={(usersRes.data ?? []) as UserRow[]}
          roles={(rolesRes.data ?? []) as RoleRow[]}
        />
      )}
    </div>
  );
}
