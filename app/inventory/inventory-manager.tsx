"use client";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createInventory,
  deleteInventory,
  updateInventory,
} from "./actions";
import Modal from "@/app/components/Modal";
import type {
  AgentLookupRow,
  InventoryRow,
  ProductLookupRow,
  TransportLookupRow,
  UserLookupRow,
} from "./types";

type Props = {
  inventories: InventoryRow[];
  items: ProductLookupRow[];
  agents: AgentLookupRow[];
  transports: TransportLookupRow[];
  users: UserLookupRow[];
  canManage: boolean;
  /** Employee: can edit existing rows but only fields that are still empty (server enforces). */
  allowRestrictedEdit?: boolean;
};

function cloneFormData(source: FormData): FormData {
  const fd = new FormData();
  for (const [key, val] of source.entries()) {
    fd.append(key, val);
  }
  return fd;
}

function fdCell(v: FormDataEntryValue | null | undefined): string {
  if (v == null) return "—";
  if (v instanceof File) return v.size > 0 ? v.name : "—";
  const t = String(v).trim();
  return t ? t : "—";
}

function buildCreateInventorySummary(
  fd: FormData,
  lookups: {
    agentLabel: (id: string | null) => string;
    transportLabel: (id: string | null) => string;
    userLabel: (id: string | null) => string;
    itemLabel: (id: string | null) => string;
  },
): { label: string; value: string }[] {
  const idOrNull = (key: string) => {
    const s = fd.get(key)?.toString().trim();
    return s ? s : null;
  };
  const agentId = idOrNull("agent_name");
  const transportId = idOrNull("transport_name");
  const staffId = idOrNull("staff_name");
  const itemId = idOrNull("item_name");

  return [
    { label: "Inventory number", value: fdCell(fd.get("inventory_number")) },
    { label: "Company name", value: fdCell(fd.get("company_name")) },
    { label: "Agent", value: agentId ? lookups.agentLabel(agentId) : "—" },
    { label: "Transport", value: transportId ? lookups.transportLabel(transportId) : "—" },
    { label: "Waybill number", value: fdCell(fd.get("waybill_number")) },
    { label: "Transport charges", value: fdCell(fd.get("transport_charges")) },
    { label: "Date of entry", value: fdCell(fd.get("date_of_entry")) },
    { label: "Loading charges", value: fdCell(fd.get("loading_charges")) },
    { label: "Staff", value: staffId ? lookups.userLabel(staffId) : "—" },
    { label: "Location", value: fdCell(fd.get("location")) },
    { label: "Invoice number", value: fdCell(fd.get("invoice_number")) },
    { label: "Item", value: itemId ? lookups.itemLabel(itemId) : "—" },
    { label: "Billed quantity", value: fdCell(fd.get("billed_quantity")) },
    { label: "Received quantity", value: fdCell(fd.get("received_quantity")) },
    { label: "Tallying", value: fdCell(fd.get("tallying")) },
    { label: "Pricing", value: fdCell(fd.get("pricing")) },
    { label: "Stickering", value: fdCell(fd.get("stickering")) },
    { label: "Supply", value: fdCell(fd.get("supply")) },
    { label: "Stock note", value: fdCell(fd.get("stock_note")) },
    { label: "Invoice amount", value: fdCell(fd.get("invoice_amount")) },
    { label: "Invoice date", value: fdCell(fd.get("invoice_date")) },
    { label: "Invoice image (file)", value: fdCell(fd.get("invoice_image_file")) },
    { label: "Invoice PDF (file)", value: fdCell(fd.get("invoice_pdf_file")) },
    { label: "Payment details", value: fdCell(fd.get("payment_details")) },
    { label: "Payment mode", value: fdCell(fd.get("payment_mode")) },
    { label: "Payment status", value: fdCell(fd.get("payment_status")) },
    { label: "Debit note", value: fdCell(fd.get("debit_note")) },
    { label: "Comments", value: fdCell(fd.get("comments")) },
  ];
}

