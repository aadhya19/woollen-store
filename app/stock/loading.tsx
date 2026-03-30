export default function StockLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-8 w-36 animate-pulse rounded-md bg-[#245236]/20" />
      <div className="rounded-xl border border-[#245236]/20 bg-white p-5 shadow-sm">
        <div className="h-10 w-full animate-pulse rounded-lg bg-[#FEED01]/30" />
      </div>
      <div className="rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm">
        <div className="mb-3 h-6 w-64 animate-pulse rounded bg-[#245236]/15" />
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-11 animate-pulse rounded bg-[#FEED01]/25" />
          ))}
        </div>
      </div>
    </div>
  );
}
