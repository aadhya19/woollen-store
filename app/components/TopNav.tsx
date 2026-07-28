import Link from "next/link";
import Image from "next/image";
import { getAuthSession } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import PendingButton from "./PendingButton";

const navClass =
  "text-sm font-medium text-[#245236] underline-offset-4 hover:underline";

const adminLinks = [
  { href: "/users", label: "Users" },
  { href: "/agents", label: "Agents" },
  { href: "/inventory", label: "Invoices" },
  { href: "/brands", label: "Brands" },
  { href: "/products", label: "Products" },
  { href: "/style", label: "Style" },
  { href: "/fabric", label: "Fabric" },
  { href: "/sizes", label: "Sizes" },
  { href: "/stock", label: "Inventory" },
  { href: "/transports", label: "Transports" },
];

export default async function TopNav() {
  const session = await getAuthSession();
  const role = session?.role;
  const links =
    role === "admin"
      ? adminLinks
      : role === "manager"
        ? adminLinks.filter((link) => link.href !== "/users")
        : role === "user"
          ? [
              { href: "/inventory", label: "Invoices" },
              { href: "/stock", label: "Inventory" },
            ]
          : [];

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
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={navClass}>
              {link.label}
            </Link>
          ))}
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
