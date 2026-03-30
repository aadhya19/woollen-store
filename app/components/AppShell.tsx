import Link from "next/link";
import { getAuthSession } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import SidebarNav from "./SidebarNav";

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900 md:flex md:flex-col">
        <Link href="/" className="px-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          My App
        </Link>
        <p className="px-3 pt-1 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          {session.role}
        </p>
        <div className="mt-6 flex-1">
          <SidebarNav role={session.role} />
        </div>
        <form action={logout} className="mt-6 px-3">
          <button
            type="submit"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            Logout
          </button>
        </form>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <Link href="/" className="text-base font-semibold text-zinc-900 dark:text-zinc-100 md:hidden">
              My App
            </Link>
            <div className="hidden text-sm font-medium text-zinc-500 dark:text-zinc-400 md:block">
              {session.role}
            </div>
            <form action={logout} className="md:hidden">
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              >
                Logout
              </button>
            </form>
          </div>
          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 md:hidden">
            <SidebarNav role={session.role} mobile />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