export function InventoryManager({
  inventories,
  items,
  agents,
  transports,
  users,
  canManage,
  allowRestrictedEdit = false,
}: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [, startDelete] = useTransition();
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [pendingCreateFormData, setPendingCreateFormData] = useState<FormData | null>(null);
  const [createConfirmSummary, setCreateConfirmSummary] = useState<
    { label: string; value: string }[] | null
  >(null);
  const [createConfirmSubmitting, setCreateConfirmSubmitting] = useState(false);

  const editingRow = editingId
    ? (inventories.find((r) => r.id === editingId) ?? null)
    : null;
  const isEditModalOpen = editingRow != null;

  const agentLabel = (agentId: string | null) => {
    if (!agentId) return "—";
    const a = agents.find((x) => x.id === agentId);
    return a?.agent_name?.trim() ? a.agent_name : a?.id ?? agentId;
  };

  const transportLabel = (transportId: string | null) => {
    if (!transportId) return "—";
    const t = transports.find((x) => x.id === transportId);
    return t?.transport_name?.trim() ? t.transport_name : t?.id ?? transportId;
  };

  const userLabel = (userId: string | null) => {
    if (!userId) return "—";
    const u = users.find((x) => x.id === userId);
    return u?.name?.trim() ? u.name : u?.id ?? userId;
  };

  const itemLabel = (itemId: string | null) => {
    if (!itemId) return "—";
    const it = items.find((x) => x.id === itemId);
    return it?.product_name?.trim() ? it.product_name : it?.id ?? itemId;
  };

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
    setFormError(null);
    setPendingCreateFormData(cloneFormData(fd));
    setCreateConfirmSummary(
      buildCreateInventorySummary(fd, {
        agentLabel,
        transportLabel,
        userLabel,
        itemLabel,
      }),
    );
    setCreateConfirmOpen(true);
  }

  async function handleConfirmCreateInventory() {
    if (!pendingCreateFormData) return;
    setCreateConfirmSubmitting(true);
    setFormError(null);
    try {
      const r = await createInventory(pendingCreateFormData);
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
      (document.getElementById("create-inventory-form") as HTMLFormElement)?.reset();
    } finally {
      setCreateConfirmSubmitting(false);
    }
  }

  async function runUpdate(formData: FormData) {
    setRowError(null);
    const r = await updateInventory(formData);
    if (r.error) {
      setRowError(r.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  function runDelete(id: string) {
    setRowError(null);
    startDelete(async () => {
      const r = await deleteInventory(id);
      if (r.error) {
        setRowError(r.error);
        return;
      }
      if (editingId === id) setEditingId(null);
      router.refresh();
    });
  }

  const listSearchLower = listSearch.trim().toLowerCase();

  const filteredInventories =
    listSearchLower.length === 0
      ? inventories
      : inventories.filter((row) =>
          inventoryRowMatchesLikeSearch(row, listSearchLower, {
            agentLabel,
            transportLabel,
            userLabel,
            itemLabel,
          }),
        );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#245236]/75">
          {inventories.length === 0
            ? "No inventory rows yet."
            : listSearchLower
              ? `Showing ${filteredInventories.length} of ${inventories.length} row${inventories.length === 1 ? "" : "s"} matching your search.`
              : `${inventories.length} inventory row${inventories.length === 1 ? "" : "s"} in the list.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setRowError(null);
            setEditingId(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
        >
          Add new
        </button>
      </div>

      <Modal
        open={isCreateOpen}
        onClose={closeCreateModal}
        title="Add inventory"
        description="Create a new inventory row."
        panelClassName="max-w-[1100px]"
      >
        {formError ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {formError}
          </p>
        ) : null}

        <form
          id="create-inventory-form"
          onSubmit={handleCreateFormSubmit}
          className="mt-4"
        >
          <InventoryFormFields
            mode="create"
            values={undefined}
            agents={agents}
            transports={transports}
            users={users}
            items={items}
          />
        </form>
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
        description="Review the values below. Click Yes, create to save this inventory row (including any invoice file uploads)."
        panelClassName="max-w-lg"
        backdropClassName="z-[60]"
      >
        {createConfirmSummary ? (
          <div className="space-y-4">
            <dl className="max-h-[min(60vh,28rem)] divide-y divide-[#245236]/15 overflow-y-auto rounded-lg border border-[#245236]/20">
              {createConfirmSummary.map(({ label, value }) => (
                <div
                  key={label}
                  className="grid grid-cols-1 gap-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,42%)_1fr] sm:gap-3"
                >
                  <dt className="text-xs font-medium text-[#245236]/70">{label}</dt>
                  <dd className="break-words text-sm text-[#245236]">{value}</dd>
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
                onClick={() => void handleConfirmCreateInventory()}
                className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:opacity-60"
              >
                {createConfirmSubmitting ? "Creating…" : "Yes, create"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={isEditModalOpen}
        onClose={() => {
          setEditingId(null);
          setRowError(null);
        }}
        title="Edit inventory"
        description={
          editingRow
            ? `Update this inventory row${
                editingRow.inventory_number
                  ? ` (${editingRow.inventory_number})`
                  : ""
              }.`
            : undefined
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
          <form
            key={editingRow.id}
            id="edit-inventory-form"
            action={runUpdate}
            className="mt-4 space-y-3"
          >
            <input type="hidden" name="id" value={editingRow.id} />
            <InventoryFormFields
              mode="edit"
              values={editingRow}
              agents={agents}
              transports={transports}
              users={users}
              items={items}
              restrictEditToEmptyFields={allowRestrictedEdit && !canManage}
            />
            <div className="flex flex-wrap gap-2 pt-2">
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

      {rowError && !isEditModalOpen ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {rowError}
        </p>
      ) : null}

      {inventories.length > 0 ? (
        <section className="rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#245236]/80">
            Search inventory list
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                autoComplete="off"
                placeholder="Search across inventory #, company, transport, agent, waybill, dates, staff, location, invoice, item, payment…"
                className="min-w-0 flex-1 rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
              />
              {listSearch.trim() ? (
                <button
                  type="button"
                  onClick={() => setListSearch("")}
                  className="shrink-0 rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-3 py-2 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </label>
        </section>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#245236]/20 bg-white shadow-sm">
        {inventories.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            No inventory rows yet.
          </p>
        ) : filteredInventories.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            No rows match <span className="font-medium text-[#245236]">&quot;{listSearch.trim()}&quot;</span>.
            Try a shorter or different term, or clear the search.
          </p>
        ) : (
          <>
            <div className="divide-y divide-[#245236]/15 md:hidden">
              {filteredInventories.map((row) => (
                <article key={row.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#245236]/70">Inventory #</p>
                      <p className="text-sm font-semibold text-[#245236]">
                        {row.inventory_number ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#245236]/70">Company</p>
                      <p className="text-sm text-[#245236]/85">{row.company_name ?? "—"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-[#245236]/70">Agent</p>
                      <p className="text-[#245236]/85">{agentLabel(row.agent_name)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#245236]/70">Transport</p>
                      <p className="text-[#245236]/85">{transportLabel(row.transport_name)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#245236]/70">Invoice #</p>
                      <p className="text-[#245236]/85">{row.invoice_number ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#245236]/70">Item</p>
                      <p className="text-[#245236]/85">{itemLabel(row.item_name)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#245236]/70">Entry date</p>
                      <p className="text-[#245236]/85">{row.date_of_entry ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#245236]/70">Location</p>
                      <p className="text-[#245236]/85">{row.location ?? "—"}</p>
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
                            setFormError(null);
                            closeCreateModal();
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
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                          >
                            Delete
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
              <table className="w-full min-w-[2800px] text-left text-sm">
              <thead className="border-b border-[#245236]/20 bg-[#FEED01]/25 text-xs font-medium uppercase tracking-wide text-[#245236]/80">
                <tr>
                  <th className="px-4 py-3">Inventory #</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Transport</th>
                  <th className="px-4 py-3">Waybill</th>
                  <th className="px-4 py-3">Trans. charges</th>
                  <th className="px-4 py-3">Entry date</th>
                  <th className="px-4 py-3">Loading ch.</th>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Billed qty</th>
                  <th className="px-4 py-3">Received qty</th>
                  <th className="px-4 py-3">Tallying</th>
                  <th className="px-4 py-3">Pricing</th>
                  <th className="px-4 py-3">Stickering</th>
                  <th className="px-4 py-3">Supply</th>
                  <th className="px-4 py-3">Stock note</th>
                  <th className="px-4 py-3">Inv. amount</th>
                  <th className="px-4 py-3">Inv. date</th>
                  <th className="px-4 py-3">Inv. image</th>
                  <th className="px-4 py-3">Inv. PDF</th>
                  <th className="px-4 py-3">Pay details</th>
                  <th className="px-4 py-3">Pay mode</th>
                  <th className="px-4 py-3">Pay status</th>
                  <th className="px-4 py-3">Debit note</th>
                  <th className="px-4 py-3">Comments</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#245236]/15">
                {filteredInventories.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#FEED01]/20"
                  >
                    <td className="px-4 py-3 font-medium tabular-nums text-[#245236]">
                          {row.inventory_number ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#245236]">
                          {row.company_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {agentLabel(row.agent_name)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {transportLabel(row.transport_name)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.waybill_number ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {formatMaybeNumber(row.transport_charges)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.date_of_entry ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {formatMaybeNumber(row.loading_charges)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {userLabel(row.staff_name)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.location ?? "—"}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-[#245236]/80">
                          {row.invoice_number ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {itemLabel(row.item_name)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.billed_quantity ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.received_quantity ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.tallying ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.pricing ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.stickering ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.supply ?? "—"}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-[#245236]/80">
                          {previewText(row.stock_note)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {formatMaybeNumber(row.invoice_amount)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.invoice_date ?? "—"}
                        </td>
                        <td className="max-w-[120px] truncate px-4 py-3 text-[#245236]/80">
                          {previewText(row.invoice_image_url)}
                        </td>
                        <td className="max-w-[120px] truncate px-4 py-3 text-[#245236]/80">
                          {previewText(row.invoice_pdf_url)}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-[#245236]/80">
                          {previewText(row.payment_details)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.payment_mode ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.payment_status ?? "—"}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-[#245236]/80">
                          {previewText(row.debit_note)}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-[#245236]/80">
                          {previewText(row.comments)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-4 py-3 text-[#245236]/80">
                          {row.updated_at ? formatDate(row.updated_at) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManage || allowRestrictedEdit ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormError(null);
                                  closeCreateModal();
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
                                  className="rounded-md px-2 py-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-[#245236]/70">
                              View only
                            </span>
                          )}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const fieldLabelClass =
  "flex w-full max-w-2xl flex-col gap-1 text-xs font-medium text-[#245236]/80";
const fieldInputClass =
  "w-full rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2";
const fieldReadOnlyClass = `${fieldInputClass} cursor-not-allowed bg-[#FEED01]/20 text-[#245236]/85`;
const fileInputClass = `${fieldInputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[#245236] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#FEED01] hover:file:bg-[#1c3f2a]`;

function invHasStr(s: string | null | undefined) {
  return s != null && String(s).trim() !== "";
}

function invHasNum(n: number | null | undefined) {
  return n != null;
}

function invHasQty(q: string | number | null | undefined) {
  if (q == null) return false;
  if (typeof q === "string") return q.trim() !== "";
  return true;
}

function LockedSelectValue({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className={fieldReadOnlyClass}>{label}</div>
    </>
  );
}

function InventoryFormFields({
  mode,
  values,
  agents,
  transports,
  users,
  items,
  restrictEditToEmptyFields = false,
}: {
  mode: "create" | "edit";
  values?: InventoryRow;
  agents: AgentLookupRow[];
  transports: TransportLookupRow[];
  users: UserLookupRow[];
  items: ProductLookupRow[];
  restrictEditToEmptyFields?: boolean;
}) {
  const v = values;
  const ro = restrictEditToEmptyFields && mode === "edit" && v != null;

  return (
    <div className="flex w-full flex-col gap-4">
      {ro ? (
        <p className="max-w-2xl rounded-md border border-[#245236]/20 bg-[#FEED01]/15 px-3 py-2 text-xs text-[#245236]/80">
          Fields that already have a value are read-only. You can only fill in empty fields.
        </p>
      ) : null}

      <label className={fieldLabelClass}>
        Inventory number
        <input
          name="inventory_number"
          type="text"
          autoComplete="off"
          defaultValue={v?.inventory_number ?? ""}
          readOnly={ro && invHasStr(v?.inventory_number)}
          className={ro && invHasStr(v?.inventory_number) ? fieldReadOnlyClass : fieldInputClass}
          placeholder="ITRY-001"
        />
      </label>

      <label className={fieldLabelClass}>
        Company name
        <input
          name="company_name"
          type="text"
          autoComplete="off"
          defaultValue={v?.company_name ?? ""}
          readOnly={ro && invHasStr(v?.company_name)}
          className={ro && invHasStr(v?.company_name) ? fieldReadOnlyClass : fieldInputClass}
          placeholder="Acme Pvt Ltd"
        />
      </label>

      <ForeignKeySelect
        name="agent_name"
        options={agents}
        defaultId={v?.agent_name ?? ""}
        getLabel={(a) => a.agent_name}
        label="Agent"
        readOnly={ro && invHasStr(v?.agent_name)}
      />

      <ForeignKeySelect
        name="transport_name"
        options={transports}
        defaultId={v?.transport_name ?? ""}
        getLabel={(t) => t.transport_name}
        label="Transport"
        readOnly={ro && invHasStr(v?.transport_name)}
      />

      <label className={fieldLabelClass}>
        Waybill number
        <input
          name="waybill_number"
          type="text"
          autoComplete="off"
          defaultValue={v?.waybill_number ?? ""}
          readOnly={ro && invHasStr(v?.waybill_number)}
          className={ro && invHasStr(v?.waybill_number) ? fieldReadOnlyClass : fieldInputClass}
          placeholder="WB-0001"
        />
      </label>

      <label className={fieldLabelClass}>
        Transport charges
        <input
          name="transport_charges"
          type="number"
          step="any"
          defaultValue={
            v?.transport_charges != null ? String(v.transport_charges) : ""
          }
          readOnly={ro && invHasNum(v?.transport_charges)}
          className={ro && invHasNum(v?.transport_charges) ? fieldReadOnlyClass : fieldInputClass}
        />
      </label>

      <label className={fieldLabelClass}>
        Date of entry
        <input
          name="date_of_entry"
          type="date"
          defaultValue={v?.date_of_entry ?? ""}
          readOnly={ro && invHasStr(v?.date_of_entry)}
          className={`${ro && invHasStr(v?.date_of_entry) ? fieldReadOnlyClass : fieldInputClass}`}
        />
      </label>

      <label className={fieldLabelClass}>
        Loading charges
        <input
          name="loading_charges"
          type="number"
          step="any"
          defaultValue={
            v?.loading_charges != null ? String(v.loading_charges) : ""
          }
          readOnly={ro && invHasNum(v?.loading_charges)}
          className={ro && invHasNum(v?.loading_charges) ? fieldReadOnlyClass : fieldInputClass}
        />
      </label>

      <ForeignKeySelect
        name="staff_name"
        options={users}
        defaultId={v?.staff_name ?? ""}
        getLabel={(u) => u.name}
        label="Staff"
        readOnly={ro && invHasStr(v?.staff_name)}
      />

      <label className={fieldLabelClass}>
        Location
        {ro && invHasStr(v?.location) ? (
          <LockedSelectValue
            name="location"
            value={v?.location ?? ""}
            label={v?.location ?? "—"}
          />
        ) : (
          <select
            name="location"
            defaultValue={v?.location ?? ""}
            className={fieldInputClass}
          >
            <option value="">—</option>
            <option value="GODOWN">GODOWN</option>
            <option value="SM">SM</option>
            <option value="WW">WW</option>
            <option value="CHA">CHA</option>
          </select>
        )}
      </label>

      <label className={fieldLabelClass}>
        Invoice number
        <input
          name="invoice_number"
          type="text"
          autoComplete="off"
          defaultValue={v?.invoice_number ?? ""}
          readOnly={ro && invHasStr(v?.invoice_number)}
          className={ro && invHasStr(v?.invoice_number) ? fieldReadOnlyClass : fieldInputClass}
          placeholder="INV-0001"
        />
      </label>

      <ForeignKeySelect
        name="item_name"
        options={items}
        defaultId={v?.item_name ?? ""}
        getLabel={(it) => it.product_name}
        label="Item"
        readOnly={ro && invHasStr(v?.item_name)}
      />

      <label className={fieldLabelClass}>
        Billed quantity
        <input
          name="billed_quantity"
          type="number"
          step="1"
          defaultValue={
            v?.billed_quantity != null ? String(v.billed_quantity) : ""
          }
          readOnly={ro && invHasQty(v?.billed_quantity)}
          className={ro && invHasQty(v?.billed_quantity) ? fieldReadOnlyClass : fieldInputClass}
        />
      </label>

      <label className={fieldLabelClass}>
        Received quantity
        <input
          name="received_quantity"
          type="number"
          step="1"
          defaultValue={
            v?.received_quantity != null ? String(v.received_quantity) : ""
          }
          readOnly={ro && invHasQty(v?.received_quantity)}
          className={ro && invHasQty(v?.received_quantity) ? fieldReadOnlyClass : fieldInputClass}
        />
      </label>

      <label className={fieldLabelClass}>
        Tallying
        {ro && invHasStr(v?.tallying) ? (
          <LockedSelectValue
            name="tallying"
            value={v?.tallying ?? ""}
            label={v?.tallying ?? "—"}
          />
        ) : (
          <select
            name="tallying"
            defaultValue={v?.tallying ?? ""}
            className={fieldInputClass}
          >
            <option value="">—</option>
            <option value="NOT STARTED">NOT STARTED</option>
            <option value="NOT TALLYING">NOT TALLYING</option>
            <option value="TALLIED">TALLIED</option>
          </select>
        )}
      </label>

      <label className={fieldLabelClass}>
        Pricing
        {ro && invHasStr(v?.pricing) ? (
          <LockedSelectValue
            name="pricing"
            value={v?.pricing ?? ""}
            label={v?.pricing ?? "—"}
          />
        ) : (
          <select
            name="pricing"
            defaultValue={v?.pricing ?? ""}
            className={fieldInputClass}
          >
            <option value="">—</option>
            <option value="PENDING">PENDING</option>
            <option value="IN PROGRESS">IN PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        )}
      </label>

      <label className={fieldLabelClass}>
        Stickering
        {ro && invHasStr(v?.stickering) ? (
          <LockedSelectValue
            name="stickering"
            value={v?.stickering ?? ""}
            label={v?.stickering ?? "—"}
          />
        ) : (
          <select
            name="stickering"
            defaultValue={v?.stickering ?? ""}
            className={fieldInputClass}
          >
            <option value="">—</option>
            <option value="PENDING">PENDING</option>
            <option value="IN PROGRESS">IN PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        )}
      </label>

      <label className={fieldLabelClass}>
        Supply
        {ro && invHasStr(v?.supply) ? (
          <LockedSelectValue
            name="supply"
            value={v?.supply ?? ""}
            label={v?.supply ?? "—"}
          />
        ) : (
          <select
            name="supply"
            defaultValue={v?.supply ?? ""}
            className={fieldInputClass}
          >
            <option value="">—</option>
            <option value="PENDING">PENDING</option>
            <option value="IN PROGRESS">IN PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        )}
      </label>

      <label className={fieldLabelClass}>
        Stock note
        <textarea
          name="stock_note"
          defaultValue={v?.stock_note ?? ""}
          readOnly={ro && invHasStr(v?.stock_note)}
          className={`min-h-[86px] resize-y ${ro && invHasStr(v?.stock_note) ? fieldReadOnlyClass : fieldInputClass}`}
          placeholder="Additional details..."
        />
      </label>

      <label className={fieldLabelClass}>
        Invoice amount
        <input
          name="invoice_amount"
          type="number"
          step="any"
          defaultValue={
            v?.invoice_amount != null ? String(v.invoice_amount) : ""
          }
          readOnly={ro && invHasNum(v?.invoice_amount)}
          className={ro && invHasNum(v?.invoice_amount) ? fieldReadOnlyClass : fieldInputClass}
        />
      </label>

      <label className={fieldLabelClass}>
        Invoice date
        <input
          name="invoice_date"
          type="date"
          defaultValue={v?.invoice_date ?? ""}
          readOnly={ro && invHasStr(v?.invoice_date)}
          className={`${ro && invHasStr(v?.invoice_date) ? fieldReadOnlyClass : fieldInputClass}`}
        />
      </label>

      <input
        type="hidden"
        name="invoice_image_url"
        value={v?.invoice_image_url ?? ""}
      />
      <input
        type="hidden"
        name="invoice_pdf_url"
        value={v?.invoice_pdf_url ?? ""}
      />

      <p className="max-w-2xl text-xs text-[#245236]/70">
        Invoice files upload to your OneDrive (
        <code className="text-[11px]">ONEDRIVE_UPLOAD_FOLDER</code>).{" "}
        <a
          href="/api/auth/microsoft"
          className="font-medium text-[#245236] underline-offset-2 hover:underline"
        >
          Connect Microsoft
        </a>{" "}
        if uploads fail. Stored values are OneDrive links.
      </p>

      <label className={fieldLabelClass}>
        Invoice image
        {v?.invoice_image_url ? (
          <span className="font-normal text-[#245236]/70">
            Current:{" "}
            <a
              href={v.invoice_image_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#245236] underline-offset-2 hover:underline"
            >
              open link
            </a>
            {ro && invHasStr(v.invoice_image_url)
              ? null
              : " — choose a file below to replace."}
          </span>
        ) : null}
        {!(ro && invHasStr(v?.invoice_image_url)) ? (
          <input
            name="invoice_image_file"
            type="file"
            accept="image/*"
            className={fileInputClass}
          />
        ) : null}
      </label>

      <label className={fieldLabelClass}>
        Invoice PDF
        {v?.invoice_pdf_url ? (
          <span className="font-normal text-[#245236]/70">
            Current:{" "}
            <a
              href={v.invoice_pdf_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#245236] underline-offset-2 hover:underline"
            >
              open link
            </a>
            {ro && invHasStr(v.invoice_pdf_url)
              ? null
              : " — choose a file below to replace."}
          </span>
        ) : null}
        {!(ro && invHasStr(v?.invoice_pdf_url)) ? (
          <input
            name="invoice_pdf_file"
            type="file"
            accept="application/pdf,.pdf"
            className={fileInputClass}
          />
        ) : null}
      </label>

      <label className={fieldLabelClass}>
        Payment details
        <textarea
          name="payment_details"
          defaultValue={v?.payment_details ?? ""}
          readOnly={ro && invHasStr(v?.payment_details)}
          className={`min-h-[72px] resize-y ${ro && invHasStr(v?.payment_details) ? fieldReadOnlyClass : fieldInputClass}`}
        />
      </label>

      <label className={fieldLabelClass}>
        Payment mode
        {ro && invHasStr(v?.payment_mode) ? (
          <LockedSelectValue
            name="payment_mode"
            value={v?.payment_mode ?? ""}
            label={v?.payment_mode ?? "—"}
          />
        ) : (
          <select
            name="payment_mode"
            defaultValue={v?.payment_mode ?? ""}
            className={fieldInputClass}
          >
            <option value="">—</option>
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="SBI">SBI</option>
            <option value="AXIS">AXIS</option>
            <option value="IOB">IOB</option>
            <option value="MIXED">MIXED</option>
          </select>
        )}
      </label>

      <label className={fieldLabelClass}>
        Payment status
        {ro && invHasStr(v?.payment_status) ? (
          <LockedSelectValue
            name="payment_status"
            value={v?.payment_status ?? ""}
            label={v?.payment_status ?? "—"}
          />
        ) : (
          <select
            name="payment_status"
            defaultValue={v?.payment_status ?? ""}
            className={fieldInputClass}
          >
            <option value="">—</option>
            <option value="PENDING">PENDING</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="DONE">DONE</option>
          </select>
        )}
      </label>

      <label className={fieldLabelClass}>
        Debit note
        <textarea
          name="debit_note"
          defaultValue={v?.debit_note ?? ""}
          readOnly={ro && invHasStr(v?.debit_note)}
          className={`min-h-[72px] resize-y ${ro && invHasStr(v?.debit_note) ? fieldReadOnlyClass : fieldInputClass}`}
        />
      </label>

      <label className={fieldLabelClass}>
        Comments
        <textarea
          name="comments"
          defaultValue={v?.comments ?? ""}
          readOnly={ro && invHasStr(v?.comments)}
          className={`min-h-[86px] resize-y ${ro && invHasStr(v?.comments) ? fieldReadOnlyClass : fieldInputClass}`}
        />
      </label>

      {mode === "create" ? (
        <SubmitButton className="h-[42px] w-full max-w-2xl rounded-lg bg-[#245236] px-5 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:opacity-60">
          Create
        </SubmitButton>
      ) : null}
    </div>
  );
}

function ForeignKeySelect<T extends { id: string }>({
  name,
  options,
  defaultId,
  getLabel,
  label,
  readOnly = false,
}: {
  name: string;
  options: T[];
  defaultId: string;
  getLabel: (row: T) => string | null | undefined;
  label: string;
  readOnly?: boolean;
}) {
  const selected = defaultId ? options.find((o) => o.id === defaultId) : null;
  const selectedLabel = selected ? getLabel(selected) : null;
  const selectedDisplay = selectedLabel?.trim()
    ? selectedLabel
    : selected?.id ?? defaultId;
  const selectedInOptions = !!selected;

  if (readOnly) {
    return (
      <label className={fieldLabelClass}>
        {label}
        <input type="hidden" name={name} value={defaultId} />
        <div className={fieldReadOnlyClass}>{selectedDisplay || "—"}</div>
      </label>
    );
  }

  return (
    <label className={fieldLabelClass}>
      {label}
      <select
        name={name}
        defaultValue={defaultId}
        className={fieldInputClass}
      >
        <option value="">—</option>
        {defaultId && !selectedInOptions ? (
          <option value={defaultId}>{selectedDisplay}</option>
        ) : null}
        {options.map((o) => {
          const l = getLabel(o);
          const display = l?.trim() ? l : o.id;
          return (
            <option key={o.id} value={o.id}>
              {display}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function SubmitButton({
  children,
  className,
  loadingLabel = "Loading...",
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

function inventoryRowMatchesLikeSearch(
  row: InventoryRow,
  needleLower: string,
  helpers: {
    agentLabel: (id: string | null) => string;
    transportLabel: (id: string | null) => string;
    userLabel: (id: string | null) => string;
    itemLabel: (id: string | null) => string;
  },
): boolean {
  if (!needleLower) return true;
  const haystacks = [
    row.inventory_number,
    row.company_name,
    helpers.agentLabel(row.agent_name),
    helpers.transportLabel(row.transport_name),
    row.waybill_number,
    row.date_of_entry,
    helpers.userLabel(row.staff_name),
    row.location,
    row.invoice_number,
    helpers.itemLabel(row.item_name),
    row.invoice_date,
    row.payment_mode,
    row.payment_status,
    row.created_at,
    formatDate(row.created_at),
  ];
  return haystacks.some((h) =>
    String(h ?? "")
      .toLowerCase()
      .includes(needleLower),
  );
}

function formatMaybeNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (typeof n === "number" && Number.isFinite(n)) return String(n);
  return "—";
}

function previewText(s: string | null | undefined, max = 48) {
  if (!s?.trim()) return "—";
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

