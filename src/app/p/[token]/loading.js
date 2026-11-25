// Shown while a patient's portal page loads (slow mobile connections).
export default function Loading() {
  return (
    <main className="container portal stack" role="status" aria-live="polite">
      <span className="sr-only">Loading your medicines…</span>
      <div className="skeleton" style={{ height: 34, width: '70%', marginTop: 32 }} />
      <div className="card">
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    </main>
  );
}
