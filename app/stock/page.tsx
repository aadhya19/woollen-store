import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { StockManager } from "./stock-manager";
import type { AgentLookupRow } from "../inventory/types";
import type {
  BrandOption,
  FabricOption,
  InventoryStockContext,
  ProductOption,
  SizeOption,
  StockRow,
  StyleOption,
} from "./types";

function resolveAgentDisplayName(
  raw: string | null,
  agents: AgentLookupRow[],
): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const match = agents.find((a) => a.id === s);
  if (match?.agent_name?.trim()) return match.agent_name.trim();
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    );
  if (looksLikeUuid) return null;
  return s;
}

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await requireAuth(["admin", "user"]);
  const supabase = createSupabase();

  const [
    { data: stockData, error: stockError },
    { data: productsRaw, error: productsError },
    { data: brandsRaw, error: brandsError },
    { data: stylesRaw, error: stylesError },
    { data: fabricsRaw, error: fabricsError },
    { data: sizesRaw, error: sizesError },
    { data: inventoryLookupData, error: inventoryLookupError },
    { data: agentsData, error: agentsError },
  ] = await Promise.all([
    supabase
      .from("Stock")
      .select(
        'id, stock_number, inventory_number, brand_name, product, style, "Fabric", "HSN_code", "GST_group", cost_price, selling_price, mrp, pieces, size, created_at, updated_at',
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("Products")
      .select("id, product_name")
      .order("product_name", { ascending: true, nullsFirst: false }),
    supabase
      .from("Brand")
      .select("id, brand_name")
      .order("brand_name", { ascending: true, nullsFirst: false }),
    supabase
      .from("Style")
      .select("id, style_name")
      .order("style_name", { ascending: true, nullsFirst: false }),
    supabase
      .from("Fabric")
      .select("id, fabric_name")
      .order("fabric_name", { ascending: true, nullsFirst: false }),
    supabase
      .from("Sizes")
      .select("id, size")
      .order("size", { ascending: true, nullsFirst: false }),
    supabase
      .from("Inventory")
      .select(
        "inventory_number, invoice_number, invoice_date, invoice_amount, company_name, agent_name",
      )
      .order("inventory_number"),
    supabase.from("Agent").select("id, agent_name").order("agent_name"),
  ]);

  const agents = (agentsData ?? []) as AgentLookupRow[];

  const errorMessage =
    stockError?.message ??
    productsError?.message ??
    brandsError?.message ??
    stylesError?.message ??
    fabricsError?.message ??
    sizesError?.message ??
    inventoryLookupError?.message ??
    agentsError?.message ??
    null;

  const brandOptions: BrandOption[] = (brandsRaw ?? []).map((b) => {
    const row = b as { id: string; brand_name: string | null };
    return { id: row.id, brand_name: row.brand_name };
  });

  const productOptions: ProductOption[] = (productsRaw ?? []).map((p) => {
    const row = p as { id: string; product_name: string | null };
    return { id: row.id, product_name: row.product_name };
  });

  const styleOptions: StyleOption[] = (stylesRaw ?? []).map((s) => {
    const row = s as { id: string; style_name: string | null };
    return { id: row.id, style_name: row.style_name };
  });

  const fabricOptions: FabricOption[] = (fabricsRaw ?? []).map((f) => {
    const row = f as { id: string; fabric_name: string | null };
    return { id: row.id, fabric_name: row.fabric_name };
  });

  const sizeOptions: SizeOption[] = (sizesRaw ?? []).map((s) => {
    const row = s as { id: string; size: string | null };
    return { id: row.id, size: row.size };
  });

  const byInventoryNumber = new Map<string, InventoryStockContext>();
  for (const row of inventoryLookupData ?? []) {
    const num = row.inventory_number?.toString().trim();
    if (!num || byInventoryNumber.has(num)) continue;
    byInventoryNumber.set(num, {
      inventory_number: num,
      invoice_number: row.invoice_number ?? null,
      invoice_date: row.invoice_date ?? null,
      invoice_amount: row.invoice_amount ?? null,
      company_name: row.company_name ?? null,
      agent_name: resolveAgentDisplayName(row.agent_name, agents),
    });
  }
  const inventoryForStock = Array.from(byInventoryNumber.values()).sort((a, b) =>
    a.inventory_number.localeCompare(b.inventory_number),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Inventory" description="" />

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Could not load stock</p>
          <p className="mt-1 opacity-90">{errorMessage}</p>
        </div>
      ) : (
        <StockManager
          stock={(stockData ?? []) as StockRow[]}
          products={productOptions}
          brands={brandOptions}
          styles={styleOptions}
          fabrics={fabricOptions}
          sizes={sizeOptions}
          inventoryForStock={inventoryForStock}
          canManage={session.role === "admin"}
          allowRestrictedEdit={session.role === "user"}
        />
      )}
    </div>
  );
}
