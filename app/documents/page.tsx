import { requireAuth } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import { UploadForm } from "./upload-form";

type Props = {
  searchParams: Promise<{ error?: string; connected?: string }>;
};

export default async function DocumentsPage({ searchParams }: Props) {
  await requireAuth(["admin", "user"]);
  const q = await searchParams;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Documents"
        description="Upload one PDF or image file to your OneDrive after you connect Microsoft."
        actions={
          <a
            href="/api/auth/microsoft"
            className="inline-flex h-[38px] items-center rounded-lg bg-[#245236] px-4 text-sm font-semibold text-[#FEED01] hover:bg-[#1c3f2a]"
          >
            Connect Microsoft OneDrive
          </a>
        }
      />

      {q.error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {q.error}
        </div>
      ) : null}

      {q.connected === "1" ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Microsoft account connected. You can upload files below.
        </div>
      ) : null}

      <section className="rounded-xl border border-[#245236]/20 bg-white p-5 shadow-sm">
        <UploadForm />
      </section>
    </div>
  );
}
