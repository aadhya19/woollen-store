"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/auth";

type SidebarNavProps = {
  role: UserRole;
  mobile?: boolean;
};

const adminNav = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/agents", label: "Agents" },
  { href: "/inventory", label: "Invoices" },
  { href: "/inventory/hidden", label: "Hidden invoices" },
  { href: "/brands", label: "Brands" },
  { href: "/products", label: "Products" },
  { href: "/style", label: "Style" },
  { href: "/fabric", label: "Fabric" },
  { href: "/sizes", label: "Sizes" },
  { href: "/stock", label: "Inventory" },
  { href: "/transports", label: "Transports" },
  { href: "/documents", label: "Documents" },
];

const navByRole: Record<UserRole, Array<{ href: string; label: string }>> = {
  admin: adminNav,
  manager: adminNav.filter((link) => link.href !== "/users"),
  user: [
    { href: "/", label: "Dashboard" },
    { href: "/inventory", label: "Invoices" },
    { href: "/inventory/hidden", label: "Hidden invoices" },
    { href: "/stock", label: "Inventory" },
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
        const exact = pathname === link.href;
        const nested =
          link.href !== "/" &&
          pathname.startsWith(`${link.href}/`) &&
          !links.some(
            (other) =>
              other.href !== link.href &&
              other.href.startsWith(`${link.href}/`) &&
              (pathname === other.href || pathname.startsWith(`${other.href}/`)),
          );
        const active = exact || nested;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-[#245236] text-[#FEED01]"
                : "text-[#245236] hover:bg-[#FEED01]/40"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
