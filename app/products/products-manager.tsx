"use client";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProduct, deleteProduct, updateProduct } from "./actions";
import Modal from "@/app/components/Modal";
import type { BrandOptionRow, ProductRow } from "./types";

type Props = {
  products: ProductRow[];
  brands: BrandOptionRow[];
};

export function ProductsManager({ products, brands }: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  async function runCreate(formData: FormData) {
    setFormError(null);
    const r = await createProduct(formData);
    if (r.error) {
      setFormError(r.error);
      return;
    }
    router.refresh();
    setIsCreateOpen(false);
    (document.getElementById("create-product-form") as HTMLFormElement)?.reset();
  }

  async function runUpdate(formData: FormData) {
    setRowError(null);
    const r = await updateProduct(formData);
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
      const r = await deleteProduct(id);
      if (r.error) {
        setRowError(r.error);
        return;
      }
      if (editingId === id) setEditingId(null);
      router.refresh();
    });
  }

  const brandLabel = (brandId: string | null) => {
    if (!brandId) return "—";
    const b = brands.find((x) => x.id === brandId);
    return b?.brand_name?.trim() ? b.brand_name : b?.id ?? brandId;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {products.length === 0
            ? "No products yet."
            : `${products.length} product${products.length === 1 ? "" : "s"}.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex h-[38px] items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add new
        </button>
      </div>

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add product"
        description="Create a row in public.Products."
        panelClassName="max-w-5xl"
      >
        {formError ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
          >
            {formError}
          </p>
        ) : null}
        <form id="create-product-form" action={runCreate} className="mt-4">
          <ProductFormFields mode="create" brands={brands} />
        </form>
      </Modal>

      {rowError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
        >
          {rowError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {products.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">No products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Style</th>
                  <th className="px-4 py-3">Fabric</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {products.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                  >
                    {editingId === row.id ? (
                      <td colSpan={8} className="px-4 py-3">
                        <form action={runUpdate} className="space-y-3">
                          <input type="hidden" name="id" value={row.id} />
                          <ProductFormFields mode="edit" values={row} brands={brands} />
                          <div className="flex gap-2">
                            <SubmitButton className="h-[38px] rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                              Save
                            </SubmitButton>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setRowError(null);
                              }}
                              className="h-[38px] rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {row.product_name ?? "—"}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          <span className="line-clamp-2">
                            {row.product_description ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {brandLabel(row.brand_name)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {row.style ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {row.fabric ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {row.updated_at ? formatDate(row.updated_at) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRowError(null);
                                setEditingId(row.id);
                              }}
                              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => runDelete(row.id)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
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
  );
}

function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "…" : children}
    </button>
  );
}

function ProductFormFields({
  mode,
  values,
  brands,
}: {
  mode: "create" | "edit";
  values?: ProductRow;
  brands: BrandOptionRow[];
}) {
  const v = values;
  const selectClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Product name
        <input
          name="product_name"
          type="text"
          autoComplete="off"
          defaultValue={v?.product_name ?? ""}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          placeholder="Name"
        />
      </label>

      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Brand
        <select name="brand_name" defaultValue={v?.brand_name ?? ""} className={selectClass}>
          <option value="">No brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.brand_name?.trim() ? b.brand_name : b.id}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Style
        <input
          name="style"
          type="text"
          autoComplete="off"
          defaultValue={v?.style ?? ""}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          placeholder="Style"
        />
      </label>

      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Fabric
        <input
          name="fabric"
          type="text"
          autoComplete="off"
          defaultValue={v?.fabric ?? ""}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          placeholder="Fabric"
        />
      </label>

      <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Description
        <textarea
          name="product_description"
          defaultValue={v?.product_description ?? ""}
          className="min-h-[86px] resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          placeholder="Description…"
        />
      </label>

      {mode === "create" ? (
        <SubmitButton className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          Create
        </SubmitButton>
      ) : null}
    </div>
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
