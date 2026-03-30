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
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
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

      <p className="text-xs text-[#245236]/70">
        Files are saved in your own OneDrive under the folder from{" "}
        <code className="text-[11px]">ONEDRIVE_UPLOAD_FOLDER</code> (default:{" "}
        <code className="text-[11px]">My App Uploads</code>).{" "}
        <a
          href="/api/auth/microsoft"
          className="font-medium text-[#245236] underline-offset-2 hover:underline"
        >
          Connect Microsoft
        </a>{" "}
        if uploads fail with a sign-in message.
      </p>

      <label className="flex flex-col gap-1 text-xs font-medium text-[#245236]/80">
        PDF or image
        <input
          name="document"
          type="file"
          accept="application/pdf,image/*"
          className="rounded-lg border border-[#245236]/25 bg-white px-3 py-2 text-sm text-[#245236] file:mr-3 file:rounded-md file:border-0 file:bg-[#245236] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#FEED01] hover:file:bg-[#1c3f2a]"
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
      className="h-[38px] rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Uploading..." : "Upload to OneDrive"}
    </button>
  );
}
