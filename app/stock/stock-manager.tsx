"use client";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createStock, deleteStock, updateStock } from "./actions";
import Modal from "@/app/components/Modal";
import type {
  BrandOption,
  FabricOption,
  InventoryStockContext,
  ProductOption,
  StockRow,
  StyleOption,
} from "./types";

type Props = {
  stock: StockRow[];
  products: ProductOption[];
  brands: BrandOption[];
  styles: StyleOption[];
  fabrics: FabricOption[];
  inventoryForStock: InventoryStockContext[];
  canManage: boolean;
  allowRestrictedEdit?: boolean;
};

function cloneFormData(source: FormData): FormData {
  const fd = new FormData();
  for (const [key, val] of source.entries()) {
    fd.append(key, val);
  }
  return fd;
}

function buildCreateStockSummary(
  fd: FormData,
  brands: BrandOption[],
  products: ProductOption[],
  styles: StyleOption[],
  fabrics: FabricOption[],
): { label: string; value: string }[] {
  const brandId = fd.get("brand_name")?.toString().trim() ?? "";
  const productId = fd.get("product")?.toString().trim() ?? "";
  const styleId = fd.get("style")?.toString().trim() ?? "";
  const fabricId = fd.get("Fabric")?.toString().trim() ?? "";

  const brandName =
    brands.find((b) => b.id === brandId)?.brand_name?.trim() || brandId || "—";
  const productName =
    products.find((p) => p.id === productId)?.product_name?.trim() || productId || "—";
  const styleName =
    styles.find((s) => s.id === styleId)?.style_name?.trim() || styleId || "—";
  const fabricName =
    fabrics.find((f) => f.id === fabricId)?.fabric_name?.trim() || fabricId || "—";

  const emptyToDash = (v: FormDataEntryValue | null) => {
    const s = v?.toString().trim();
    return s ? s : "—";
  };

  return [
    { label: "Brand", value: brandName },
    { label: "Product", value: productName },
    { label: "Style", value: styleName },
    { label: "Fabric", value: fabricName },
    { label: "Stock number", value: emptyToDash(fd.get("stock_number")) },
    { label: "Inventory number", value: emptyToDash(fd.get("inventory_number")) },
    { label: "Size", value: emptyToDash(fd.get("size")) },
    { label: "Pieces", value: emptyToDash(fd.get("pieces")) },
    { label: "HSN code", value: emptyToDash(fd.get("HSN_code")) },
    { label: "GST group", value: emptyToDash(fd.get("GST_group")) },
    { label: "Cost price", value: emptyToDash(fd.get("cost_price")) },
    { label: "Selling price", value: emptyToDash(fd.get("selling_price")) },
    { label: "MRP", value: emptyToDash(fd.get("mrp")) },
  ];
}

