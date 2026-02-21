export default function WikiContentSkeleton() {
  return (
    <div className="flex-1 border border-border bg-card rounded-xl elevation-2 overflow-hidden p-8 lg:p-12">
      {/* Title skeleton */}
      <div className="h-8 bg-muted/60 rounded-lg animate-pulse" style={{ width: '75%' }} />

      {/* Badge skeleton */}
      <div className="h-5 w-20 bg-muted/40 rounded-full animate-pulse mt-4" />

      {/* First paragraph block */}
      <div className="mt-8 space-y-3">
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '100%' }} />
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '83%' }} />
        <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '80%' }} />
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '100%' }} />
        <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '75%' }} />
      </div>

      {/* Code block skeleton */}
      <div className="h-32 bg-muted/30 rounded-lg animate-pulse mt-8 border border-border/50" />

      {/* Second paragraph block */}
      <div className="mt-8 space-y-3">
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '90%' }} />
        <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '70%' }} />
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '85%' }} />
        <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '60%' }} />
      </div>

      {/* Subheading skeleton */}
      <div className="h-6 bg-muted/50 rounded-lg animate-pulse mt-10" style={{ width: '45%' }} />

      {/* Third paragraph block */}
      <div className="mt-6 space-y-3">
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '95%' }} />
        <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '88%' }} />
        <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '72%' }} />
      </div>
    </div>
  );
}
