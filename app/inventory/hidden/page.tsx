import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { InventoryManager } from "../inventory-manager";
import { loadInventoryPageData } from "../load-inventory-page-data";

export const dynamic = "force-dynamic";

export default async function HiddenInventoryPage() {
  const session = await requireAuth(["admin", "user", "manager"]);
  const data = await loadInventoryPageData({ hidden: true });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Hidden invoices"
        description="Invoices hidden from the main list. Unhide to restore them."
      />

      {data.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not load hidden inventory data</p>
          <p className="mt-1 opacity-90">{data.error.message}</p>
        </div>
      ) : (
        <InventoryManager
          inventories={data.inventories}
          agents={data.agents}
          transports={data.transports}
          users={data.users}
          inventoryExportItems={data.inventoryExportItems}
          canManage={session.role === "admin" || session.role === "manager"}
          showPaymentFields={session.role === "admin"}
          allowRestrictedEdit={session.role === "user"}
          listMode="hidden"
        />
      )}
    </div>
  );
}
