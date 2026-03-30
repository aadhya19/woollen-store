import { createSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { ProductsManager } from "./products-manager";
import type { BrandOptionRow, ProductRow } from "./types";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAuth(["admin"]);
  const supabase = createSupabase();

  const [productsRes, brandsRes] = await Promise.all([
    supabase
      .from("Products")
      .select(
        "id, product_name, product_description, style, fabric, brand_name, created_at, updated_at",
      )
      .order("product_name", { ascending: true, nullsFirst: false }),
    supabase
      .from("Brand")
      .select("id, brand_name")
      .order("brand_name", { ascending: true, nullsFirst: false }),
  ]);

  const error = productsRes.error ?? brandsRes.error;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Products"
        description={
          <>
            Admin CRUD for <code className="text-xs">public.Products</code> (brand via{" "}
            <code className="text-xs">Brand</code>).
          </>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="font-medium">Could not load products</p>
          <p className="mt-1 opacity-90">{error.message}</p>
        </div>
      ) : (
        <ProductsManager
          products={(productsRes.data ?? []) as ProductRow[]}
          brands={(brandsRes.data ?? []) as BrandOptionRow[]}
        />
      )}
    </div>
  );
}
