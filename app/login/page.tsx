import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { login } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (session) {
    redirect("/");
  }

  const params = await searchParams;
  const hasError = params.error === "invalid";
  const hasRoleError = params.error === "role";

  return (
    <div className="min-h-full bg-zinc-50 px-4 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight">Login</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with your username and password.
        </p>

        {hasError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
          >
            Invalid username or password.
          </p>
        ) : null}

        {hasRoleError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
          >
            This account does not have a valid role. Use <code>admin</code>,{" "}
            <code>user</code>, or <code>employee</code> in the linked Roles
            table.
          </p>
        ) : null}

        <form action={login} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Username
            <input
              name="username"
              type="text"
              autoComplete="username"
              defaultValue="admin"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue="test123"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <button
            type="submit"
            className="h-[42px] w-full rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
