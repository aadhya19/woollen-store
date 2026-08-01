"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createInventory,
  deleteInventory,
  setInventoryHidden,
  updateInventory,
  updateInventoryWorkflowStatus,
} from "./actions";
import Modal from "@/app/components/Modal";
import { downloadWorkbookAsXlsx } from "@/lib/download-xlsx";
import type {
  AgentLookupRow,
  InventoryExportItemRow,
  InventoryRow,
  TransportLookupRow,
  UserLookupRow,
} from "./types";

type Props = {
  inventories: InventoryRow[];
  agents: AgentLookupRow[];
  transports: TransportLookupRow[];
  users: UserLookupRow[];
  inventoryExportItems: InventoryExportItemRow[];
  canManage: boolean;
  /** Admin only: payment columns, filters, and form fields. */
  showPaymentFields?: boolean;
  /** Employee: can edit existing rows but only fields that are still empty (server enforces). */
  allowRestrictedEdit?: boolean;
  /** Main list shows non-hidden rows; hidden list shows only soft-hidden invoices. */
  listMode?: "active" | "hidden";
};

const INVENTORY_RESULTS_PAGE_SIZE = 25;

const INVENTORY_TABLE_HIDDEN_COLUMNS_KEY = "inventory-table-hidden-columns";

type InventoryTableColumnId =
  | "inventory_number"
  | "company_name"
  | "agent_name"
  | "transport_name"
  | "waybill_number"
  | "transport_charges"
  | "date_of_entry"
  | "loading_charges"
  | "staff_name"
  | "location"
  | "invoice_number"
  | "number_of_parcels"
  | "billed_quantity"
  | "received_quantity"
  | "tallying"
  | "pricing"
  | "stickering"
  | "invoice_amount"
  | "invoice_date"
  | "invoice_image_url"
  | "product_image"
  | "payment_details"
  | "payment_mode"
  | "payment_status"
  | "debit_note";

const INVENTORY_TABLE_COLUMNS: {
  id: InventoryTableColumnId;
  label: string;
  adminOnly?: boolean;
}[] = [
  { id: "inventory_number", label: "Inventory #" },
  { id: "company_name", label: "Company" },
  { id: "agent_name", label: "Agent" },
  { id: "transport_name", label: "Transport" },
  { id: "waybill_number", label: "Waybill" },
  { id: "transport_charges", label: "Trans. charges" },
  { id: "date_of_entry", label: "Entry date" },
  { id: "loading_charges", label: "Loading ch." },
  { id: "staff_name", label: "Staff" },
  { id: "location", label: "Location" },
  { id: "invoice_number", label: "Invoice #" },
  { id: "number_of_parcels", label: "Parcels" },
  { id: "billed_quantity", label: "Billed qty" },
  { id: "received_quantity", label: "Received qty" },
  { id: "tallying", label: "Tallying" },
  { id: "pricing", label: "Pricing" },
  { id: "stickering", label: "Stickering" },
  { id: "invoice_amount", label: "Inv. amount" },
  { id: "invoice_date", label: "Inv. date" },
  { id: "invoice_image_url", label: "Inv. image" },
  { id: "product_image", label: "Product image" },
  { id: "payment_details", label: "Pay details", adminOnly: true },
  { id: "payment_mode", label: "Pay mode", adminOnly: true },
  { id: "payment_status", label: "Pay status", adminOnly: true },
  { id: "debit_note", label: "Debit note" },
];

const INVENTORY_TABLE_COLUMN_IDS = new Set<InventoryTableColumnId>(
  INVENTORY_TABLE_COLUMNS.map((col) => col.id),
);

function readHiddenInventoryColumns(): Set<InventoryTableColumnId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(INVENTORY_TABLE_HIDDEN_COLUMNS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const hidden = parsed.filter(
      (id): id is InventoryTableColumnId =>
        typeof id === "string" && INVENTORY_TABLE_COLUMN_IDS.has(id as InventoryTableColumnId),
    );
    return new Set(hidden);
  } catch {
    return new Set();
  }
}

function writeHiddenInventoryColumns(hidden: Set<InventoryTableColumnId>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    INVENTORY_TABLE_HIDDEN_COLUMNS_KEY,
    JSON.stringify([...hidden]),
  );
}

function inventoryTableCellClass(columnId: InventoryTableColumnId): string {
  switch (columnId) {
    case "inventory_number":
      return "px-4 py-3 font-medium tabular-nums text-[#245236]";
    case "company_name":
      return "px-4 py-3 font-medium text-[#245236]";
    case "invoice_number":
    case "payment_details":
      return "max-w-[140px] truncate px-4 py-3 text-[#245236]/80";
    default:
      return "px-4 py-3 text-[#245236]/80";
  }
}

