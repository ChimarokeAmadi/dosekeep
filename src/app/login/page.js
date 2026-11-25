import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { FormShell } from '@/components/FormShell';
import { loginAction } from '@/server/actions';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
  const { expired } = await searchParams;
  return (
    <main className="container narrow">
      <div style={{ margin: '40px 0 24px' }}>
        <Brand />
      </div>
      <div className="card stack">
        <h1>Staff sign in</h1>
        {expired && <p className="alert alert-error">Your session ended. Please sign in again.</p>}
        <FormShell
          action={loginAction}
          submitLabel="Sign in"
          pendingLabel="Signing in…"
          fields={[
            { name: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
            { name: 'password', label: 'Password', type: 'password', required: true, autoComplete: 'current-password' },
          ]}
        />
        <p className="muted">
          New clinic? <Link href="/register">Register here</Link>. Patients don&apos;t need an account: use the link from your SMS.
        </p>
      </div>
    </main>
  );
}
