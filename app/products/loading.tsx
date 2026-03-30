export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-md bg-[#245236]/20" />
      <div className="rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm">
        <div className="h-10 w-full animate-pulse rounded-lg bg-[#FEED01]/30" />
      </div>
      <div className="rounded-xl border border-[#245236]/20 bg-white p-4 shadow-sm">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="mb-2 h-11 animate-pulse rounded bg-[#FEED01]/20 last:mb-0" />
        ))}
      </div>
    </div>
  );
}
