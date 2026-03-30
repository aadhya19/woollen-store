export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-[#245236]/20" />
      <div className="rounded-2xl border border-[#245236]/20 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-14 animate-pulse rounded-xl border border-[#245236]/20 bg-[#FEED01]/30"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
