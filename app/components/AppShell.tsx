import Link from "next/link";
import Image from "next/image";
import { getAuthSession } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import SidebarNav from "./SidebarNav";
import PendingButton from "./PendingButton";

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
    <div className="min-h-screen bg-[#fffef2] text-[#245236] md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-[#245236]/20 bg-white px-4 py-6 md:flex md:flex-col">
        <Link href="/" className="px-3">
          <Image
            src="/WS_Logo.avif"
            alt="WS Logo"
            width={160}
            height={48}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <p className="px-3 pt-1 text-xs uppercase tracking-[0.2em] text-[#245236]/70">
          {session.role}
        </p>
        <div className="mt-6 flex-1">
          <SidebarNav role={session.role} />
        </div>
        <form action={logout} className="mt-6 px-3">
          <PendingButton
            idleLabel="Logout"
            pendingLabel="Logging out..."
            className="w-full rounded-xl border border-[#245236]/30 bg-[#FEED01] px-3 py-2 text-sm font-semibold text-[#245236] hover:bg-[#f6e600]"
          />
        </form>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#245236]/20 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <Link href="/" className="md:hidden">
              <Image
                src="/WS_Logo.avif"
                alt="WS Logo"
                width={128}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </Link>
            <div className="hidden text-sm font-medium text-[#245236]/70 md:block">
              {session.role}
            </div>
            <form action={logout} className="md:hidden">
              <PendingButton
                idleLabel="Logout"
                pendingLabel="Logging out..."
                className="rounded-lg border border-[#245236]/30 bg-[#FEED01] px-3 py-1.5 text-sm font-semibold text-[#245236] hover:bg-[#f6e600]"
              />
            </form>
          </div>
          <div className="border-t border-[#245236]/20 px-4 py-3 md:hidden">
            <SidebarNav role={session.role} mobile />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
