'use client';

export default function ErrorPage({ reset }) {
  return (
    <main className="container narrow">
      <div className="card" style={{ marginTop: 48 }}>
        <h1>Something went wrong</h1>
        <p>The problem has been logged. Please try again in a moment.</p>
        <button type="button" className="button primary" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
