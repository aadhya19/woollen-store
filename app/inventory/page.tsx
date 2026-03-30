import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import  { InventoryManager } from "./inventory-manager";
import type {
  AgentLookupRow,
  ProductLookupRow,
  TransportLookupRow,
  UserLookupRow,
  InventoryRow,
} from "./types";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await requireAuth(["admin", "user"]);
  const supabase = createSupabase();

  const [inventoriesRes, itemsRes, agentsRes, transportsRes, usersRes] =
    await Promise.all([
      supabase
        .from("Inventory")
        .select(
          "id, inventory_number, company_name, agent_name, transport_name, waybill_number, transport_charges, date_of_entry, loading_charges, staff_name, location, invoice_number, item_name, billed_quantity, received_quantity, tallying, pricing, stickering, supply, stock_note, created_at, updated_at, invoice_amount, invoice_date, invoice_image_url, invoice_pdf_url, payment_details, payment_mode, payment_status, debit_note, comments",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("Products")
        .select("id, product_name")
        .order("product_name", { ascending: true }),
      supabase
        .from("Agent")
        .select("id, agent_name")
        .order("agent_name", { ascending: true }),
      supabase
        .from("Transport")
        .select("id, transport_name")
        .order("transport_name", { ascending: true }),
      supabase
        .from("Users")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);

  const error =
    inventoriesRes.error ??
    itemsRes.error ??
    agentsRes.error ??
    transportsRes.error ??
    usersRes.error;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Inventory"
        description=""
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not load inventory data</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <InventoryManager
          inventories={(inventoriesRes.data ?? []) as InventoryRow[]}
          items={(itemsRes.data ?? []) as ProductLookupRow[]}
          agents={(agentsRes.data ?? []) as AgentLookupRow[]}
          transports={(transportsRes.data ?? []) as TransportLookupRow[]}
          users={(usersRes.data ?? []) as UserLookupRow[]}
          canManage={session.role === "admin"}
          allowRestrictedEdit={session.role === "user"}
        />
      )}
    </div>
  );
}

