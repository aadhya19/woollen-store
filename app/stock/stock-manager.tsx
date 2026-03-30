"use client";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createStock, deleteStock, updateStock } from "./actions";
import Modal from "@/app/components/Modal";
import type { BrandOption, InventoryStockContext, ProductOption, StockRow } from "./types";

type Props = {
  stock: StockRow[];
  products: ProductOption[];
  brands: BrandOption[];
  inventoryForStock: InventoryStockContext[];
  canManage: boolean;
  allowRestrictedEdit?: boolean;
};

const DRAFT_NEW_SENTINEL = "__new__";

function cloneFormData(source: FormData): FormData {
  const fd = new FormData();
  for (const [key, val] of source.entries()) {
    fd.append(key, val);
  }
  return fd;
}

function draftDisplayFromForm(
  fd: FormData,
  selectName: string,
  customName: string,
): string {
  const sel = fd.get(selectName)?.toString() ?? "";
  if (sel === DRAFT_NEW_SENTINEL) {
    const c = fd.get(customName)?.toString().trim() ?? "";
    return c || "—";
  }
  if (!sel.trim()) return "—";
  return sel.trim();
}

function buildCreateStockSummary(
  fd: FormData,
  brands: BrandOption[],
): { label: string; value: string }[] {
  const brandId = fd.get("brand_name")?.toString().trim() ?? "";
  const brandName =
    brands.find((b) => b.id === brandId)?.brand_name?.trim() || brandId || "—";

  const productName = draftDisplayFromForm(fd, "draft_product_name", "draft_product_name_custom");
  const productDesc = draftDisplayFromForm(
    fd,
    "draft_product_description",
    "draft_product_description_custom",
  );
  const style = draftDisplayFromForm(fd, "draft_style", "draft_style_custom");
  const fabric = draftDisplayFromForm(fd, "draft_fabric", "draft_fabric_custom");

  const emptyToDash = (v: FormDataEntryValue | null) => {
    const s = v?.toString().trim();
    return s ? s : "—";
  };

  return [
    { label: "Brand", value: brandName },
    { label: "Product name", value: productName },
    { label: "Product description", value: productDesc },
    { label: "Style", value: style },
    { label: "Fabric", value: fabric },
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

  const brandLabel = (brandId: string | null | undefined) => {
    if (!brandId?.trim()) return "—";
    const p = products.find((x) => x.brand_id === brandId);
    if (p?.brand_label?.trim()) return p.brand_label;
    return brandId;
  };

  const productRowLabel = (row: StockRow) => {
    const pid = row.product;
    if (!pid?.trim()) return "—";
    const p = productById.get(pid);
    if (!p) return pid;
    return `${p.product_name ?? "Unnamed"} (${p.brand_label ?? "No brand"})`;
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
      setFormError("Select a brand first.");
      return;
    }
    const name = draftDisplayFromForm(fd, "draft_product_name", "draft_product_name_custom");
    if (name === "—") {
      setFormError("Product name is required (choose or enter a name).");
      return;
    }
    setFormError(null);
    setPendingCreateFormData(cloneFormData(fd));
    setCreateConfirmSummary(buildCreateStockSummary(fd, brands));
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

    /** Aligns with ItemMaster-style sheet: description / style / fabric from Products via `product` FK. */
    const columns = [
      "Stock No",
      "Item Description",
      "Product",
      "Brand",
      "HSN Code",
      "GST Group",
      "Cost Price",
      "Selling Price",
      "Retail Price",
      "STYLE",
      "Fabric/ Yarn",
      "Size",
    ];

    const csvRows = filteredStock.map((row) => {
      const p = productById.get(row.product ?? "");
      const productName = p?.product_name?.trim() || productRowLabel(row);
      const desc = p?.product_description?.trim() ?? "";
      const style = p?.style?.trim() ?? "";
      const fabric = p?.fabric?.trim() ?? "";
      return [
        row.stock_number,
        desc,
        productName,
        brandLabel(row.brand_name),
        row.HSN_code,
        row.GST_group,
        row.cost_price,
        row.selling_price,
        row.mrp,
        style,
        fabric,
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
        description="Are you sure you want to create this stock row with the product details below? If this name, description, style, and fabric combination is new for the brand, a product will be created automatically."
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-b border-[#245236]/20 bg-[#FEED01]/25 text-xs font-medium uppercase tracking-wide text-[#245236]/80">
                    <tr>
                      <th className="px-4 py-3">Stock #</th>
                      <th className="px-4 py-3">Inventory #</th>
                      <th className="px-4 py-3">Product name</th>
                      <th className="px-4 py-3">Brand</th>
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
                        {(canManage || allowRestrictedEdit) && editingId === row.id ? (
                          <td colSpan={8} className="px-4 py-3">
                            <form action={runUpdate} className="space-y-3">
                              <input type="hidden" name="id" value={row.id} />
                              <StockFormFields
                                mode="edit"
                                values={row}
                                products={products}
                                brands={brands}
                                restrictEditToEmptyFields={
                                  allowRestrictedEdit && !canManage
                                }
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
                          </td>
                        ) : (
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
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

function productOptionLabel(p: ProductOption) {
  return `${p.product_name ?? "Unnamed"} (${p.brand_label ?? "No brand"})`;
}

const DRAFT_NEW = "__new__";

/** One entry per distinct non-empty string (no duplicate labels in the dropdown). */
function uniqueSortedValues(
  brandProducts: ProductOption[],
  key: "product_name" | "product_description" | "style" | "fabric",
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of brandProducts) {
    const s = (p[key]?.trim() ?? "");
    if (s === "") continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function initDraftSelect(
  raw: string | null | undefined,
  options: string[],
): { sel: string; custom: string } {
  const t = raw?.trim() ?? "";
  if (!t) return { sel: "", custom: "" };
  if (options.includes(t)) return { sel: t, custom: "" };
  return { sel: DRAFT_NEW, custom: t };
}

function DraftComboSelect({
  label,
  options,
  value,
  onValueChange,
  customValue,
  onCustomChange,
  disabled,
  selectName,
  customName,
  selectClass,
  placeholder,
}: {
  label: string;
  options: string[];
  value: string;
  onValueChange: (next: string) => void;
  customValue: string;
  onCustomChange: (next: string) => void;
  disabled?: boolean;
  selectName: string;
  customName: string;
  selectClass: string;
  placeholder?: string;
}) {
  const showCustom = value === DRAFT_NEW;
  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
      {label}
      <select
        name={selectName}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={selectClass}
      >
        <option value="">{placeholder ?? "—"}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={DRAFT_NEW}>New…</option>
      </select>
      {showCustom ? (
        <input
          name={customName}
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          autoComplete="off"
          placeholder="Type value"
          className="mt-1 rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
        />
      ) : null}
    </div>
  );
}

function StockFormFields({
  mode,
  values,
  products,
  brands,
  lockedInventoryNumber,
  restrictEditToEmptyFields = false,
}: {
  mode: "create" | "edit";
  values?: StockRow;
  products: ProductOption[];
  brands: BrandOption[];
  lockedInventoryNumber?: string | null;
  restrictEditToEmptyFields?: boolean;
}) {
  const v = values;
  const inventoryLocked = mode === "create" && Boolean(lockedInventoryNumber?.trim());
  const ro = restrictEditToEmptyFields && mode === "edit" && v != null;

  const brandLocked = Boolean(ro && stkHasStr(v?.brand_name));
  const productLocked = Boolean(ro && stkHasStr(v?.product));

  const [brandId, setBrandId] = useState(v?.brand_name ?? "");
  const [draftName, setDraftName] = useState("");
  const [draftNameCustom, setDraftNameCustom] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftDescCustom, setDraftDescCustom] = useState("");
  const [draftStyle, setDraftStyle] = useState("");
  const [draftStyleCustom, setDraftStyleCustom] = useState("");
  const [draftFabric, setDraftFabric] = useState("");
  const [draftFabricCustom, setDraftFabricCustom] = useState("");

  const filterBrandId = brandLocked ? (v?.brand_name ?? "") : brandId;
  const productsForBrand = useMemo(() => {
    if (!filterBrandId.trim()) return [];
    return products.filter((p) => p.brand_id === filterBrandId);
  }, [products, filterBrandId]);

  const nameOptions = useMemo(
    () => uniqueSortedValues(productsForBrand, "product_name"),
    [productsForBrand],
  );
  const descOptions = useMemo(
    () => uniqueSortedValues(productsForBrand, "product_description"),
    [productsForBrand],
  );
  const styleOptions = useMemo(
    () => uniqueSortedValues(productsForBrand, "style"),
    [productsForBrand],
  );
  const fabricOptions = useMemo(
    () => uniqueSortedValues(productsForBrand, "fabric"),
    [productsForBrand],
  );

  useEffect(() => {
    if (v == null) {
      setBrandId("");
      setDraftName("");
      setDraftNameCustom("");
      setDraftDesc("");
      setDraftDescCustom("");
      setDraftStyle("");
      setDraftStyleCustom("");
      setDraftFabric("");
      setDraftFabricCustom("");
      return;
    }
    setBrandId(v.brand_name ?? "");
    const list =
      v.brand_name?.trim() ?
        products.filter((p) => p.brand_id === v.brand_name)
      : [];
    const p = v.product ? products.find((x) => x.id === v.product) : undefined;
    const nOpts = uniqueSortedValues(list, "product_name");
    const dOpts = uniqueSortedValues(list, "product_description");
    const sOpts = uniqueSortedValues(list, "style");
    const fOpts = uniqueSortedValues(list, "fabric");
    const n = initDraftSelect(p?.product_name, nOpts);
    const d = initDraftSelect(p?.product_description, dOpts);
    const s = initDraftSelect(p?.style, sOpts);
    const f = initDraftSelect(p?.fabric, fOpts);
    setDraftName(n.sel);
    setDraftNameCustom(n.custom);
    setDraftDesc(d.sel);
    setDraftDescCustom(d.custom);
    setDraftStyle(s.sel);
    setDraftStyleCustom(s.custom);
    setDraftFabric(f.sel);
    setDraftFabricCustom(f.custom);
  }, [v?.id, v?.brand_name, v?.product, products]);

  useEffect(() => {
    if (v != null) return;
    setDraftName("");
    setDraftNameCustom("");
    setDraftDesc("");
    setDraftDescCustom("");
    setDraftStyle("");
    setDraftStyleCustom("");
    setDraftFabric("");
    setDraftFabricCustom("");
  }, [brandId, v]);

  function clearProductDrafts() {
    setDraftName("");
    setDraftNameCustom("");
    setDraftDesc("");
    setDraftDescCustom("");
    setDraftStyle("");
    setDraftStyleCustom("");
    setDraftFabric("");
    setDraftFabricCustom("");
  }

  const hasBrand = filterBrandId.trim() !== "";
  const showProductDrafts = hasBrand && !productLocked;

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
          <ReadonlyFormField label="Inventory number" value={lockedInventoryNumber!} />
        ) : (
          <FormInput
            name="inventory_number"
            label="Inventory number"
            value={v?.inventory_number}
            placeholder="ITRY-001"
            readOnly={ro && stkHasStr(v?.inventory_number)}
          />
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
              onChange={(e) => {
                const next = e.target.value;
                setBrandId(next);
                if (v != null && !brandLocked) clearProductDrafts();
              }}
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
            <ReadonlyFormField label="Product name" value={productReadonlyLabel} />
            <ReadonlyFormField
              label="Product description"
              value={lockedProduct?.product_description?.trim() || "—"}
            />
            <ReadonlyFormField label="Style" value={lockedProduct?.style?.trim() || "—"} />
            <ReadonlyFormField label="Fabric" value={lockedProduct?.fabric?.trim() || "—"} />
          </>
        ) : null}

        {showProductDrafts ? (
          <>
            <DraftComboSelect
              label="Product name"
              options={nameOptions}
              value={draftName}
              onValueChange={setDraftName}
              customValue={draftNameCustom}
              onCustomChange={setDraftNameCustom}
              selectName="draft_product_name"
              customName="draft_product_name_custom"
              selectClass={selectClass}
              placeholder="Select name"
            />
            <DraftComboSelect
              label="Product description"
              options={descOptions}
              value={draftDesc}
              onValueChange={setDraftDesc}
              customValue={draftDescCustom}
              onCustomChange={setDraftDescCustom}
              selectName="draft_product_description"
              customName="draft_product_description_custom"
              selectClass={selectClass}
            />
            <DraftComboSelect
              label="Style"
              options={styleOptions}
              value={draftStyle}
              onValueChange={setDraftStyle}
              customValue={draftStyleCustom}
              onCustomChange={setDraftStyleCustom}
              selectName="draft_style"
              customName="draft_style_custom"
              selectClass={selectClass}
            />
            <DraftComboSelect
              label="Fabric"
              options={fabricOptions}
              value={draftFabric}
              onValueChange={setDraftFabric}
              customValue={draftFabricCustom}
              onCustomChange={setDraftFabricCustom}
              selectName="draft_fabric"
              customName="draft_fabric_custom"
              selectClass={selectClass}
            />
          </>
        ) : !productLocked ? (
          <p className="w-full text-xs text-[#245236]/70">
            Select a brand to choose product name, description, style, and fabric. If this combination is new, a
            product row will be created automatically.
          </p>
        ) : null}

        <FormInput name="size" label="Size" value={v?.size} placeholder="M" readOnly={ro && stkHasStr(v?.size)} />
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