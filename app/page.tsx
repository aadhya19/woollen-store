import { requireAuth } from "@/lib/auth";
import PageHeader from "./components/PageHeader";
import Link from "next/link";

export default async function Home() {
  const session = await requireAuth(["admin", "user"]);
  const links =
    session.role === "admin"
      ? [
          { href: "/users", label: "Users" },
          { href: "/agents", label: "Agents" },
          { href: "/inventory", label: "Inventory" },
          { href: "/brands", label: "Brands" },
          { href: "/products", label: "Products" },
          { href: "/stock", label: "Stock" },
          { href: "/transports", label: "Transports" },
        ]
      : [
          { href: "/inventory", label: "Inventory" },
          { href: "/stock", label: "Stock" },
          { href: "/documents", label: "Documents" },
        ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Dashboard"
        description={
          <>
            Logged in as <span className="font-medium">{session.role}</span>.
            Use the sidebar to move between modules.
          </>
        }
      />
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
            >
              Open {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
