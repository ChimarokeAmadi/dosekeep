import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container narrow">
      <div className="card" style={{ marginTop: 48 }}>
        <h1>Page not found</h1>
        <p>This page doesn&apos;t exist, or it belongs to another clinic.</p>
        <Link href="/" className="button">
          Go home
        </Link>
      </div>
    </main>
  );
}
