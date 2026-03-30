export default function DocumentsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-8 w-44 animate-pulse rounded-md bg-[#245236]/20" />
      <div className="rounded-xl border border-[#245236]/20 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div className="h-6 w-72 animate-pulse rounded bg-[#245236]/15" />
          <div className="h-12 animate-pulse rounded-lg bg-[#FEED01]/30" />
          <div className="h-10 w-48 animate-pulse rounded-lg bg-[#245236]/20" />
        </div>
      </div>
    </div>
  );
}
