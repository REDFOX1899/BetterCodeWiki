export default function WikiSidebarSkeleton() {
  return (
    <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col border border-border bg-card rounded-xl elevation-2 overflow-hidden">
      {/* Title area skeleton */}
      <div className="p-4 border-b border-border bg-muted/10">
        <div className="h-5 bg-muted/60 rounded-lg animate-pulse" style={{ width: '70%' }} />
        <div className="h-3 bg-muted/40 rounded-lg animate-pulse mt-2" style={{ width: '90%' }} />
        <div className="h-3 bg-muted/40 rounded-lg animate-pulse mt-1" style={{ width: '60%' }} />
        <div className="flex items-center gap-2 mt-3">
          <div className="h-5 w-20 bg-muted/50 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Tree items skeleton */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Section header */}
        <div className="h-4 bg-muted/60 rounded-lg animate-pulse" style={{ width: '85%' }} />
        {/* Nested page items */}
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse ml-3" style={{ width: '70%' }} />
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse ml-3" style={{ width: '60%' }} />
        {/* Deeper nested item */}
        <div className="h-4 bg-muted/40 rounded-lg animate-pulse ml-6" style={{ width: '55%' }} />
        {/* Another section header */}
        <div className="h-4 bg-muted/60 rounded-lg animate-pulse mt-1" style={{ width: '75%' }} />
        {/* Nested page items */}
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse ml-3" style={{ width: '65%' }} />
        <div className="h-4 bg-muted/40 rounded-lg animate-pulse ml-3" style={{ width: '50%' }} />
        {/* Another section header */}
        <div className="h-4 bg-muted/60 rounded-lg animate-pulse mt-1" style={{ width: '80%' }} />
      </div>
    </aside>
  );
}
