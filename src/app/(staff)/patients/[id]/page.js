import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/ActionButton';
import { AdherenceChart } from '@/components/AdherenceChart';
import { FormShell } from '@/components/FormShell';
import { SubmitButton } from '@/components/SubmitButton';
import { DoseStatus, Empty, Rate, Stat } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { localDate } from '@/lib/time';
import {
  addAppointmentAction,
  addMedicationAction,
  appointmentStatusAction,
  resetLinkAction,
  staffLogDoseAction,
  staffUnlogDoseAction,
  stopMedicationAction,
} from '@/server/actions';
import { requireStaff } from '@/server/session';
import { patientReport } from '@/services/dashboard';
import { listAppointments, listMedications } from '@/services/medications';
import { getPatient } from '@/services/patients';

export const metadata = { title: 'Patient' };

function RecordButton({ patientId, dose }) {
  return (
    <form action={staffLogDoseAction.bind(null, patientId, String(dose.medicationId), dose.at.toISOString())} className="inline-form">
      <SubmitButton pendingLabel="Recording…">Record as taken</SubmitButton>
    </form>
  );
}

// For a dose recorded as taken by mistake. It removes the record, so the dose is
// calculated again: missed if its window has passed, due if it is still open.
function UndoButton({ patientId, dose }) {
  return (
    <form action={staffUnlogDoseAction.bind(null, patientId, String(dose.medicationId), dose.at.toISOString())} className="inline-form">
      <SubmitButton pendingLabel="Saving…" confirmText={`Record ${dose.medication.name} at ${dose.time} as NOT taken?`}>
        Record as missed
      </SubmitButton>
    </form>
  );
}

