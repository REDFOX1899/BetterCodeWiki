export default function WikiPageTransitionSkeleton() {
  return (
    <div className="p-8 lg:p-12">
      {/* Title skeleton — lighter weight */}
      <div className="h-7 bg-muted/40 rounded-lg animate-pulse" style={{ width: '60%' }} />

      {/* Badge skeleton */}
      <div className="h-4 w-16 bg-muted/30 rounded-full animate-pulse mt-4" />

      {/* Paragraph block */}
      <div className="mt-6 space-y-3">
        <div className="h-3.5 bg-muted/30 rounded-lg animate-pulse" style={{ width: '100%' }} />
        <div className="h-3.5 bg-muted/25 rounded-lg animate-pulse" style={{ width: '90%' }} />
        <div className="h-3.5 bg-muted/30 rounded-lg animate-pulse" style={{ width: '78%' }} />
        <div className="h-3.5 bg-muted/25 rounded-lg animate-pulse" style={{ width: '85%' }} />
      </div>

      {/* Code block skeleton — lighter */}
      <div className="h-24 bg-muted/20 rounded-lg animate-pulse mt-6 border border-border/30" />

      {/* Another paragraph block */}
      <div className="mt-6 space-y-3">
        <div className="h-3.5 bg-muted/30 rounded-lg animate-pulse" style={{ width: '88%' }} />
        <div className="h-3.5 bg-muted/25 rounded-lg animate-pulse" style={{ width: '65%' }} />
        <div className="h-3.5 bg-muted/30 rounded-lg animate-pulse" style={{ width: '75%' }} />
      </div>
    </div>
  );
}
