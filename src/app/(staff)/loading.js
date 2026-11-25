// Shown by Next.js straight away when you open a staff page, until the page's data
// (patients, doses, the chart) has loaded. The top bar stays in place.
export default function Loading() {
  return (
    <div className="stack" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="skeleton" style={{ height: 34, width: 220 }} />
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton" style={{ height: 14, width: '60%' }} />
            <div className="skeleton" style={{ height: 30, width: '40%', marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    </div>
  );
}
