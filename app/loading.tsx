function SkeletonCard() {
  return (
    <div
      className="overflow-hidden rounded-xl animate-pulse"
      style={{ background: 'var(--surface)' }}
    >
      <div className="aspect-square w-full" style={{ background: 'var(--surface-3)' }} />
      <div className="p-2.5 space-y-2">
        <div className="h-4 w-16 rounded" style={{ background: 'var(--surface-3)' }} />
        <div className="h-3 w-full rounded" style={{ background: 'var(--surface-3)' }} />
        <div className="h-3 w-3/4 rounded" style={{ background: 'var(--surface-3)' }} />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen">
      {/* Placeholder com mesma altura do Header para evitar layout shift */}
      <div
        className="sticky top-0 z-50 h-[53px]"
        style={{
          background:           'var(--header-bg)',
          backdropFilter:       'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom:         '1px solid rgba(59, 130, 246, 0.18)',
        }}
      />
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
        {/* Header skeleton */}
        <div className="mb-7 h-10 w-48 rounded-lg animate-pulse" style={{ background: 'var(--surface)' }} />
        {/* Filters skeleton */}
        <div className="mb-5 flex gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-md animate-pulse" style={{ background: 'var(--surface)', animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
        {/* Ad placeholder */}
        <div className="mb-6 h-20 rounded-lg animate-pulse" style={{ background: 'var(--surface)' }} />
        {/* Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ animationDelay: `${i * 35}ms` }}>
              <SkeletonCard />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
