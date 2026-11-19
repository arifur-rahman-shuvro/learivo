export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="lv-card flex flex-col gap-2 p-4" aria-hidden="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a dashboard-style screen: one wide card, then two half cards. */
export function PanelSkeleton() {
  const bar = "animate-pulse rounded bg-surface-3 motion-reduce:animate-none";
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      <div className="lv-card flex items-center gap-5 p-5" aria-hidden="true">
        <div className={`size-24 shrink-0 rounded-full ${bar}`} />
        <div className="flex flex-1 flex-col gap-2.5">
          <div className={`h-4 w-2/3 ${bar}`} />
          <div className={`h-3 w-1/2 ${bar}`} />
          <div className={`h-3 w-3/5 ${bar}`} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="lv-card flex flex-col gap-3 p-5">
            <div className={`h-4 w-1/3 ${bar}`} />
            <div className={`h-20 w-full ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
