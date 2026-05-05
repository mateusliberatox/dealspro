import { Header } from '@/components/header';

function SkeletonCard() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border animate-pulse"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="aspect-[4/3] w-full" style={{ background: 'var(--surface-3)' }} />
      <div className="p-3 space-y-2.5">
        <div className="h-2.5 w-1/3 rounded-full" style={{ background: 'var(--surface-3)' }} />
        <div className="h-3 w-full rounded-full" style={{ background: 'var(--surface-3)' }} />
        <div className="h-3 w-4/5 rounded-full" style={{ background: 'var(--surface-3)' }} />
        <div className="flex items-center justify-between border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
          <div className="h-4 w-14 rounded-full" style={{ background: 'var(--surface-3)' }} />
          <div className="h-6 w-16 rounded-lg" style={{ background: 'var(--surface-3)' }} />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* Hero skeleton */}
        <div
          className="mb-6 h-24 rounded-2xl animate-pulse"
          style={{ background: 'var(--surface)' }}
        />

        {/* Category filter skeleton */}
        <div className="mb-4 flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-8 shrink-0 w-24 rounded-full animate-pulse"
              style={{ background: 'var(--surface)', animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        {/* Ad placeholder */}
        <div className="mb-6 h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />

        {/* Product grid skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ animationDelay: `${i * 40}ms` }}>
              <SkeletonCard />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
