import Link from 'next/link';
import { AdherenceChart } from '@/components/AdherenceChart';
import { DoseStatus, Empty, Rate, Stat } from '@/components/ui';
import { formatRate } from '@/lib/adherence';
import { formatDateTime, formatDay } from '@/lib/format';
import { requireStaff } from '@/server/session';
import { clinicOverview } from '@/services/dashboard';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const { db, clinic } = await requireStaff();
  const o = await clinicOverview(db, { clinic });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{clinic.name}</h1>
          <p>
            {formatDay(o.today)} · times in {clinic.timezone}
          </p>
        </div>
        <Link href="/patients/new" className="button primary">
          Add patient
        </Link>
      </div>

      <div className="stats">
        <Stat label="Patients" value={o.patients.length} />
        <Stat label="Adherence, last 7 days" value={formatRate(o.week.rate)} note={`${o.week.taken} of ${o.week.taken + o.week.missed} doses taken`} />
        <Stat label="Missed today" value={o.todaySummary.missed} note={`${o.todaySummary.taken} taken so far`} />
        <Stat label="Patients at risk" value={o.atRisk.length} note="under 80% this week" tone={o.atRisk.length ? 'warn' : undefined} />
      </div>

      <div className="card">
        <AdherenceChart daily={o.daily} title="Clinic adherence, last 14 days" />
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="risk">
          <div className="section-head">
            <h2 id="risk">Patients to call</h2>
            <span className="muted">under 80% in the last 7 days</span>
          </div>
          {o.atRisk.length === 0 ? (
            <Empty>Nobody is under 80% this week.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Phone</th>
                    <th scope="col" className="num hide-sm">Missed</th>
                    <th scope="col" className="num">Adherence</th>
                  </tr>
                </thead>
                <tbody>
                  {o.atRisk.map(({ patient, week }) => (
                    <tr key={String(patient._id)}>
                      <td>
                        <Link href={`/patients/${patient._id}`}>{patient.name}</Link>
                      </td>
                      <td>
                        <a href={`tel:${patient.phone}`}>{patient.phone}</a>
                      </td>
                      <td className="num hide-sm">{week.missed}</td>
                      <td className="num">
                        <Rate summary={week} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="due">
          <div className="section-head">
            <h2 id="due">Due now</h2>
            <span className="muted">not confirmed yet</span>
          </div>
          {o.dueNow.length === 0 ? (
            <Empty>No open doses right now.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {o.dueNow.map((d) => (
                    <tr key={`${d.medicationId}-${d.at.toISOString()}`}>
                      <td>
                        <Link href={`/patients/${d.patientId}`}>{d.patient?.name}</Link>
                      </td>
                      <td>
                        {d.medication.name} <span className="muted">{d.time}</span>
                      </td>
                      <td>
                        <DoseStatus status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={{ marginTop: 24 }}>Appointments this week</h2>
          {o.appointments.length === 0 ? (
            <Empty>No appointments in the next 7 days.</Empty>
          ) : (
            <ul>
              {o.appointments.map((a) => (
                <li key={String(a._id)}>
                  {formatDateTime(a.at, clinic.timezone)}: <Link href={`/patients/${a.patientId}`}>{a.patient.name}</Link>{' '}
                  <span className="muted">({a.reason})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
