import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { getSession } from '@/server/session';

export default async function Home() {
  const session = await getSession();
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Brand />
          <nav className="nav" aria-label="Main" />
          {session ? (
            <Link href="/dashboard" className="button primary">
              Open dashboard
            </Link>
          ) : (
            <div className="button-row">
              <Link href="/login" className="button">
                Sign in
              </Link>
              <Link href="/register" className="button primary">
                Register a clinic
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <h1>Fewer missed doses, fewer missed visits.</h1>
            <p className="lead">
              DoseKeep reminds patients by SMS when a dose or a clinic visit is due, lets them confirm each dose from a simple
              link, and shows the clinic who is falling behind, so nurses can call them before a missed week becomes a hospital visit.
            </p>
            <div className="button-row">
              <Link href="/register" className="button primary">
                Register your clinic
              </Link>
              <Link href="/login" className="button">
                Staff sign in
              </Link>
            </div>
          </div>
          <div className="phone" aria-label="Example of the SMS a patient receives">
            <p className="sms">Sunrise Clinic: hi Chidi, it&apos;s time for Metformin 500 mg (20:00). Mark it as taken with your DoseKeep link.</p>
            <p className="sms">Sunrise Clinic: hi Chidi, a reminder of your appointment tomorrow (2026-11-28) at 10:00: Blood sugar check.</p>
            <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              Works on any phone. The link needs no app and no password.
            </p>
          </div>
        </section>

        <section aria-labelledby="why">
          <h2 id="why">Why this matters</h2>
          <div className="facts">
            <div className="card fact">
              <strong>≈50%</strong>
              of people with long-term conditions do not take their medicines as prescribed (WHO, 2003).
            </div>
            <div className="card fact">
              <strong>Forgetting</strong>
              is the most common reason patients give for missing doses, and reminders are a proven, low-cost fix.
            </div>
            <div className="card fact">
              <strong>SMS</strong>
              reaches feature phones without mobile data, which many patients in Nigeria still rely on.
            </div>
          </div>
        </section>

        <section className="features" aria-label="Features">
          <div className="card">
            <h3>Reminders that send themselves</h3>
            <p className="muted">Every 15 minutes DoseKeep texts patients whose dose is due, and texts everyone with a visit the next day.</p>
          </div>
          <div className="card">
            <h3>One tap to confirm</h3>
            <p className="muted">Each patient gets a private link to see today&apos;s medicines and tap &quot;I took it&quot;.</p>
          </div>
          <div className="card">
            <h3>See who needs a call</h3>
            <p className="muted">The dashboard flags patients under 80% adherence this week, with the doses they missed.</p>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="container">DoseKeep: a GoMyCode capstone project. Not a medical device: always follow your clinician&apos;s advice.</div>
      </footer>
    </>
  );
}
