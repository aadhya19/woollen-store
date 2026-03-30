import Link from "next/link";
import { getAuthSession } from "@/lib/auth";
import { logout } from "@/app/login/actions";

const navClass =
  "text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300";

export default async function TopNav() {
  const session = await getAuthSession();
  const isAdmin = session?.role === "admin";
  const isUser = session?.role === "user";

  return (
    <header className="border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          My App
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {isAdmin ? (
            <>
              <Link href="/users" className={navClass}>
                Users
              </Link>
              <Link href="/agents" className={navClass}>
                Agents
              </Link>
              <Link href="/inventory" className={navClass}>
                Inventory
              </Link>
              <Link href="/brands" className={navClass}>
                Brands
              </Link>
              <Link href="/products" className={navClass}>
                Products
              </Link>
              <Link href="/stock" className={navClass}>
                Stock
              </Link>
              <Link href="/transports" className={navClass}>
                Transports
              </Link>
            </>
          ) : null}
          {isUser ? (
            <>
              <Link href="/inventory" className={navClass}>
                Inventory
              </Link>
              <Link href="/stock" className={navClass}>
                Stock
              </Link>
              <Link href="/documents" className={navClass}>
                Documents
              </Link>
            </>
          ) : null}
          {session ? (
            <>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {session.role}
              </span>
              <form action={logout}>
                <button className={navClass} type="submit">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={navClass}>
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

