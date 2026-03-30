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
    <div className="min-h-full bg-[#fffef2] px-4 py-10 font-sans text-[#245236]">
      <div className="mx-auto max-w-md rounded-xl border border-[#245236]/20 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Login</h1>
        <p className="mt-1 text-sm text-[#245236]/75">
          Sign in with your username and password.
        </p>

        {hasError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            Invalid username or password.
          </p>
        ) : null}

        {hasRoleError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            This account does not have a valid role. Use <code>admin</code>,{" "}
            <code>user</code>, or <code>employee</code> in the linked Roles
            table.
          </p>
        ) : null}

        <form action={login} className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#245236]/80">
            Username
            <input
              name="username"
              type="text"
              autoComplete="username"
              className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-[#245236]/80">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
            />
          </label>

          <button
            type="submit"
            className="h-[42px] w-full rounded-lg bg-[#245236] px-5 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
