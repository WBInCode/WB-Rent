export function AnimatedBackground() {
  return (
    <div className="site-backdrop" aria-hidden="true">
      <div className="site-backdrop-grid" />
      <div className="site-backdrop-band" />
      <div className="site-backdrop-line site-backdrop-line-top" />
      <div className="site-backdrop-line site-backdrop-line-bottom" />
    </div>
  );
}