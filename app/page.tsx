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
          { href: "/style", label: "Style" },
          { href: "/fabric", label: "Fabric" },
          { href: "/stock", label: "Stock" },
          { href: "/transports", label: "Transports" },
        ]
      : [
          { href: "/inventory", label: "Inventory" },
          { href: "/stock", label: "Stock" },
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
      <div className="rounded-2xl border border-[#245236]/20 bg-white p-5 shadow-sm">
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-[#245236]/25 bg-[#FEED01]/40 px-4 py-3 text-sm font-semibold text-[#245236] shadow-sm hover:bg-[#FEED01]/60"
            >
              Open {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