export function StockManager({
  stock,
  products,
  brands,
  styles,
  fabrics,
  inventoryForStock,
  canManage,
  allowRestrictedEdit = false,
}: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [searchedInventoryNumber, setSearchedInventoryNumber] = useState("");
  const [activeInventoryNumber, setActiveInventoryNumber] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [pendingCreateFormData, setPendingCreateFormData] = useState<FormData | null>(null);
  const [createConfirmSummary, setCreateConfirmSummary] = useState<
    { label: string; value: string }[] | null
  >(null);
  const [createConfirmSubmitting, setCreateConfirmSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p] as const)),
    [products],
  );

  const styleById = useMemo(
    () => new Map(styles.map((s) => [s.id, s] as const)),
    [styles],
  );

  const fabricById = useMemo(
    () => new Map(fabrics.map((f) => [f.id, f] as const)),
    [fabrics],
  );

  const brandLabel = (brandId: string | null | undefined) => {
    if (!brandId?.trim()) return "—";
    const b = brands.find((x) => x.id === brandId);
    if (b?.brand_name?.trim()) return b.brand_name;
    return brandId;
  };

  const productRowLabel = (row: StockRow) => {
    const pid = row.product;
    if (!pid?.trim()) return "—";
    const p = productById.get(pid);
    if (!p) return pid;
    return p.product_name?.trim() || "Unnamed";
  };

  const searchPrefix = searchedInventoryNumber.trim();
  const searchPrefixLower = searchPrefix.toLowerCase();

  const matchingInventories = useMemo(() => {
    if (!searchPrefixLower) return [];
    return inventoryForStock
      .filter((row) => row.inventory_number.trim().toLowerCase().startsWith(searchPrefixLower))
      .sort((a, b) => a.inventory_number.localeCompare(b.inventory_number));
  }, [inventoryForStock, searchPrefixLower]);

  const selectedInventory = useMemo(() => {
    if (matchingInventories.length === 0) return null;
    if (!activeInventoryNumber) return matchingInventories[0];
    return (
      matchingInventories.find((r) => r.inventory_number === activeInventoryNumber) ??
      matchingInventories[0]
    );
  }, [matchingInventories, activeInventoryNumber]);

  const filteredStock = useMemo(() => {
    if (!searchPrefixLower) return [];
    if (selectedInventory) {
      const key = selectedInventory.inventory_number.trim().toLowerCase();
      return stock.filter(
        (row) => (row.inventory_number?.trim().toLowerCase() ?? "") === key,
      );
    }
    return stock.filter((row) =>
      (row.inventory_number?.trim().toLowerCase() ?? "").startsWith(searchPrefixLower),
    );
  }, [stock, searchPrefixLower, selectedInventory]);

  const editingRow = useMemo(() => {
    if (!editingId) return null;
    return stock.find((row) => row.id === editingId) ?? null;
  }, [stock, editingId]);

  const prefixMatchedStockOnly = useMemo(() => {
    if (!searchPrefixLower) return [];
    return stock.filter((row) =>
      (row.inventory_number?.trim().toLowerCase() ?? "").startsWith(searchPrefixLower),
    );
  }, [stock, searchPrefixLower]);

  const hasSearchResults =
    searchPrefix.length > 0 &&
    (matchingInventories.length > 0 || prefixMatchedStockOnly.length > 0);

  function closeCreateModal() {
    setIsCreateOpen(false);
    setCreateConfirmOpen(false);
    setPendingCreateFormData(null);
    setCreateConfirmSummary(null);
  }

  function handleCreateFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const brand = fd.get("brand_name")?.toString().trim();
    if (!brand) {
      setFormError("Select a brand.");
      return;
    }
    const product = fd.get("product")?.toString().trim();
    if (!product) {
      setFormError("Select a product.");
      return;
    }
    setFormError(null);
    setPendingCreateFormData(cloneFormData(fd));
    setCreateConfirmSummary(buildCreateStockSummary(fd, brands, products, styles, fabrics));
    setCreateConfirmOpen(true);
  }

  async function handleConfirmCreateStock() {
    if (!pendingCreateFormData) return;
    setCreateConfirmSubmitting(true);
    setFormError(null);
    try {
      const r = await createStock(pendingCreateFormData);
      if (r.error) {
        setFormError(r.error);
        setCreateConfirmOpen(false);
        return;
      }
      router.refresh();
      setIsCreateOpen(false);
      setCreateConfirmOpen(false);
      setPendingCreateFormData(null);
      setCreateConfirmSummary(null);
      (document.getElementById("create-stock-form") as HTMLFormElement)?.reset();
    } finally {
      setCreateConfirmSubmitting(false);
    }
  }

  async function runUpdate(formData: FormData) {
    setRowError(null);
    const r = await updateStock(formData);
    if (r.error) {
      setRowError(r.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  function runDelete(id: string) {
    setRowError(null);
    setDeletingId(id);
    startDelete(async () => {
      const r = await deleteStock(id);
      if (r.error) {
        setRowError(r.error);
        setDeletingId(null);
        return;
      }
      if (editingId === id) setEditingId(null);
      setDeletingId(null);
      router.refresh();
    });
  }

  function handleExportExcel() {
    if (filteredStock.length === 0) return;

    const columns = [
      "Stock No",
      "Product",
      "Brand",
      "Style",
      "Fabric",
      "HSN Code",
      "GST Group",
      "Cost Price",
      "Selling Price",
      "Retail Price",
      "Size",
    ];

    const csvRows = filteredStock.map((row) => {
      const p = productById.get(row.product ?? "");
      const productName = p?.product_name?.trim() || productRowLabel(row);
      const style = styleById.get(row.style ?? "")?.style_name?.trim() ?? "";
      const fabric = fabricById.get(row.Fabric ?? "")?.fabric_name?.trim() ?? "";
      return [
        row.stock_number,
        productName,
        brandLabel(row.brand_name),
        style,
        fabric,
        row.HSN_code,
        row.GST_group,
        row.cost_price,
        row.selling_price,
        row.mrp,
        row.size,
      ].map(toCsvCell);
    });

    const csv = [columns.map(toCsvCell), ...csvRows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const baseName =
      selectedInventory?.inventory_number ?? (searchedInventoryNumber.trim() || "export");
    const safeName = baseName.replaceAll(/[^a-z0-9_-]/gi, "-");
    const fileName = `stock-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleInventorySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setRowError(null);
    closeCreateModal();
    const prefix = inventorySearch.trim();
    setSearchedInventoryNumber(prefix);
    if (!prefix) {
      setActiveInventoryNumber(null);
      return;
    }
    const prefixLower = prefix.toLowerCase();
    const matches = inventoryForStock
      .filter((row) => row.inventory_number.trim().toLowerCase().startsWith(prefixLower))
      .sort((a, b) => a.inventory_number.localeCompare(b.inventory_number));
    setActiveInventoryNumber(matches[0]?.inventory_number ?? null);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#245236]/20 bg-white p-5 shadow-sm">
        <form onSubmit={handleInventorySearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
            Search inventory number
            <input
              type="search"
              value={inventorySearch}
              onChange={(event) => setInventorySearch(event.target.value)}
              autoComplete="off"
              placeholder="Enter inventory number"
              className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setRowError(null);
                setInventorySearch("");
                setSearchedInventoryNumber("");
                setActiveInventoryNumber(null);
                closeCreateModal();
              }}
              className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[#245236]/30 bg-[#FEED01]/40 px-4 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/60"
            >
              Clear
            </button>
          </div>
        </form>

      </section>

      <Modal
        open={isCreateOpen && selectedInventory != null}
        onClose={closeCreateModal}
        title="Add stock item"
        description="Create a new stock row for the selected inventory number."
        panelClassName="max-w-[1100px]"
      >
        {selectedInventory ? (
          <div className="space-y-4">
            {formError ? (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              >
                {formError}
              </p>
            ) : null}
            <InventoryContextReadonly context={selectedInventory} />
            <form
              key={selectedInventory.inventory_number}
              id="create-stock-form"
              onSubmit={handleCreateFormSubmit}
            >
              <StockFormFields
                mode="create"
                products={products}
                brands={brands}
                styles={styles}
                fabrics={fabrics}
                inventoryChoices={inventoryForStock}
                lockedInventoryNumber={selectedInventory.inventory_number}
              />
            </form>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={createConfirmOpen}
        onClose={() => {
          if (createConfirmSubmitting) return;
          setCreateConfirmOpen(false);
          setPendingCreateFormData(null);
          setCreateConfirmSummary(null);
        }}
        title="Confirm creation"
        description="Confirm the stock row below before it is saved."
        panelClassName="max-w-lg"
        backdropClassName="z-[60]"
      >
        {createConfirmSummary ? (
          <div className="space-y-4">
            <dl className="divide-y divide-[#245236]/15 rounded-lg border border-[#245236]/20">
              {createConfirmSummary.map(({ label, value }) => (
                <div
                  key={label}
                  className="grid grid-cols-1 gap-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,40%)_1fr] sm:gap-3"
                >
                  <dt className="text-xs font-medium text-[#245236]/70">{label}</dt>
                  <dd className="text-sm text-[#245236]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={createConfirmSubmitting}
                onClick={() => {
                  setCreateConfirmOpen(false);
                  setPendingCreateFormData(null);
                  setCreateConfirmSummary(null);
                }}
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[#245236]/30 bg-[#FEED01]/30 px-4 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/50 disabled:opacity-50"
              >
                Go back
              </button>
              <button
                type="button"
                disabled={createConfirmSubmitting}
                onClick={() => void handleConfirmCreateStock()}
                className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:opacity-60"
              >
                {createConfirmSubmitting ? "Creating…" : "Yes, create"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editingRow)}
        onClose={() => {
          setEditingId(null);
          setRowError(null);
        }}
        title="Edit stock item"
        description={
          editingRow?.stock_number?.trim()
            ? `Update stock row ${editingRow.stock_number}.`
            : "Update this stock row."
        }
        panelClassName="max-w-[1100px]"
      >
        {rowError ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {rowError}
          </p>
        ) : null}
        {editingRow ? (
          <form action={runUpdate} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={editingRow.id} />
            <StockFormFields
              mode="edit"
              values={editingRow}
              products={products}
              brands={brands}
              styles={styles}
              fabrics={fabrics}
              inventoryChoices={inventoryForStock}
              restrictEditToEmptyFields={allowRestrictedEdit && !canManage}
            />
            <div className="flex gap-2">
              <SubmitButton className="h-[38px] rounded-lg bg-[#245236] px-3 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:opacity-60">
                Save
              </SubmitButton>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setRowError(null);
                }}
                className="h-[38px] rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-3 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      {rowError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {rowError}
        </p>
      ) : null}

      {searchedInventoryNumber.trim() === "" ? (
        <div className="rounded-xl border border-dashed border-[#245236]/30 bg-white p-10 text-center text-sm text-[#245236]/70 shadow-sm">
          Search for an inventory number to view its details and the stock rows linked to it.
        </div>
      ) : !hasSearchResults ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          Nothing matches prefix{" "}
          <span className="font-medium">{searchedInventoryNumber}</span> (no inventory or stock rows starting with
          that text).
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm font-medium text-[#245236]">
                Prefix <span className="tabular-nums">{searchedInventoryNumber}</span>
                {matchingInventories.length > 1 ? (
                  <span className="ml-2 font-normal text-[#245236]/70">
                    ({matchingInventories.length} inventory matches)
                  </span>
                ) : null}
              </p>
              {matchingInventories.length > 1 ? (
                <label className="flex max-w-md flex-col gap-1 text-xs font-medium text-[#245236]/80">
                  Inventory number (choose row for details and Add new)
                  <select
                    value={activeInventoryNumber ?? matchingInventories[0]?.inventory_number ?? ""}
                    onChange={(e) => setActiveInventoryNumber(e.target.value)}
                    className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                  >
                    {matchingInventories.map((m) => (
                      <option key={m.inventory_number} value={m.inventory_number}>
                        {m.inventory_number}
                      </option>
                    ))}
                  </select>
                </label>
              ) : matchingInventories.length === 1 ? (
                <p className="text-xs text-[#245236]/80">
                  Inventory <span className="font-medium tabular-nums">{matchingInventories[0].inventory_number}</span>
                </p>
              ) : null}
              {selectedInventory ? (
                <InventoryContextReadonly context={selectedInventory} />
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  No inventory master row starts with this prefix; stock rows below still match your search.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setIsCreateOpen(true);
                }}
                disabled={selectedInventory == null}
                className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add new
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredStock.length === 0}
                className="rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-3 py-2 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#245236]/20 bg-white shadow-sm">
            {filteredStock.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">
                {selectedInventory
                  ? `No stock rows for inventory ${selectedInventory.inventory_number} yet.`
                  : "No stock rows start with this prefix yet."}
              </p>
            ) : (
              <>
                <div className="divide-y divide-[#245236]/15 md:hidden">
                  {filteredStock.map((row) => (
                    <article key={row.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-[#245236]/70">Stock #</p>
                          <p className="text-sm font-semibold text-[#245236]">
                            {row.stock_number ?? "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#245236]/70">Inventory #</p>
                          <p className="text-sm font-medium text-[#245236]">
                            {row.inventory_number ?? "—"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-[#245236]/70">Product</p>
                          <p className="text-[#245236]/85">
                            {productById.get(row.product ?? "")?.product_name?.trim() ||
                              productRowLabel(row)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#245236]/70">Brand</p>
                          <p className="text-[#245236]/85">{brandLabel(row.brand_name)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#245236]/70">Style</p>
                          <p className="text-[#245236]/85">
                            {styleById.get(row.style ?? "")?.style_name?.trim() || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#245236]/70">Fabric</p>
                          <p className="text-[#245236]/85">
                            {fabricById.get(row.Fabric ?? "")?.fabric_name?.trim() || "—"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-[#245236]/70">Pricing</p>
                          <p className="text-[#245236]/85">
                            C: {formatNumber(row.cost_price)} / S:{" "}
                            {formatNumber(row.selling_price)} / M: {formatNumber(row.mrp)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#245236]/70">Created</p>
                          <p className="text-[#245236]/85">{formatDate(row.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#245236]/70">Updated</p>
                          <p className="text-[#245236]/85">
                            {row.updated_at ? formatDate(row.updated_at) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        {canManage || allowRestrictedEdit ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRowError(null);
                                setEditingId(row.id);
                              }}
                              className="rounded-md px-2 py-1 text-xs font-medium text-[#245236] underline-offset-2 hover:underline"
                            >
                              Edit
                            </button>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => runDelete(row.id)}
                                disabled={deletingId === row.id}
                                className="rounded-md px-2 py-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                              >
                                {deletingId === row.id ? "Deleting..." : "Delete"}
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-[#245236]/70">View only</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="border-b border-[#245236]/20 bg-[#FEED01]/25 text-xs font-medium uppercase tracking-wide text-[#245236]/80">
                    <tr>
                      <th className="px-4 py-3">Stock #</th>
                      <th className="px-4 py-3">Inventory #</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Brand</th>
                      <th className="px-4 py-3">Style</th>
                      <th className="px-4 py-3">Fabric</th>
                      <th className="px-4 py-3">Pricing</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#245236]/15">
                    {filteredStock.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-[#FEED01]/20"
                      >
                        <>
                          <td className="px-4 py-3 font-medium text-[#245236]">
                            {row.stock_number ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-medium tabular-nums text-[#245236]/90">
                            {row.inventory_number ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-[#245236]/80">
                            {productById.get(row.product ?? "")?.product_name?.trim() ||
                              productRowLabel(row)}
                          </td>
                          <td className="px-4 py-3 text-[#245236]/80">
                            {brandLabel(row.brand_name)}
                          </td>
                          <td className="px-4 py-3 text-[#245236]/80">
                            {styleById.get(row.style ?? "")?.style_name?.trim() || "—"}
                          </td>
                          <td className="px-4 py-3 text-[#245236]/80">
                            {fabricById.get(row.Fabric ?? "")?.fabric_name?.trim() || "—"}
                          </td>
                          <td className="px-4 py-3 text-[#245236]/80">
                            C: {formatNumber(row.cost_price)} / S:{" "}
                            {formatNumber(row.selling_price)} / M: {formatNumber(row.mrp)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#245236]/80">
                            {formatDate(row.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#245236]/80">
                            {row.updated_at ? formatDate(row.updated_at) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {canManage || allowRestrictedEdit ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRowError(null);
                                    setEditingId(row.id);
                                  }}
                                  className="rounded-md px-2 py-1 text-xs font-medium text-[#245236] underline-offset-2 hover:underline"
                                >
                                  Edit
                                </button>
                                {canManage ? (
                                  <button
                                    type="button"
                                    onClick={() => runDelete(row.id)}
                                    disabled={deletingId === row.id}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                                  >
                                    {deletingId === row.id ? "Deleting..." : "Delete"}
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-[#245236]/70">
                                View only
                              </span>
                            )}
                          </td>
                        </>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitButton({
  children,
  className,
  loadingLabel = "Saving...",
}: {
  children: React.ReactNode;
  className?: string;
  loadingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? loadingLabel : children}
    </button>
  );
}

function InventoryContextReadonly({ context }: { context: InventoryStockContext }) {
  const fields: { label: string; value: string }[] = [
    { label: "Invoice number", value: context.invoice_number?.trim() || "—" },
    { label: "Invoice date", value: formatInvoiceDate(context.invoice_date) },
    { label: "Invoice amount", value: formatMoney(context.invoice_amount) },
    { label: "Company name", value: context.company_name?.trim() || "—" },
    { label: "Agent name", value: context.agent_name?.trim() || "—" },
  ];
  return (
    <div className="rounded-lg border border-[#245236]/20 bg-[#FEED01]/15 p-4">
      <p className="text-xs font-medium text-[#245236]/70">
        From inventory (read-only)
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[#245236]/70">
              {label}
            </dt>
            <dd className="mt-0.5 text-sm text-[#245236]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function stkHasStr(s: string | null | undefined) {
  return s != null && String(s).trim() !== "";
}

function stkHasNum(n: number | null | undefined) {
  return n != null;
}

const STOCK_SIZE_OPTIONS = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
] as const;

function inventoryDisplayLabel(
  num: string | null | undefined,
  choices: InventoryStockContext[],
): string {
  const n = num?.trim();
  if (!n) return "—";
  const c = choices.find((x) => x.inventory_number === n);
  if (c) {
    return `${c.inventory_number}${c.company_name?.trim() ? ` — ${c.company_name.trim()}` : ""}`;
  }
  return n;
}

function StockFormFields({
  mode,
  values,
  products,
  brands,
  styles,
  fabrics,
  inventoryChoices,
  lockedInventoryNumber,
  restrictEditToEmptyFields = false,
}: {
  mode: "create" | "edit";
  values?: StockRow;
  products: ProductOption[];
  brands: BrandOption[];
  styles: StyleOption[];
  fabrics: FabricOption[];
  inventoryChoices: InventoryStockContext[];
  lockedInventoryNumber?: string | null;
  restrictEditToEmptyFields?: boolean;
}) {
  const v = values;
  const inventoryLocked = mode === "create" && Boolean(lockedInventoryNumber?.trim());
  const ro = restrictEditToEmptyFields && mode === "edit" && v != null;

  const brandLocked = Boolean(ro && stkHasStr(v?.brand_name));
  const productLocked = Boolean(ro && stkHasStr(v?.product));
  const styleLocked = Boolean(ro && stkHasStr(v?.style));
  const fabricLocked = Boolean(ro && stkHasStr(v?.Fabric));

  const [brandId, setBrandId] = useState(v?.brand_name ?? "");

  const sortedProducts = useMemo(
    () =>
      [...products].sort((a, b) =>
        (a.product_name ?? "").localeCompare(b.product_name ?? "", undefined, {
          sensitivity: "base",
        }),
      ),
    [products],
  );

  useEffect(() => {
    if (v == null) {
      setBrandId("");
      return;
    }
    setBrandId(v.brand_name ?? "");
  }, [v?.id, v?.brand_name]);

  const selectClass =
    "rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2";
  const readOnlySelectClass = `${selectClass} cursor-not-allowed bg-[#FEED01]/25 text-[#245236]/85`;

  const lockedProduct = v?.product ? products.find((x) => x.id === v.product) : undefined;
  const productReadonlyLabel = lockedProduct
    ? lockedProduct.product_name?.trim() || "—"
    : "—";

  const brandReadonlyLabel = v?.brand_name
    ? brands.find((b) => b.id === v.brand_name)?.brand_name?.trim() ||
      v.brand_name
    : "—";

  const styleReadonlyLabel = v?.style
    ? styles.find((s) => s.id === v.style)?.style_name?.trim() || v.style
    : "—";

  const fabricReadonlyLabel = v?.Fabric
    ? fabrics.find((f) => f.id === v.Fabric)?.fabric_name?.trim() || v.Fabric
    : "—";

  const sizeRawTrimmed = v?.size?.trim() ?? "";
  const sizeUpper = sizeRawTrimmed ? sizeRawTrimmed.toUpperCase() : "";
  const sizeInCatalog =
    Boolean(sizeUpper) && (STOCK_SIZE_OPTIONS as readonly string[]).includes(sizeUpper);
  const sizeSelectDefault = !sizeRawTrimmed ? "" : sizeInCatalog ? sizeUpper : sizeRawTrimmed;

  return (
    <div className="flex w-full flex-col gap-4">
      {ro ? (
        <p className="w-full max-w-2xl rounded-md border border-[#245236]/20 bg-[#FEED01]/15 px-3 py-2 text-xs text-[#245236]/80">
          Fields that already have a value are read-only. You can only fill in empty fields.
        </p>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        {inventoryLocked ? (
          <input type="hidden" name="inventory_number" value={lockedInventoryNumber!} />
        ) : null}
        <FormInput
          name="stock_number"
          label="Stock number"
          value={v?.stock_number}
          placeholder="STK-001"
          readOnly={ro && stkHasStr(v?.stock_number)}
        />
        {inventoryLocked ? (
          <ReadonlyFormField
            label="Inventory"
            value={inventoryDisplayLabel(lockedInventoryNumber, inventoryChoices)}
          />
        ) : ro && stkHasStr(v?.inventory_number) ? (
          <>
            <input type="hidden" name="inventory_number" value={v?.inventory_number ?? ""} />
            <ReadonlyFormField
              label="Inventory"
              value={inventoryDisplayLabel(v?.inventory_number, inventoryChoices)}
            />
          </>
        ) : (
          <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
            Inventory
            <select
              name="inventory_number"
              className={selectClass}
              defaultValue={v?.inventory_number ?? ""}
              required
            >
              <option value="">Select inventory</option>
              {inventoryChoices.map((inv) => (
                <option key={inv.inventory_number} value={inv.inventory_number}>
                  {inventoryDisplayLabel(inv.inventory_number, [inv])}
                </option>
              ))}
              {v?.inventory_number?.trim() &&
              !inventoryChoices.some((c) => c.inventory_number === v.inventory_number?.trim()) ? (
                <option value={v.inventory_number.trim()}>
                  {v.inventory_number.trim()} (not in list)
                </option>
              ) : null}
            </select>
          </label>
        )}

        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
          Brand
          {brandLocked ? (
            <>
              <input type="hidden" name="brand_name" value={v?.brand_name ?? ""} />
              <div className={readOnlySelectClass}>{brandReadonlyLabel}</div>
            </>
          ) : (
            <select
              name="brand_name"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={selectClass}
              required={!productLocked}
            >
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brand_name?.trim() ? b.brand_name : b.id}
                </option>
              ))}
            </select>
          )}
        </label>

        {productLocked ? (
          <>
            <input type="hidden" name="stock_product_locked" value="1" />
            <input type="hidden" name="product_id" value={v?.product ?? ""} />
            {!brandLocked ? (
              <input type="hidden" name="brand_name" value={v?.brand_name ?? ""} />
            ) : null}
            <ReadonlyFormField label="Product" value={productReadonlyLabel} />
          </>
        ) : (
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
            Product
            <select
              name="product"
              className={selectClass}
              defaultValue={v?.product ?? ""}
              required
            >
              <option value="">Select product</option>
              {sortedProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name?.trim() ? p.product_name : p.id}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
          Style
          {styleLocked ? (
            <>
              <input type="hidden" name="style" value={v?.style ?? ""} />
              <div className={readOnlySelectClass}>{styleReadonlyLabel}</div>
            </>
          ) : (
            <select name="style" className={selectClass} defaultValue={v?.style ?? ""}>
              <option value="">—</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.style_name?.trim() ? s.style_name : s.id}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
          Fabric
          {fabricLocked ? (
            <>
              <input type="hidden" name="Fabric" value={v?.Fabric ?? ""} />
              <div className={readOnlySelectClass}>{fabricReadonlyLabel}</div>
            </>
          ) : (
            <select name="Fabric" className={selectClass} defaultValue={v?.Fabric ?? ""}>
              <option value="">—</option>
              {fabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.fabric_name?.trim() ? f.fabric_name : f.id}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
          Size
          {ro && stkHasStr(v?.size) ? (
            <>
              <input type="hidden" name="size" value={v?.size ?? ""} />
              <div className={readOnlySelectClass}>{v?.size ?? "—"}</div>
            </>
          ) : (
            <select name="size" className={selectClass} defaultValue={sizeSelectDefault}>
              <option value="">—</option>
              {STOCK_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {sizeRawTrimmed && !sizeInCatalog ? (
                <option value={sizeRawTrimmed}>{sizeRawTrimmed} (custom)</option>
              ) : null}
            </select>
          )}
        </label>
        <FormInput
          name="pieces"
          label="Pieces"
          value={toText(v?.pieces)}
          placeholder="20"
          inputMode="numeric"
          readOnly={ro && stkHasNum(v?.pieces)}
        />
        <FormInput
          name="HSN_code"
          label="HSN code"
          value={v?.HSN_code}
          placeholder="6109"
          readOnly={ro && stkHasStr(v?.HSN_code)}
        />
        <FormInput
          name="GST_group"
          label="GST group"
          value={v?.GST_group}
          placeholder="12%"
          readOnly={ro && stkHasStr(v?.GST_group)}
        />
        <FormInput
          name="cost_price"
          label="Cost price"
          value={toText(v?.cost_price)}
          placeholder="150"
          inputMode="decimal"
          readOnly={ro && stkHasNum(v?.cost_price)}
        />
        <FormInput
          name="selling_price"
          label="Selling price"
          value={toText(v?.selling_price)}
          placeholder="250"
          inputMode="decimal"
          readOnly={ro && stkHasNum(v?.selling_price)}
        />
        <FormInput
          name="mrp"
          label="MRP"
          value={toText(v?.mrp)}
          placeholder="299"
          inputMode="decimal"
          readOnly={ro && stkHasNum(v?.mrp)}
        />

        {mode === "create" ? (
          <SubmitButton
            loadingLabel="Creating..."
            className="h-[42px] rounded-lg bg-[#245236] px-5 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:opacity-60"
          >
            Create
          </SubmitButton>
        ) : null}
      </div>

      {mode === "edit" && v ? (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ReadonlyFormField label="Created at" value={formatDate(v.created_at)} />
          <ReadonlyFormField label="Updated at" value={v.updated_at ? formatDate(v.updated_at) : "—"} />
          <ReadonlyFormField label="Stock row id" value={v.id} />
        </div>
      ) : null}
    </div>
  );
}

function ReadonlyFormField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
      {label}
      <div
        className="rounded-lg border border-[#245236]/20 bg-[#FEED01]/20 px-3 py-2 text-sm text-[#245236]/85"
        aria-readonly="true"
      >
        {value}
      </div>
    </div>
  );
}

function FormInput({
  name,
  label,
  value,
  placeholder,
  inputMode,
  readOnly = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  readOnly?: boolean;
}) {
  return (
    <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
      {label}
      <input
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        defaultValue={value ?? ""}
        readOnly={readOnly}
        className={
          readOnly
            ? "cursor-not-allowed rounded-lg border border-[#245236]/20 bg-[#FEED01]/20 px-3 py-2 text-sm text-[#245236]/85 outline-none"
            : "rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
        }
        placeholder={placeholder}
      />
    </label>
  );
}

function toText(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function formatNumber(value: number | null) {
  return value == null ? "—" : value.toString();
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatInvoiceDate(value: string | null) {
  if (!value?.trim()) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  } catch {
    return value;
  }
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  } catch {
    return String(value);
  }
}

function toCsvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}