"use client";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTransport, updateTransport } from "./actions";
import Modal from "@/app/components/Modal";
import type { TransportRow } from "./types";

type Props = {
  transports: TransportRow[];
};

export function TransportsManager({ transports }: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function runCreate(formData: FormData) {
    setFormError(null);
    const r = await createTransport(formData);
    if (r.error) {
      setFormError(r.error);
      return;
    }
    router.refresh();
    setIsCreateOpen(false);
    (document.getElementById("create-transport-form") as HTMLFormElement)
      ?.reset();
  }

  async function runUpdate(formData: FormData) {
    setRowError(null);
    const r = await updateTransport(formData);
    if (r.error) {
      setRowError(r.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#245236]/75">
          {transports.length === 0
            ? "No transports yet."
            : `${transports.length} transport${transports.length === 1 ? "" : "s"} in the list.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
        >
          Add new
        </button>
      </div>

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add transport"
        description="Create a new transport."
      >
        {formError ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {formError}
          </p>
        ) : null}

        <form id="create-transport-form" action={runCreate} className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
              Transport name
              <input
                name="transport_name"
                type="text"
                autoComplete="off"
                className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                placeholder="Fast Freight"
              />
            </label>
            <SubmitButton className="h-[38px] rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:opacity-60">
              Create
            </SubmitButton>
          </div>
        </form>
      </Modal>

      {rowError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {rowError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#245236]/20 bg-white shadow-sm">
        {transports.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            No transports yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[#245236]/20 bg-[#FEED01]/25 text-xs font-medium uppercase tracking-wide text-[#245236]/80">
                <tr>
                  <th className="px-4 py-3">Transport</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#245236]/15">
                {transports.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#FEED01]/20"
                  >
                    {editingId === row.id ? (
                      <td colSpan={4} className="px-4 py-3">
                        <form
                          action={runUpdate}
                          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-[#245236]/80">
                            Transport name
                            <input
                              name="transport_name"
                              type="text"
                              defaultValue={row.transport_name ?? ""}
                              className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] outline-none ring-[#245236]/40 focus:ring-2"
                            />
                          </label>
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
                          {row.transport_name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#245236]/80">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#245236]/80">
                          {row.updated_at ? formatDate(row.updated_at) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
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