function InventoryTableColumnPicker({
  columns,
  hiddenIds,
  onToggle,
  onShowAll,
}: {
  columns: readonly { id: InventoryTableColumnId; label: string }[];
  hiddenIds: Set<InventoryTableColumnId>;
  onToggle: (id: InventoryTableColumnId) => void;
  onShowAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [open]);

  const hiddenCount = columns.filter((col) => hiddenIds.has(col.id)).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center justify-center rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-3 py-2 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
      >
        Columns
        {hiddenCount > 0 ? (
          <span className="ml-1.5 rounded-full bg-[#245236]/15 px-1.5 py-0.5 text-xs tabular-nums">
            {hiddenCount} hidden
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-[#245236]/20 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#245236]/80">Show columns</p>
            <button
              type="button"
              onClick={onShowAll}
              className="text-xs font-medium text-[#245236] underline-offset-2 hover:underline"
            >
              Show all
            </button>
          </div>
          <ul className="max-h-[min(50vh,20rem)] space-y-1 overflow-y-auto">
            {columns.map((col) => {
              const visible = !hiddenIds.has(col.id);
              return (
                <li key={col.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#245236] hover:bg-[#FEED01]/25">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => onToggle(col.id)}
                      className="size-4 rounded border-[#245236]/30 text-[#245236] focus:ring-[#245236]/40"
                    />
                    {col.label}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const INVENTORY_BLANK_FILTER_VALUE = "—";

const INVENTORY_NO_FILTER_COLUMNS = new Set<InventoryTableColumnId>(["waybill_number"]);

const INVENTORY_RANGE_FILTER_COLUMNS = new Set<InventoryTableColumnId>([
  "transport_charges",
  "loading_charges",
  "number_of_parcels",
  "billed_quantity",
  "received_quantity",
  "invoice_amount",
]);

const INVENTORY_DATE_FILTER_COLUMNS = new Set<InventoryTableColumnId>([
  "date_of_entry",
  "invoice_date",
]);

type InventoryColumnFilterLookups = {
  agentLabel: (id: string | null) => string;
  transportLabel: (id: string | null) => string;
  userLabel: (id: string | null) => string;
};

type InventoryListColumnFilter = {
  kind: "list";
  selected: Set<string>;
};

type InventoryRangeColumnFilter = {
  kind: "range";
  min: number | null;
  max: number | null;
};

type InventoryDateColumnFilter = {
  kind: "date";
  from: string | null;
  to: string | null;
};

type InventoryColumnFilter =
  | InventoryListColumnFilter
  | InventoryRangeColumnFilter
  | InventoryDateColumnFilter;

function isInventoryRangeFilterColumn(columnId: InventoryTableColumnId): boolean {
  return INVENTORY_RANGE_FILTER_COLUMNS.has(columnId);
}

function isInventoryDateFilterColumn(columnId: InventoryTableColumnId): boolean {
  return INVENTORY_DATE_FILTER_COLUMNS.has(columnId);
}

function isInventoryListFilterColumn(columnId: InventoryTableColumnId): boolean {
  return (
    !INVENTORY_NO_FILTER_COLUMNS.has(columnId) &&
    !isInventoryRangeFilterColumn(columnId) &&
    !isInventoryDateFilterColumn(columnId)
  );
}

function toInventoryFilterDateString(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inventoryColumnDateValue(
  row: InventoryRow,
  columnId: InventoryTableColumnId,
): string | null {
  switch (columnId) {
    case "date_of_entry":
      return toInventoryFilterDateString(row.date_of_entry);
    case "invoice_date":
      return toInventoryFilterDateString(row.invoice_date);
    default:
      return null;
  }
}

function inventoryColumnNumericValue(
  row: InventoryRow,
  columnId: InventoryTableColumnId,
): number | null {
  switch (columnId) {
    case "transport_charges":
      return parseInventoryNumeric(row.transport_charges);
    case "loading_charges":
      return parseInventoryNumeric(row.loading_charges);
    case "number_of_parcels":
      return parseInventoryNumeric(row.number_of_parcels);
    case "billed_quantity":
      return parseInventoryNumeric(row.billed_quantity);
    case "received_quantity":
      return parseInventoryNumeric(row.received_quantity);
    case "invoice_amount":
      return parseInventoryNumeric(row.invoice_amount);
    default:
      return null;
  }
}

function inventoryColumnFilterValue(
  row: InventoryRow,
  columnId: InventoryTableColumnId,
  lookups: InventoryColumnFilterLookups,
): string {
  switch (columnId) {
    case "inventory_number":
      return row.inventory_number?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "company_name":
      return row.company_name?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "agent_name":
      return lookups.agentLabel(row.agent_name);
    case "transport_name":
      return lookups.transportLabel(row.transport_name);
    case "waybill_number":
      return row.waybill_number?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "transport_charges":
      return formatMaybeNumber(row.transport_charges);
    case "date_of_entry":
      return row.date_of_entry?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "loading_charges":
      return formatMaybeNumber(row.loading_charges);
    case "staff_name":
      return lookups.userLabel(row.staff_name);
    case "location":
      return row.location?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "invoice_number":
      return row.invoice_number?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "number_of_parcels":
      return row.number_of_parcels == null || String(row.number_of_parcels).trim() === ""
        ? INVENTORY_BLANK_FILTER_VALUE
        : String(row.number_of_parcels);
    case "billed_quantity":
      return row.billed_quantity == null || String(row.billed_quantity).trim() === ""
        ? INVENTORY_BLANK_FILTER_VALUE
        : String(row.billed_quantity);
    case "received_quantity":
      return row.received_quantity == null || String(row.received_quantity).trim() === ""
        ? INVENTORY_BLANK_FILTER_VALUE
        : String(row.received_quantity);
    case "tallying":
      return row.tallying?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "pricing":
      return row.pricing?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "stickering":
      return row.stickering?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "invoice_amount":
      return formatMaybeNumber(row.invoice_amount);
    case "invoice_date":
      return row.invoice_date?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "invoice_image_url":
      return row.invoice_image_url?.trim() ? "Present" : INVENTORY_BLANK_FILTER_VALUE;
    case "product_image":
      return row.product_image?.trim() ? "Present" : INVENTORY_BLANK_FILTER_VALUE;
    case "payment_details":
      return row.payment_details?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "payment_mode":
      return row.payment_mode?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "payment_status":
      return row.payment_status?.trim() || INVENTORY_BLANK_FILTER_VALUE;
    case "debit_note":
      return row.debit_note?.trim() ? "Present" : INVENTORY_BLANK_FILTER_VALUE;
    default:
      return INVENTORY_BLANK_FILTER_VALUE;
  }
}

function rowMatchesInventoryColumnFilter(
  row: InventoryRow,
  columnId: InventoryTableColumnId,
  filter: InventoryColumnFilter,
  lookups: InventoryColumnFilterLookups,
): boolean {
  if (filter.kind === "range") {
    const value = inventoryColumnNumericValue(row, columnId);
    if (value == null) return false;
    if (filter.min != null && value < filter.min) return false;
    if (filter.max != null && value > filter.max) return false;
    return true;
  }
  if (filter.kind === "date") {
    const value = inventoryColumnDateValue(row, columnId);
    if (value == null) return false;
    if (filter.from && value < filter.from) return false;
    if (filter.to && value > filter.to) return false;
    return true;
  }
  return filter.selected.has(inventoryColumnFilterValue(row, columnId, lookups));
}

function isInventoryColumnFilterActive(filter: InventoryColumnFilter | undefined): boolean {
  if (!filter) return false;
  if (filter.kind === "list") return true;
  if (filter.kind === "date") return Boolean(filter.from || filter.to);
  return filter.min != null || filter.max != null;
}

function serializeInventoryColumnFilters(
  filters: Partial<Record<InventoryTableColumnId, InventoryColumnFilter>>,
): string {
  return Object.entries(filters)
    .filter(([, filter]) => isInventoryColumnFilterActive(filter))
    .map(([id, filter]) => {
      if (!filter) return `${id}:`;
      if (filter.kind === "range") {
        return `${id}:range:${filter.min ?? ""}\u001f${filter.max ?? ""}`;
      }
      if (filter.kind === "date") {
        return `${id}:date:${filter.from ?? ""}\u001f${filter.to ?? ""}`;
      }
      return `${id}:list:${[...filter.selected].sort().join("\u001f")}`;
    })
    .sort()
    .join("\u001e");
}

function parseOptionalFilterNumber(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function formatFilterNumberBound(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

function inventoryColumnFilterMode(
  columnId: InventoryTableColumnId,
): "list" | "range" | "date" {
  if (isInventoryRangeFilterColumn(columnId)) return "range";
  if (isInventoryDateFilterColumn(columnId)) return "date";
  return "list";
}

function InventoryExcelColumnFilter({
  columnId,
  label,
  mode,
  uniqueValues,
  filter,
  dataMin,
  dataMax,
  dateMin,
  dateMax,
  onChange,
  onClear,
}: {
  columnId: InventoryTableColumnId;
  label: string;
  mode: "list" | "range" | "date";
  uniqueValues: string[];
  filter: InventoryColumnFilter | undefined;
  dataMin: number | null;
  dataMax: number | null;
  dateMin: string | null;
  dateMax: string | null;
  onChange: (columnId: InventoryTableColumnId, next: InventoryColumnFilter | undefined) => void;
  onClear: (columnId: InventoryTableColumnId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [valueSearch, setValueSearch] = useState("");
  const [minDraft, setMinDraft] = useState("");
  const [maxDraft, setMaxDraft] = useState("");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const isActive = isInventoryColumnFilterActive(filter);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setValueSearch("");
      return;
    }
    if (mode === "range") {
      const range = filter?.kind === "range" ? filter : undefined;
      setMinDraft(formatFilterNumberBound(range?.min));
      setMaxDraft(formatFilterNumberBound(range?.max));
    }
    if (mode === "date") {
      const date = filter?.kind === "date" ? filter : undefined;
      setFromDraft(date?.from ?? "");
      setToDraft(date?.to ?? "");
    }
  }, [open, mode, filter]);

  const listSelected =
    filter?.kind === "list" ? filter.selected : undefined;
  const effectiveSelected = listSelected ?? new Set(uniqueValues);
  const valueSearchLower = valueSearch.trim().toLowerCase();
  const visibleValues =
    valueSearchLower.length === 0
      ? uniqueValues
      : uniqueValues.filter((value) => value.toLowerCase().includes(valueSearchLower));
  const allVisibleSelected =
    visibleValues.length > 0 && visibleValues.every((value) => effectiveSelected.has(value));

  function toggleValue(value: string) {
    const next = new Set(effectiveSelected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === uniqueValues.length && uniqueValues.every((v) => next.has(v))) {
      onChange(columnId, undefined);
      return;
    }
    onChange(columnId, { kind: "list", selected: next });
  }

  function toggleSelectAllVisible() {
    const next = new Set(effectiveSelected);
    if (allVisibleSelected) {
      for (const value of visibleValues) next.delete(value);
    } else {
      for (const value of visibleValues) next.add(value);
    }
    if (next.size === uniqueValues.length && uniqueValues.every((v) => next.has(v))) {
      onChange(columnId, undefined);
      return;
    }
    onChange(columnId, { kind: "list", selected: next });
  }

  function applyRangeDraft() {
    const min = parseOptionalFilterNumber(minDraft);
    const max = parseOptionalFilterNumber(maxDraft);
    if (min === undefined || max === undefined) return;
    if (min == null && max == null) {
      onChange(columnId, undefined);
      return;
    }
    if (min != null && max != null && min > max) return;
    onChange(columnId, { kind: "range", min, max });
  }

  function applyDateDraft() {
    const from = fromDraft.trim() || null;
    const to = toDraft.trim() || null;
    if (!from && !to) {
      onChange(columnId, undefined);
      return;
    }
    if (from && to && from > to) return;
    onChange(columnId, { kind: "date", from, to });
  }

  const rangeHint =
    dataMin != null && dataMax != null
      ? `Data range: ${dataMin} – ${dataMax}`
      : dataMin != null
        ? `Min in data: ${dataMin}`
        : dataMax != null
          ? `Max in data: ${dataMax}`
          : "No numeric values in view";

  const dateHint =
    dateMin && dateMax
      ? `Data range: ${dateMin} – ${dateMax}`
      : dateMin
        ? `Earliest in data: ${dateMin}`
        : dateMax
          ? `Latest in data: ${dateMax}`
          : "No dates in view";

  const filterTitle =
    mode === "range"
      ? `Range filter · ${label}`
      : mode === "date"
        ? `Date filter · ${label}`
        : `Filter by ${label}`;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Filter ${label}`}
        title={`Filter ${label}`}
        className={`inline-flex size-5 items-center justify-center rounded ${
          isActive
            ? "bg-[#245236] text-[#FEED01]"
            : "text-[#245236]/55 hover:bg-[#245236]/10 hover:text-[#245236]"
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path
            fill="currentColor"
            d="M2 3.25h12l-4.5 5.25v3.25L6.5 13V8.5L2 3.25Z"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-[#245236]/20 bg-white p-2.5 text-left normal-case tracking-normal shadow-lg">
          <p className="mb-2 text-[11px] font-medium text-[#245236]/70">{filterTitle}</p>
          {mode === "range" ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#245236]/60">{rangeHint}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-[#245236]/80">
                  Min
                  <input
                    type="number"
                    inputMode="decimal"
                    value={minDraft}
                    onChange={(e) => setMinDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyRangeDraft();
                    }}
                    placeholder={dataMin != null ? String(dataMin) : "Any"}
                    className="w-full rounded-md border border-[#245236]/25 bg-white px-2 py-1.5 text-xs text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-[#245236]/80">
                  Max
                  <input
                    type="number"
                    inputMode="decimal"
                    value={maxDraft}
                    onChange={(e) => setMaxDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyRangeDraft();
                    }}
                    placeholder={dataMax != null ? String(dataMax) : "Any"}
                    className="w-full rounded-md border border-[#245236]/25 bg-white px-2 py-1.5 text-xs text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                {isActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClear(columnId);
                      setMinDraft("");
                      setMaxDraft("");
                    }}
                    className="text-[11px] font-medium text-[#245236] underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => {
                    applyRangeDraft();
                    setOpen(false);
                  }}
                  className="rounded-md bg-[#245236] px-2.5 py-1 text-[11px] font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : mode === "date" ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#245236]/60">{dateHint}</p>
              <div className="grid grid-cols-1 gap-2">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-[#245236]/80">
                  From
                  <input
                    type="date"
                    value={fromDraft}
                    onChange={(e) => setFromDraft(e.target.value)}
                    className="w-full rounded-md border border-[#245236]/25 bg-white px-2 py-1.5 text-xs text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-[#245236]/80">
                  To
                  <input
                    type="date"
                    value={toDraft}
                    onChange={(e) => setToDraft(e.target.value)}
                    className="w-full rounded-md border border-[#245236]/25 bg-white px-2 py-1.5 text-xs text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                {isActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClear(columnId);
                      setFromDraft("");
                      setToDraft("");
                    }}
                    className="text-[11px] font-medium text-[#245236] underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => {
                    applyDateDraft();
                    setOpen(false);
                  }}
                  className="rounded-md bg-[#245236] px-2.5 py-1 text-[11px] font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={valueSearch}
                onChange={(e) => setValueSearch(e.target.value)}
                placeholder="Search values…"
                autoComplete="off"
                className="mb-2 w-full rounded-md border border-[#245236]/25 bg-white px-2 py-1.5 text-xs text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
              />
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="text-[11px] font-medium text-[#245236] underline-offset-2 hover:underline"
                >
                  {allVisibleSelected ? "Clear listed" : "Select listed"}
                </button>
                {isActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClear(columnId);
                      setOpen(false);
                    }}
                    className="text-[11px] font-medium text-[#245236] underline-offset-2 hover:underline"
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>
              <ul className="max-h-[min(40vh,14rem)] space-y-0.5 overflow-y-auto">
                {visibleValues.length === 0 ? (
                  <li className="px-2 py-1.5 text-xs text-[#245236]/60">No values</li>
                ) : (
                  visibleValues.map((value) => (
                    <li key={value}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs text-[#245236] hover:bg-[#FEED01]/25">
                        <input
                          type="checkbox"
                          checked={effectiveSelected.has(value)}
                          onChange={() => toggleValue(value)}
                          className="mt-0.5 size-3.5 shrink-0 rounded border-[#245236]/30 text-[#245236] focus:ring-[#245236]/40"
                        />
                        <span className="min-w-0 break-words">{value}</span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

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
  },
  includePaymentFields: boolean,
): { label: string; value: string }[] {
  const idOrNull = (key: string) => {
    const s = fd.get(key)?.toString().trim();
    return s ? s : null;
  };
  const agentId = idOrNull("agent_name");
  const transportId = idOrNull("transport_name");
  const staffId = idOrNull("staff_name");

  const base: { label: string; value: string }[] = [
    { label: "Inventory number", value: fdCell(fd.get("inventory_number")) },
    { label: "Company name", value: fdCell(fd.get("company_name")) },
    { label: "Agent", value: agentId ? lookups.agentLabel(agentId) : "—" },
    { label: "Transport", value: transportId ? lookups.transportLabel(transportId) : "—" },
    { label: "Date of entry", value: fdCell(fd.get("date_of_entry")) },
    { label: "Waybill number", value: fdCell(fd.get("waybill_number")) },
    { label: "Number of parcels", value: fdCell(fd.get("number_of_parcels")) },
    { label: "Transport charges", value: fdCell(fd.get("transport_charges")) },
    { label: "Loading charges", value: fdCell(fd.get("loading_charges")) },
    { label: "Staff", value: staffId ? lookups.userLabel(staffId) : "—" },
    { label: "Location", value: fdCell(fd.get("location")) },
    { label: "Invoice number", value: fdCell(fd.get("invoice_number")) },
    { label: "Invoice date", value: fdCell(fd.get("invoice_date")) },
    { label: "Invoice value", value: fdCell(fd.get("invoice_amount")) },
    { label: "Billed quantity", value: fdCell(fd.get("billed_quantity")) },
    { label: "Received quantity", value: fdCell(fd.get("received_quantity")) },
    { label: "Tallying", value: fdCell(fd.get("tallying")) },
    { label: "Pricing", value: fdCell(fd.get("pricing")) },
    { label: "Stickering", value: fdCell(fd.get("stickering")) },
    { label: "Invoice image/pdf (file)", value: fdCell(fd.get("invoice_image_file")) },
    { label: "Product images (file)", value: fdCell(fd.get("product_image_file")) },
    { label: "Debit note image (file)", value: fdCell(fd.get("debit_note_file")) },
  ];
  if (!includePaymentFields) return base;
  return [
    ...base,
    { label: "Payment details", value: fdCell(fd.get("payment_details")) },
    { label: "Payment mode", value: fdCell(fd.get("payment_mode")) },
    { label: "Payment status", value: fdCell(fd.get("payment_status")) },
    { label: "Debit note", value: fdCell(fd.get("debit_note")) },
  ];
}

export function InventoryManager({
  inventories,
  agents,
  transports,
  users,
  inventoryExportItems,
  canManage,
  showPaymentFields = false,
  allowRestrictedEdit = false,
  listMode = "active",
}: Props) {
  const router = useRouter();
  const isEmployee = !canManage && allowRestrictedEdit;
  console.log("isEmployee", isEmployee);
  const showingHidden = listMode === "hidden";
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [adminPaymentStatusFilter, setAdminPaymentStatusFilter] = useState("");
  const [adminDebitNoteFilter, setAdminDebitNoteFilter] = useState<
    "all" | "present" | "missing"
  >("all");
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [pendingCreateFormData, setPendingCreateFormData] = useState<FormData | null>(null);
  const [createConfirmSummary, setCreateConfirmSummary] = useState<
    { label: string; value: string }[] | null
  >(null);
  const [createConfirmSubmitting, setCreateConfirmSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  const [, startHide] = useTransition();
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<InventoryRow | null>(null);
  const [deleteFeedbackMessage, setDeleteFeedbackMessage] = useState<string | null>(null);
  const [inventoryResultsPage, setInventoryResultsPage] = useState(1);
  const [statusSavingKey, setStatusSavingKey] = useState<string | null>(null);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<InventoryTableColumnId>>(
    () => new Set(),
  );
  const [columnPrefsLoaded, setColumnPrefsLoaded] = useState(false);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<InventoryTableColumnId, InventoryColumnFilter>>
  >({});

  useEffect(() => {
    setHiddenColumnIds(readHiddenInventoryColumns());
    setColumnPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!columnPrefsLoaded) return;
    writeHiddenInventoryColumns(hiddenColumnIds);
  }, [hiddenColumnIds, columnPrefsLoaded]);

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
      }, showPaymentFields),
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not create inventory right now. Please try again.";
      setFormError(message);
      setCreateConfirmOpen(false);
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

  function runDelete(row: InventoryRow) {
    if (!canManage) return;
    setDeleteConfirmRow(row);
  }

  function runToggleHidden(row: InventoryRow) {
    if (!canManage) return;
    setRowError(null);
    setHidingId(row.id);
    startHide(async () => {
      const r = await setInventoryHidden(row.id, !showingHidden);
      if (r.error) {
        setRowError(r.error);
        setHidingId(null);
        return;
      }
      setHidingId(null);
      router.refresh();
    });
  }

  async function runWorkflowStatusUpdate(
    rowId: string,
    field: "tallying" | "pricing" | "stickering",
    value: string,
  ) {
    setRowError(null);
    const key = `${rowId}:${field}`;
    setStatusSavingKey(key);
    try {
      const r = await updateInventoryWorkflowStatus({
        id: rowId,
        field,
        value: value.trim() ? value : null,
      });
      if (r.error) {
        setRowError(r.error);
        return;
      }
      router.refresh();
    } finally {
      setStatusSavingKey(null);
    }
  }

  function confirmDeleteRow() {
    if (!deleteConfirmRow) return;
    const row = deleteConfirmRow;
    setDeleteConfirmRow(null);
    setRowError(null);
    setDeletingId(row.id);
    startDelete(async () => {
      const r = await deleteInventory(row.id);
      if (r.error) {
        setDeleteFeedbackMessage(r.error);
        setDeletingId(null);
        return;
      }
      if (editingId === row.id) setEditingId(null);
      setDeletingId(null);
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
            includePaymentFields: showPaymentFields,
          }),
        );

  const columnFilterLookups = useMemo<InventoryColumnFilterLookups>(
    () => ({ agentLabel, transportLabel, userLabel }),
    // Labels are stable closures over current agents/transports/users props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents, transports, users],
  );

  const filteredByAdminControls = filteredInventories.filter((row) => {
    if (showPaymentFields && adminPaymentStatusFilter) {
      const status = (row.payment_status ?? "").trim();
      if (status !== adminPaymentStatusFilter) return false;
    }
    if (canManage && adminDebitNoteFilter === "present" && !String(row.debit_note ?? "").trim()) {
      return false;
    }
    if (canManage && adminDebitNoteFilter === "missing" && String(row.debit_note ?? "").trim()) {
      return false;
    }
    return true;
  });

  const activeColumnFilterIds = useMemo(
    () =>
      (Object.keys(columnFilters) as InventoryTableColumnId[]).filter((id) =>
        isInventoryColumnFilterActive(columnFilters[id]),
      ),
    [columnFilters],
  );
  const hasActiveColumnFilters = activeColumnFilterIds.length > 0;

  const filteredByColumnFilters = useMemo(() => {
    if (!hasActiveColumnFilters) return filteredByAdminControls;
    return filteredByAdminControls.filter((row) =>
      activeColumnFilterIds.every((columnId) => {
        const filter = columnFilters[columnId];
        if (!filter || !isInventoryColumnFilterActive(filter)) return true;
        return rowMatchesInventoryColumnFilter(row, columnId, filter, columnFilterLookups);
      }),
    );
  }, [
    filteredByAdminControls,
    hasActiveColumnFilters,
    activeColumnFilterIds,
    columnFilters,
    columnFilterLookups,
  ]);

  const columnFilterUniqueValues = useMemo(() => {
    const map = {} as Partial<Record<InventoryTableColumnId, string[]>>;
    for (const col of INVENTORY_TABLE_COLUMNS) {
      if (!isInventoryListFilterColumn(col.id)) continue;
      const rowsForUnique = filteredByAdminControls.filter((row) =>
        activeColumnFilterIds.every((filterId) => {
          if (filterId === col.id) return true;
          const filter = columnFilters[filterId];
          if (!filter || !isInventoryColumnFilterActive(filter)) return true;
          return rowMatchesInventoryColumnFilter(row, filterId, filter, columnFilterLookups);
        }),
      );
      const values = new Set<string>();
      for (const row of rowsForUnique) {
        values.add(inventoryColumnFilterValue(row, col.id, columnFilterLookups));
      }
      map[col.id] = [...values].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      );
    }
    return map;
  }, [filteredByAdminControls, activeColumnFilterIds, columnFilters, columnFilterLookups]);

  const columnFilterNumericBounds = useMemo(() => {
    const map = {} as Partial<
      Record<InventoryTableColumnId, { min: number | null; max: number | null }>
    >;
    for (const col of INVENTORY_TABLE_COLUMNS) {
      if (!isInventoryRangeFilterColumn(col.id)) continue;
      const rowsForBounds = filteredByAdminControls.filter((row) =>
        activeColumnFilterIds.every((filterId) => {
          if (filterId === col.id) return true;
          const filter = columnFilters[filterId];
          if (!filter || !isInventoryColumnFilterActive(filter)) return true;
          return rowMatchesInventoryColumnFilter(row, filterId, filter, columnFilterLookups);
        }),
      );
      let min: number | null = null;
      let max: number | null = null;
      for (const row of rowsForBounds) {
        const value = inventoryColumnNumericValue(row, col.id);
        if (value == null) continue;
        min = min == null ? value : Math.min(min, value);
        max = max == null ? value : Math.max(max, value);
      }
      map[col.id] = { min, max };
    }
    return map;
  }, [filteredByAdminControls, activeColumnFilterIds, columnFilters, columnFilterLookups]);

  const columnFilterDateBounds = useMemo(() => {
    const map = {} as Partial<
      Record<InventoryTableColumnId, { min: string | null; max: string | null }>
    >;
    for (const col of INVENTORY_TABLE_COLUMNS) {
      if (!isInventoryDateFilterColumn(col.id)) continue;
      const rowsForBounds = filteredByAdminControls.filter((row) =>
        activeColumnFilterIds.every((filterId) => {
          if (filterId === col.id) return true;
          const filter = columnFilters[filterId];
          if (!filter || !isInventoryColumnFilterActive(filter)) return true;
          return rowMatchesInventoryColumnFilter(row, filterId, filter, columnFilterLookups);
        }),
      );
      let min: string | null = null;
      let max: string | null = null;
      for (const row of rowsForBounds) {
        const value = inventoryColumnDateValue(row, col.id);
        if (value == null) continue;
        if (min == null || value < min) min = value;
        if (max == null || value > max) max = value;
      }
      map[col.id] = { min, max };
    }
    return map;
  }, [filteredByAdminControls, activeColumnFilterIds, columnFilters, columnFilterLookups]);

  const availableTableColumns = useMemo(
    () => INVENTORY_TABLE_COLUMNS.filter((col) => !col.adminOnly || showPaymentFields),
    [showPaymentFields],
  );

  const visibleTableColumns = useMemo(
    () => availableTableColumns.filter((col) => !hiddenColumnIds.has(col.id)),
    [availableTableColumns, hiddenColumnIds],
  );

  function toggleTableColumnVisibility(columnId: InventoryTableColumnId) {
    setHiddenColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }

  function showAllTableColumns() {
    setHiddenColumnIds(new Set());
  }

  function setColumnFilterSelection(
    columnId: InventoryTableColumnId,
    next: InventoryColumnFilter | undefined,
  ) {
    setColumnFilters((prev) => {
      const copy = { ...prev };
      if (next == null || !isInventoryColumnFilterActive(next)) delete copy[columnId];
      else copy[columnId] = next;
      return copy;
    });
  }

  function clearColumnFilter(columnId: InventoryTableColumnId) {
    setColumnFilterSelection(columnId, undefined);
  }

  function clearAllColumnFilters() {
    setColumnFilters({});
  }

  function renderInventoryTableCell(row: InventoryRow, columnId: InventoryTableColumnId) {
    switch (columnId) {
      case "inventory_number":
        return row.inventory_number ?? "—";
      case "company_name":
        return row.company_name ?? "—";
      case "agent_name":
        return agentLabel(row.agent_name);
      case "transport_name":
        return transportLabel(row.transport_name);
      case "waybill_number":
        return row.waybill_number ?? "—";
      case "transport_charges":
        return formatMaybeNumber(row.transport_charges);
      case "date_of_entry":
        return row.date_of_entry ?? "—";
      case "loading_charges":
        return formatMaybeNumber(row.loading_charges);
      case "staff_name":
        return userLabel(row.staff_name);
      case "location":
        return row.location ?? "—";
      case "invoice_number":
        return row.invoice_number ?? "—";
      case "number_of_parcels":
        return row.number_of_parcels ?? "—";
      case "billed_quantity":
        return row.billed_quantity ?? "—";
      case "received_quantity":
        return row.received_quantity ?? "—";
      case "tallying":
        return canManage || allowRestrictedEdit ? (
          <InlineWorkflowStatusSelect
            field="tallying"
            value={row.tallying}
            disabled={statusSavingKey === `${row.id}:tallying`}
            onChange={(value) => void runWorkflowStatusUpdate(row.id, "tallying", value)}
            className="w-[145px]"
          />
        ) : (
          (row.tallying ?? "—")
        );
      case "pricing":
        return canManage || allowRestrictedEdit ? (
          <InlineWorkflowStatusSelect
            field="pricing"
            value={row.pricing}
            disabled={statusSavingKey === `${row.id}:pricing`}
            onChange={(value) => void runWorkflowStatusUpdate(row.id, "pricing", value)}
            className="w-[132px]"
          />
        ) : (
          (row.pricing ?? "—")
        );
      case "stickering":
        return canManage || allowRestrictedEdit ? (
          <InlineWorkflowStatusSelect
            field="stickering"
            value={row.stickering}
            disabled={statusSavingKey === `${row.id}:stickering`}
            onChange={(value) => void runWorkflowStatusUpdate(row.id, "stickering", value)}
            className="w-[132px]"
          />
        ) : (
          (row.stickering ?? "—")
        );
      case "invoice_amount":
        return formatMaybeNumber(row.invoice_amount);
      case "invoice_date":
        return row.invoice_date ?? "—";
      case "invoice_image_url":
        return linkCellButton(row.invoice_image_url, isEmployee);
      case "product_image":
        return linkCellButton(row.product_image, isEmployee);
      case "payment_details":
        return previewText(row.payment_details);
      case "payment_mode":
        return row.payment_mode ?? "—";
      case "payment_status":
        return row.payment_status ?? "—";
      case "debit_note":
        return linkCellButton(row.debit_note, isEmployee);
      default:
        return "—";
    }
  }

  const inventoryFilterKey = `${listSearchLower}\0${adminPaymentStatusFilter}\0${adminDebitNoteFilter}\0${serializeInventoryColumnFilters(columnFilters)}`;
  const prevInventoryFilterKeyRef = useRef(inventoryFilterKey);
  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredByColumnFilters.length / INVENTORY_RESULTS_PAGE_SIZE),
    );
    const filterChanged = prevInventoryFilterKeyRef.current !== inventoryFilterKey;
    prevInventoryFilterKeyRef.current = inventoryFilterKey;
    setInventoryResultsPage((p) => {
      if (filterChanged) return 1;
      return p > totalPages ? totalPages : p;
    });
  }, [inventoryFilterKey, filteredByColumnFilters.length]);

  const inventoryResultsTotal = filteredByColumnFilters.length;
  const inventoryResultsTotalPages = Math.max(
    1,
    Math.ceil(inventoryResultsTotal / INVENTORY_RESULTS_PAGE_SIZE),
  );
  const paginatedInventories = useMemo(() => {
    const start = (inventoryResultsPage - 1) * INVENTORY_RESULTS_PAGE_SIZE;
    return filteredByColumnFilters.slice(start, start + INVENTORY_RESULTS_PAGE_SIZE);
  }, [filteredByColumnFilters, inventoryResultsPage]);
  const inventoryResultsRangeStart =
    inventoryResultsTotal === 0 ? 0 : (inventoryResultsPage - 1) * INVENTORY_RESULTS_PAGE_SIZE + 1;
  const inventoryResultsRangeEnd = Math.min(
    inventoryResultsTotal,
    inventoryResultsPage * INVENTORY_RESULTS_PAGE_SIZE,
  );

  const inventoryNumericTotals = useMemo(
    () => computeInventoryNumericTotals(filteredByColumnFilters),
    [filteredByColumnFilters],
  );

  function handleExportExcel() {
    if (filteredByColumnFilters.length === 0) return;

    const columns = ["Item Category", "Item Description", "Company", "Item Code"];
    const allowedInventoryNumbers = new Set(
      filteredByColumnFilters
        .map((row) => row.inventory_number?.trim())
        .filter((v): v is string => Boolean(v)),
    );
    const exportRows = inventoryExportItems.filter((row) => {
      const inventoryNumber = row.inventory_number?.trim();
      return Boolean(inventoryNumber && allowedInventoryNumbers.has(inventoryNumber));
    });
    const dataRows = exportRows.map((row) => [
      row.item_category ?? "—",
      row.item_description ?? "—",
      row.company ?? "—",
      row.item_code ?? "—",
    ]);

    const fileName = `inventory-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadWorkbookAsXlsx([columns, ...dataRows], fileName, "Inventory");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#245236]/75">
          {inventories.length === 0
            ? showingHidden
              ? "No hidden invoices."
              : "No inventory rows yet."
            : listSearchLower || hasActiveColumnFilters || adminPaymentStatusFilter || adminDebitNoteFilter !== "all"
              ? `Showing ${filteredByColumnFilters.length} of ${inventories.length} row${inventories.length === 1 ? "" : "s"} matching your filters.`
              : `${inventories.length} inventory row${inventories.length === 1 ? "" : "s"} in the list.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {showingHidden ? (
            <Link
              href="/inventory"
              className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-4 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
            >
              Back to invoices
            </Link>
          ) : (
            <Link
              href="/inventory/hidden"
              className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-4 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
            >
              Hidden invoices
            </Link>
          )}
          {!showingHidden ? (
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
          ) : null}
        </div>
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
            canManage={canManage}
            showPaymentFields={showPaymentFields}
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
              canManage={canManage}
              showPaymentFields={showPaymentFields}
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

      <Modal
        open={Boolean(deleteConfirmRow)}
        onClose={() => {
          if (deletingId) return;
          setDeleteConfirmRow(null);
        }}
        title="Delete invoice"
        description="Please confirm before deleting this invoice row."
        panelClassName="max-w-lg"
      >
        {deleteConfirmRow ? (
          <div className="space-y-4">
            <p className="text-sm text-[#245236]">
              Delete invoice{" "}
              <span className="font-semibold tabular-nums">
                {deleteConfirmRow.inventory_number?.trim() || "—"}
              </span>
              ?
            </p>
            <p className="text-xs text-[#245236]/75">
              If linked inventory entries exist, deletion will be blocked and you must delete those
              rows first in the Inventory tab.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setDeleteConfirmRow(null)}
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-[#245236]/30 bg-[#FEED01]/30 px-4 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={confirmDeleteRow}
                className="inline-flex h-[38px] items-center justify-center rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deletingId ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteFeedbackMessage)}
        onClose={() => setDeleteFeedbackMessage(null)}
        title="Delete blocked"
        panelClassName="max-w-lg"
      >
        <div className="space-y-4">
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {deleteFeedbackMessage}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDeleteFeedbackMessage(null)}
              className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
            >
              OK
            </button>
          </div>
        </div>
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
                placeholder="Search across inventory #, company, transport, agent, waybill, dates, staff, location, invoice, parcels…"
                className="min-w-0 flex-1 rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
              />
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="hidden md:block">
                  <InventoryTableColumnPicker
                    columns={availableTableColumns}
                    hiddenIds={hiddenColumnIds}
                    onToggle={toggleTableColumnVisibility}
                    onShowAll={showAllTableColumns}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredByColumnFilters.length === 0}
                  className="inline-flex items-center justify-center rounded-lg bg-[#245236] px-3 py-2 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:opacity-50"
                >
                  Export Excel
                </button>
                {hasActiveColumnFilters ? (
                  <button
                    type="button"
                    onClick={clearAllColumnFilters}
                    className="rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-3 py-2 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
                  >
                    Clear column filters
                  </button>
                ) : null}
                {listSearch.trim() ? (
                  <button
                    type="button"
                    onClick={() => setListSearch("")}
                    className="rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-3 py-2 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </label>
          {canManage ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {showPaymentFields ? (
                <label className="flex flex-col gap-1 text-xs font-medium text-[#245236]/80">
                  Payment status
                  <select
                    value={adminPaymentStatusFilter}
                    onChange={(e) => setAdminPaymentStatusFilter(e.target.value)}
                    className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                  >
                    <option value="">All</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="DONE">DONE</option>
                  </select>
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-xs font-medium text-[#245236]/80">
                Debit note
                <select
                  value={adminDebitNoteFilter}
                  onChange={(e) =>
                    setAdminDebitNoteFilter(e.target.value as "all" | "present" | "missing")
                  }
                  className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                >
                  <option value="all">All</option>
                  <option value="present">Present</option>
                  <option value="missing">Missing</option>
                </select>
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#245236]/20 bg-white shadow-sm">
        {inventories.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            {showingHidden ? "No hidden invoices." : "No inventory rows yet."}
          </p>
        ) : filteredByColumnFilters.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            No rows match your filters
            {listSearch.trim() ? (
              <>
                {" "}
                for <span className="font-medium text-[#245236]">&quot;{listSearch.trim()}&quot;</span>
              </>
            ) : null}
            . Try clearing search or column filters.
          </p>
        ) : (
          <>
            <InventoryTotalsBar
              rowCount={filteredByColumnFilters.length}
              totals={inventoryNumericTotals}
            />
            <div className="divide-y divide-[#245236]/15 md:hidden">
              {paginatedInventories.map((row) => (
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
                      <p className="text-xs text-[#245236]/70">Parcels</p>
                      <p className="text-[#245236]/85">
                        {row.number_of_parcels ?? "—"}
                      </p>
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
                      <p className="text-xs text-[#245236]/70">Tallying</p>
                      {canManage || allowRestrictedEdit ? (
                        <InlineWorkflowStatusSelect
                          field="tallying"
                          value={row.tallying}
                          disabled={statusSavingKey === `${row.id}:tallying`}
                          onChange={(value) =>
                            void runWorkflowStatusUpdate(row.id, "tallying", value)
                          }
                        />
                      ) : (
                        <p className="text-[#245236]/85">{row.tallying ?? "—"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-[#245236]/70">Pricing</p>
                      {canManage || allowRestrictedEdit ? (
                        <InlineWorkflowStatusSelect
                          field="pricing"
                          value={row.pricing}
                          disabled={statusSavingKey === `${row.id}:pricing`}
                          onChange={(value) =>
                            void runWorkflowStatusUpdate(row.id, "pricing", value)
                          }
                        />
                      ) : (
                        <p className="text-[#245236]/85">{row.pricing ?? "—"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-[#245236]/70">Stickering</p>
                      {canManage || allowRestrictedEdit ? (
                        <InlineWorkflowStatusSelect
                          field="stickering"
                          value={row.stickering}
                          disabled={statusSavingKey === `${row.id}:stickering`}
                          onChange={(value) =>
                            void runWorkflowStatusUpdate(row.id, "stickering", value)
                          }
                        />
                      ) : (
                        <p className="text-[#245236]/85">{row.stickering ?? "—"}</p>
                      )}
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
                          <>
                            <button
                              type="button"
                              onClick={() => runToggleHidden(row)}
                              disabled={hidingId === row.id || deletingId === row.id}
                              className="rounded-md px-2 py-1 text-xs font-medium text-[#245236] underline-offset-2 hover:underline disabled:opacity-60"
                            >
                              {hidingId === row.id
                                ? showingHidden
                                  ? "Unhiding..."
                                  : "Hiding..."
                                : showingHidden
                                  ? "Unhide"
                                  : "Hide"}
                            </button>
                            <button
                              type="button"
                              onClick={() => runDelete(row)}
                              disabled={deletingId === row.id || hidingId === row.id}
                              className="rounded-md px-2 py-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-60"
                            >
                              {deletingId === row.id ? "Deleting..." : "Delete"}
                            </button>
                          </>
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
              <table
                className="w-full text-left text-sm"
                style={{ minWidth: `${visibleTableColumns.length * 105 + 120}px` }}
              >
              <thead className="border-b border-[#245236]/20 bg-[#FEED01]/25 text-xs font-medium uppercase tracking-wide text-[#245236]/80">
                <tr>
                  {visibleTableColumns.map((col) => (
                    <th key={col.id} className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {!INVENTORY_NO_FILTER_COLUMNS.has(col.id) ? (
                          <InventoryExcelColumnFilter
                            columnId={col.id}
                            label={col.label}
                            mode={inventoryColumnFilterMode(col.id)}
                            uniqueValues={columnFilterUniqueValues[col.id] ?? []}
                            filter={columnFilters[col.id]}
                            dataMin={columnFilterNumericBounds[col.id]?.min ?? null}
                            dataMax={columnFilterNumericBounds[col.id]?.max ?? null}
                            dateMin={columnFilterDateBounds[col.id]?.min ?? null}
                            dateMax={columnFilterDateBounds[col.id]?.max ?? null}
                            onChange={setColumnFilterSelection}
                            onClear={clearColumnFilter}
                          />
                        ) : null}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#245236]/15">
                {paginatedInventories.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#FEED01]/20"
                  >
                    {visibleTableColumns.map((col) => (
                      <td key={col.id} className={inventoryTableCellClass(col.id)}>
                        {renderInventoryTableCell(row, col.id)}
                      </td>
                    ))}
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
                                <>
                                  <button
                                    type="button"
                                    onClick={() => runToggleHidden(row)}
                                    disabled={hidingId === row.id || deletingId === row.id}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-[#245236] underline-offset-2 hover:underline disabled:opacity-60"
                                  >
                                    {hidingId === row.id
                                      ? showingHidden
                                        ? "Unhiding..."
                                        : "Hiding..."
                                      : showingHidden
                                        ? "Unhide"
                                        : "Hide"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => runDelete(row)}
                                    disabled={deletingId === row.id || hidingId === row.id}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-60"
                                  >
                                    {deletingId === row.id ? "Deleting..." : "Delete"}
                                  </button>
                                </>
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
            {inventoryResultsTotalPages > 1 ? (
              <div className="flex flex-col gap-3 border-t border-[#245236]/15 bg-[#FEED01]/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#245236]/75">
                  Showing{" "}
                  <span className="tabular-nums font-medium text-[#245236]">
                    {inventoryResultsRangeStart}–{inventoryResultsRangeEnd}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums font-medium text-[#245236]">
                    {inventoryResultsTotal}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInventoryResultsPage((p) => Math.max(1, p - 1))}
                    disabled={inventoryResultsPage <= 1}
                    className="rounded-lg border border-[#245236]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#245236] hover:bg-[#FEED01]/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[#245236]/80">
                    Page{" "}
                    <span className="tabular-nums font-medium text-[#245236]">
                      {inventoryResultsPage}
                    </span>{" "}
                    of{" "}
                    <span className="tabular-nums font-medium text-[#245236]">
                      {inventoryResultsTotalPages}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setInventoryResultsPage((p) => Math.min(inventoryResultsTotalPages, p + 1))
                    }
                    disabled={inventoryResultsPage >= inventoryResultsTotalPages}
                    className="rounded-lg border border-[#245236]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#245236] hover:bg-[#FEED01]/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
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
  canManage,
  showPaymentFields = false,
  restrictEditToEmptyFields = false,
}: {
  mode: "create" | "edit";
  values?: InventoryRow;
  agents: AgentLookupRow[];
  transports: TransportLookupRow[];
  users: UserLookupRow[];
  canManage: boolean;
  showPaymentFields?: boolean;
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
          required
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
        Number of parcels
        <select
          name="number_of_parcels"
          defaultValue={v?.number_of_parcels != null ? String(v.number_of_parcels) : ""}
          disabled={ro && invHasQty(v?.number_of_parcels)}
          className={
            ro && invHasQty(v?.number_of_parcels) ? fieldReadOnlyClass : fieldInputClass
          }
        >
          <option value="">—</option>
          {Array.from({ length: 30 }).map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
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

      <label className={fieldLabelClass}>
        Invoice value
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
      </label>

      <label className={fieldLabelClass}>
        Pricing
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
      </label>

      <label className={fieldLabelClass}>
        Stickering
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
      </label>

      <input
        type="hidden"
        name="invoice_image_url"
        value={v?.invoice_image_url ?? ""}
      />
      <input type="hidden" name="product_image" value={v?.product_image ?? ""} />
      <input type="hidden" name="debit_note" value={v?.debit_note ?? ""} />

      <p className="max-w-2xl text-xs text-[#245236]/70">
        Invoice files upload to your OneDrive (
        <code className="text-[11px]">ONEDRIVE_UPLOAD_FOLDER</code>).{" "}
        Contact admin if uploads fail. Stored values are OneDrive links.
      </p>

      <label className={fieldLabelClass}>
        Invoice Image/pdf
        {v?.invoice_image_url ? (
          <span className="font-normal text-[#245236]/70">
            Current:{" "}
            {!restrictEditToEmptyFields ? (
              <a
                href={v.invoice_image_url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#245236] underline-offset-2 hover:underline"
              >
                open link
              </a>
            ) : (
              <span className="font-medium text-[#245236]/50">file uploaded</span>
            )}
            {ro && invHasStr(v.invoice_image_url)
              ? null
              : " — choose a file below to replace."}
          </span>
        ) : null}
        {!(ro && invHasStr(v?.invoice_image_url)) ? (
          <input
            name="invoice_image_file"
            type="file"
            accept="image/*,application/pdf"
            className={fileInputClass}
          />
        ) : null}
      </label>

      <label className={fieldLabelClass}>
        Product Images
        {v?.product_image ? (
          <span className="font-normal text-[#245236]/70">
            Current:{" "}
            {!restrictEditToEmptyFields ? (
              <a
                href={v.product_image}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#245236] underline-offset-2 hover:underline"
              >
                open link
              </a>
            ) : (
              <span className="font-medium text-[#245236]/50">file uploaded</span>
            )}
            {ro && invHasStr(v.product_image)
              ? null
              : " — choose a file below to replace."}
          </span>
        ) : null}
        {!(ro && invHasStr(v?.product_image)) ? (
          <input
            name="product_image_file"
            type="file"
            accept="image/*"
            className={fileInputClass}
          />
        ) : null}
      </label>

      {showPaymentFields ? (
        <>
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
        </>
      ) : null}

      <label className={fieldLabelClass}>
        Debit Note Image
        {v?.debit_note ? (
          <span className="font-normal text-[#245236]/70">
            Current:{" "}
            {!restrictEditToEmptyFields ? (
              <a
                href={v.debit_note}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#245236] underline-offset-2 hover:underline"
              >
                open link
              </a>
            ) : (
              <span className="font-medium text-[#245236]/50">file uploaded</span>
            )}
            {ro && invHasStr(v.debit_note)
              ? null
              : " — choose a file below to replace."}
          </span>
        ) : null}
        {!(ro && invHasStr(v?.debit_note)) ? (
          <input
            name="debit_note_file"
            type="file"
            accept="image/*"
            className={fileInputClass}
          />
        ) : null}
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
  required = false,
  readOnly = false,
}: {
  name: string;
  options: T[];
  defaultId: string;
  getLabel: (row: T) => string | null | undefined;
  label: string;
  required?: boolean;
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
        required={required}
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

function InlineWorkflowStatusSelect({
  field,
  value,
  disabled,
  onChange,
  className,
}: {
  field: "tallying" | "pricing" | "stickering";
  value: string | null | undefined;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const options =
    field === "tallying"
      ? ["NOT STARTED", "NOT TALLYING", "TALLIED"]
      : ["PENDING", "IN PROGRESS", "DONE"];
  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={`${className ?? "w-full"} rounded-md border border-[#245236]/25 bg-white px-2 py-1 text-xs text-[#245236] outline-none ring-[#245236]/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
    includePaymentFields: boolean;
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
    row.number_of_parcels,
    row.invoice_date,
    row.created_at,
    formatDate(row.created_at),
  ];
  if (helpers.includePaymentFields) {
    haystacks.push(row.payment_mode, row.payment_status, row.payment_details);
  }
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

function parseInventoryNumeric(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumInventoryNumericField(
  rows: InventoryRow[],
  getter: (row: InventoryRow) => number | string | null | undefined,
): number {
  let sum = 0;
  for (const row of rows) {
    const value = parseInventoryNumeric(getter(row));
    if (value != null) sum += value;
  }
  return sum;
}

function sumInventoryNumberField(
  rows: InventoryRow[],
  key: "transport_charges" | "loading_charges" | "invoice_amount",
): number {
  let sum = 0;
  for (const row of rows) {
    const value = row[key];
    if (value != null && typeof value === "number" && Number.isFinite(value)) {
      sum += value;
    }
  }
  return sum;
}

function formatInventoryTotal(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

type InventoryNumericTotal = {
  id: InventoryTableColumnId;
  label: string;
  value: number;
  adminOnly?: boolean;
};

const INVENTORY_NUMERIC_TOTAL_FIELDS: {
  id: InventoryTableColumnId;
  label: string;
  adminOnly?: boolean;
}[] = [
  { id: "transport_charges", label: "Trans. charges" },
  { id: "loading_charges", label: "Loading ch." },
  { id: "number_of_parcels", label: "Parcels" },
  { id: "billed_quantity", label: "Billed qty" },
  { id: "received_quantity", label: "Received qty" },
  { id: "invoice_amount", label: "Inv. amount" },
];

function computeInventoryNumericTotals(rows: InventoryRow[]): InventoryNumericTotal[] {
  return INVENTORY_NUMERIC_TOTAL_FIELDS.map((field) => {
    let value = 0;
    switch (field.id) {
      case "transport_charges":
        value = sumInventoryNumberField(rows, "transport_charges");
        break;
      case "loading_charges":
        value = sumInventoryNumberField(rows, "loading_charges");
        break;
      case "invoice_amount":
        value = sumInventoryNumberField(rows, "invoice_amount");
        break;
      case "number_of_parcels":
        value = sumInventoryNumericField(rows, (row) => row.number_of_parcels);
        break;
      case "billed_quantity":
        value = sumInventoryNumericField(rows, (row) => row.billed_quantity);
        break;
      case "received_quantity":
        value = sumInventoryNumericField(rows, (row) => row.received_quantity);
        break;
    }
    return { ...field, value };
  });
}

function InventoryTotalsBar({
  rowCount,
  totals,
}: {
  rowCount: number;
  totals: InventoryNumericTotal[];
}) {
  return (
    <div className="border-b border-[#245236]/15 bg-[#FEED01]/10 px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#245236]/70">
        Totals across {rowCount.toLocaleString()} row{rowCount === 1 ? "" : "s"}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
        {totals.map((total) => (
          <div key={total.id}>
            <dt className="text-xs text-[#245236]/70">{total.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-[#245236]">
              {formatInventoryTotal(total.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function previewText(s: string | null | undefined, max = 48) {
  if (!s?.trim()) return "—";
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function linkCellButton(url: string | null | undefined, canOpen: boolean) {
  const href = url?.trim();
  if (!href) return "—";

  if( !canOpen)
  {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-md bg-[#245236] px-2.5 py-1 text-xs font-medium text-[#FEED01] hover:bg-[#1c3f2a]"
    >
      Open
    </a>
  );
}
else
{
  return (
    <span className="font-medium text-[#245236]/50">file uploaded</span>
  );
}
}
