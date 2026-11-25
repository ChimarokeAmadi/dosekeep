import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { SubmitButton } from '@/components/SubmitButton';
import { logoutAction } from '@/server/actions';
import { requireStaff } from '@/server/session';

export default async function StaffLayout({ children }) {
  const { clinic, user } = await requireStaff();
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Brand />
          <nav className="nav" aria-label="Main">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/patients">Patients</Link>
            <Link href="/reminders">Reminders</Link>
            <Link href="/team">Team</Link>
          </nav>
          <div className="who">
            <span className="hide-sm">
              {user.name} · {clinic.name}
            </span>
            <form action={logoutAction} className="inline-form">
              <SubmitButton
                pendingLabel="Signing out…"
                confirm={{ title: 'Sign out?', message: "You'll need your email and password to sign in again.", confirmLabel: 'Sign out' }}
              >
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
