/** Shared loading placeholders — replaces bare "Loading…" text. */

export function RowSkeleton({ rounded = "rounded-2xl" }: { rounded?: string }) {
  return (
    <div className={`flex items-center gap-3 border border-border bg-card p-3 animate-pulse ${rounded}`}>
      <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

export function PersonCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm animate-pulse">
      <div className="flex gap-3">
        <div className="h-16 w-16 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-1/2 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="flex gap-1.5 pt-1">
            <div className="h-4 w-14 rounded-full bg-muted" />
            <div className="h-4 w-12 rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <div className="h-7 w-24 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function PeopleSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <PersonCardSkeleton key={i} />
      ))}
    </div>
  );
}
