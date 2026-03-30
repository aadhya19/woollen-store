"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadDocument, type UploadDocumentResult } from "./actions";

const initialState: UploadDocumentResult = {
  error: null,
  success: null,
  fileUrl: null,
};

export function UploadForm() {
  const [state, formAction] = useActionState(
    async (_state: UploadDocumentResult, payload: unknown) =>
      uploadDocument(payload as FormData),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200">
          {state.success}{" "}
          {state.fileUrl ? (
            <a
              href={state.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              View file
            </a>
          ) : null}
        </p>
      ) : null}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Files are saved in your own OneDrive under the folder from{" "}
        <code className="text-[11px]">ONEDRIVE_UPLOAD_FOLDER</code> (default:{" "}
        <code className="text-[11px]">My App Uploads</code>).{" "}
        <a
          href="/api/auth/microsoft"
          className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          Connect Microsoft
        </a>{" "}
        if uploads fail with a sign-in message.
      </p>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        PDF or image
        <input
          name="document"
          type="file"
          accept="application/pdf,image/*"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
        />
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[38px] rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Uploading..." : "Upload to OneDrive"}
    </button>
  );
}
