import Link from "next/link";
import Image from "next/image";
import { getAuthSession } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import PendingButton from "./PendingButton";

const navClass =
  "text-sm font-medium text-[#245236] underline-offset-4 hover:underline";

export default async function TopNav() {
  const session = await getAuthSession();
  const isAdmin = session?.role === "admin";
  const isUser = session?.role === "user";

  return (
    <header className="border-b border-[#245236]/20 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/WS_Logo.avif"
            alt="WS Logo"
            width={128}
            height={40}
            className="h-8 w-auto"
            priority
          />
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
              <Link href="/style" className={navClass}>
                Style
              </Link>
              <Link href="/fabric" className={navClass}>
                Fabric
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
            </>
          ) : null}
          {session ? (
            <>
              <span className="text-sm text-[#245236]/70">
                {session.role}
              </span>
              <form action={logout}>
                <PendingButton idleLabel="Logout" pendingLabel="Logging out..." className={navClass} />
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

