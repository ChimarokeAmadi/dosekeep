import { DoseStatus } from '@/components/ui';
import { formatRate } from '@/lib/adherence';
import { getDb } from '@/lib/db';
import { formatDateTime, formatDay } from '@/lib/format';
import { portalView } from '@/services/doses';
import { findByPortalToken } from '@/services/patients';
import { TakeDoseButton } from './TakeDoseButton';

// The patient's private page. No login: the long random token in the link is the key.
export const metadata = { title: 'My medicines', robots: { index: false, follow: false } };

export default async function PortalPage({ params }) {
  const { token } = await params;
  const db = await getDb();
  const found = await findByPortalToken(db, token);

  if (!found) {
    return (
      <main className="container portal">
        <div className="card" style={{ marginTop: 40 }}>
          <h1>This link doesn&apos;t work</h1>
          <p>It may have been replaced by a newer one. Please ask your clinic to send you a new link.</p>
        </div>
      </main>
    );
  }

  const { patient, clinic } = found;
  const view = await portalView(db, { clinic, patient });
  const counted = view.week.taken + view.week.missed;

  return (
    <main className="container portal stack">
      <div style={{ marginTop: 24 }}>
        <p className="muted" style={{ margin: 0 }}>
          {clinic.name}
        </p>
        <h1>Hello {patient.name.split(' ')[0]}</h1>
        <p className="muted">{formatDay(view.day)}</p>
      </div>

      <section className="card" aria-labelledby="today">
        <h2 id="today">Today&apos;s medicines</h2>
        {view.today.length === 0 ? (
          <p className="empty">Nothing to take today.</p>
        ) : (
          view.today.map((d) => (
            <div className="dose" key={`${d.medicationId}-${d.time}`}>
              <div>
                <div className="dose-name">
                  {d.time} · {d.medication.name}
                </div>
                <div className="dose-meta">
                  {d.medication.dosage}
                  {d.medication.instructions && ` · ${d.medication.instructions}`}
                </div>
              </div>
              {d.status === 'due' ? (
                <TakeDoseButton token={token} medicationId={String(d.medicationId)} at={d.at.toISOString()} />
              ) : (
                <DoseStatus status={d.status} />
              )}
            </div>
          ))
        )}
        <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: '0.9rem' }}>
          You can tick a dose from 1 hour before to 3 hours after its time.
        </p>
      </section>

      <section className="card">
        <h2>This week</h2>
        <p style={{ margin: 0 }}>
          {counted === 0 ? 'No doses yet this week.' : `You took ${view.week.taken} of ${counted} doses (${formatRate(view.week.rate)}).`}
        </p>
      </section>

      {view.nextAppointment && (
        <section className="card">
          <h2>Next appointment</h2>
          <p style={{ margin: 0 }}>
            {formatDateTime(view.nextAppointment.at, clinic.timezone)}: {view.nextAppointment.reason}
          </p>
        </section>
      )}
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Keep this link private: anyone with it can see this page. Questions about your medicines? Call your clinic.
      </p>
    </main>
  );
}