export default async function PatientPage({ params }) {
  const { id } = await params;
  const { db, clinic } = await requireStaff();
  const patient = await getPatient(db, clinic._id, id);
  if (!patient) notFound();

  const [report, medications, appointments] = await Promise.all([
    patientReport(db, { clinic, patient }),
    listMedications(db, clinic._id, patient._id),
    listAppointments(db, clinic._id, { patientId: patient._id }),
  ]);
  const today = localDate(new Date(), clinic.timezone);
  const now = new Date();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link href="/patients">← Patients</Link>
          <h1 style={{ marginTop: 8 }}>{patient.name}</h1>
          <p>
            <a href={`tel:${patient.phone}`}>{patient.phone}</a>
            {patient.condition && <> · {patient.condition}</>}
          </p>
        </div>
        <ActionButton
          action={resetLinkAction.bind(null, id)}
          label="Send a new portal link"
          pendingLabel="Sending…"
          confirmText="The current link will stop working. Send a new one?"
        />
      </div>

      <div className="stats">
        <Stat label="Last 7 days" value={<Rate summary={report.week} />} note={`${report.week.taken} taken, ${report.week.missed} missed`} />
        <Stat label="Last 30 days" value={<Rate summary={report.month} />} note={`${report.month.taken} taken, ${report.month.missed} missed`} />
        <Stat label="Active medicines" value={medications.filter((m) => !m.endDate || m.endDate >= today).length} />
      </div>

      <div className="card">
        <AdherenceChart daily={report.daily} title={`${patient.name.split(' ')[0]}'s adherence, last 30 days`} />
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="today">
          <h2 id="today">Today</h2>
          {report.todayDoses.length === 0 ? (
            <Empty>No doses scheduled today.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {report.todayDoses.map((d) => (
                    <tr key={`${d.medicationId}-${d.time}`}>
                      <td>{d.time}</td>
                      <td>
                        {d.medication.name} <span className="muted">{d.medication.dosage}</span>
                      </td>
                      <td>
                        <DoseStatus status={d.status} />
                      </td>
                      <td className="num">
                        {(d.status === 'due' || d.status === 'missed') && <RecordButton patientId={id} dose={d} />}
                        {d.status === 'taken' && <UndoButton patientId={id} dose={d} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={{ marginTop: 24 }}>Recently missed</h2>
          {report.recentMissed.length === 0 ? (
            <Empty>No missed doses in the last 30 days.</Empty>
          ) : (
            <>
              <p className="muted">If the patient says they did take one, record it here.</p>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {report.recentMissed.map((d) => (
                      <tr key={`${d.medicationId}-${d.at.toISOString()}`}>
                        <td>{formatDateTime(d.at, clinic.timezone)}</td>
                        <td>{d.medication.name}</td>
                        <td className="num">
                          <RecordButton patientId={id} dose={d} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="appointments">
          <h2 id="appointments">Appointments</h2>
          {appointments.length === 0 ? (
            <Empty>No appointments yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {appointments.map((a) => (
                    <tr key={String(a._id)}>
                      <td>{formatDateTime(a.at, clinic.timezone)}</td>
                      <td>{a.reason}</td>
                      <td>
                        {a.status === 'scheduled' && a.at < now ? (
                          <div className="button-row">
                            <form action={appointmentStatusAction.bind(null, id, String(a._id), 'attended')} className="inline-form">
                              <SubmitButton>Attended</SubmitButton>
                            </form>
                            <form action={appointmentStatusAction.bind(null, id, String(a._id), 'missed')} className="inline-form">
                              <SubmitButton>Missed</SubmitButton>
                            </form>
                          </div>
                        ) : (
                          <span className="pill">{a.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 style={{ marginTop: 20 }}>Book an appointment</h3>
          <FormShell
            action={addAppointmentAction.bind(null, id)}
            submitLabel="Book"
            columns={2}
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true },
              { name: 'time', label: 'Time', type: 'time', required: true, defaultValue: '09:00' },
              { name: 'reason', label: 'Reason', required: true, wide: true, placeholder: 'e.g. Blood pressure review' },
            ]}
          />
        </section>
      </div>

      <section className="card" aria-labelledby="medicines">
        <h2 id="medicines">Medicines</h2>
        {medications.length === 0 ? (
          <Empty>No medicines yet. Add one below.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Medicine</th>
                  <th scope="col">Times</th>
                  <th scope="col">From</th>
                  <th scope="col">Until</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {medications.map((m) => {
                  const active = !m.endDate || m.endDate >= today;
                  return (
                    <tr key={String(m._id)}>
                      <td>
                        <strong>{m.name}</strong> {m.dosage}
                        {m.instructions && <div className="muted">{m.instructions}</div>}
                      </td>
                      <td>{m.times.join(', ')}</td>
                      <td>{m.startDate}</td>
                      <td>{m.endDate ?? 'ongoing'}</td>
                      <td className="num">
                        {active && !m.stoppedAt ? (
                          <form action={stopMedicationAction.bind(null, id, String(m._id))} className="inline-form">
                            <SubmitButton pendingLabel="Stopping…" confirmText={`Stop ${m.name}? Reminders for it end today.`}>
                              Stop
                            </SubmitButton>
                          </form>
                        ) : (
                          <span className="pill">{m.stoppedAt ? 'stopped' : 'ended'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <h3 style={{ marginTop: 20 }}>Add a medicine</h3>
        <FormShell
          action={addMedicationAction.bind(null, id)}
          submitLabel="Add medicine"
          columns={2}
          fields={[
            { name: 'name', label: 'Medicine', required: true, placeholder: 'e.g. Amlodipine' },
            { name: 'dosage', label: 'Dosage', required: true, placeholder: 'e.g. 5 mg, 1 tablet' },
            { name: 'times', label: 'Times of day', required: true, placeholder: '08:00, 20:00', hint: '24-hour times, separated by commas.' },
            { name: 'startDate', label: 'Start date', type: 'date', required: true, defaultValue: today },
            { name: 'endDate', label: 'End date', type: 'date', hint: 'Leave empty for an ongoing treatment.' },
            { name: 'instructions', label: 'Instructions', placeholder: 'e.g. After food' },
          ]}
        />
      </section>
    </div>
  );
}
