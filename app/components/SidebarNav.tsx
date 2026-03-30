"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/auth";

type SidebarNavProps = {
  role: UserRole;
  mobile?: boolean;
};

const navByRole: Record<UserRole, Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/", label: "Dashboard" },
    { href: "/users", label: "Users" },
    { href: "/agents", label: "Agents" },
    { href: "/inventory", label: "Inventory" },
    { href: "/brands", label: "Brands" },
    { href: "/products", label: "Products" },
    { href: "/stock", label: "Stock" },
    { href: "/transports", label: "Transports" },
    { href: "/documents", label: "Documents" },
  ],
  user: [
    { href: "/", label: "Dashboard" },
    { href: "/inventory", label: "Inventory" },
    { href: "/stock", label: "Stock" },
    { href: "/documents", label: "Documents" },
  ],
};

export default function SidebarNav({ role, mobile = false }: SidebarNavProps) {
  const pathname = usePathname();
  const links = navByRole[role];

  return (
    <nav
      className={
        mobile ? "flex flex-wrap gap-2" : "flex flex-col gap-1"
      }
      aria-label="Primary navigation"
    >
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
