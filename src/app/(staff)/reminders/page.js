import { ActionButton } from '@/components/ActionButton';
import { Empty } from '@/components/ui';
import { getConfig } from '@/lib/config';
import { formatDateTime } from '@/lib/format';
import { runRemindersAction } from '@/server/actions';
import { requireStaff } from '@/server/session';
import { listMessages } from '@/services/messages';

export const metadata = { title: 'Reminders' };

const KIND = { dose: 'Dose', appointment: 'Appointment', link: 'Portal link' };

export default async function RemindersPage() {
  const { db, clinic, user } = await requireStaff();
  const messages = await listMessages(db, clinic._id);
  const provider = getConfig().sms.provider;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Reminders</h1>
          <p>
            Every SMS DoseKeep sent for {clinic.name}. They go out automatically every 15 minutes.{' '}
            {provider === 'log' && <strong>Test mode: SMS sending is turned off, so messages are recorded here but not sent.</strong>}
          </p>
        </div>
        {user.role === 'admin' && <ActionButton action={runRemindersAction} label="Run reminders now" pendingLabel="Running…" />}
      </div>
      <div className="card">
        {messages.length === 0 ? (
          <Empty>No messages yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Patient</th>
                  <th scope="col">Type</th>
                  <th scope="col">Message</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={String(m._id)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(m.createdAt, clinic.timezone)}</td>
                    <td>{m.patientName ?? '–'}</td>
                    <td>{KIND[m.kind] ?? m.kind}</td>
                    <td>{m.body}</td>
                    <td>
                      <span className={`badge ${m.status === 'sent' ? 'badge-taken' : m.status === 'failed' ? 'badge-missed' : 'badge-upcoming'}`}>
                        {m.status === 'sent' ? '✓ ' : m.status === 'failed' ? '✕ ' : ''}
                        {m.status}
                      </span>
                      {m.error && <div className="muted">{m.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
