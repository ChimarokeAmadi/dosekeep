import Link from 'next/link';
import { Empty, Rate } from '@/components/ui';
import { requireStaff } from '@/server/session';
import { clinicOverview } from '@/services/dashboard';

export const metadata = { title: 'Patients' };

export default async function PatientsPage() {
  const { db, clinic } = await requireStaff();
  const { patients } = await clinicOverview(db, { clinic, days: 7 });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Patients</h1>
          <p>{patients.length} active</p>
        </div>
        <Link href="/patients/new" className="button primary">
          Add patient
        </Link>
      </div>
      <div className="card">
        {patients.length === 0 ? (
          <Empty>
            No patients yet. <Link href="/patients/new">Add the first one</Link>.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="hide-sm">Condition</th>
                  <th scope="col">Phone</th>
                  <th scope="col" className="num">Last 7 days</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(({ patient, week }) => (
                  <tr key={String(patient._id)}>
                    <td>
                      <Link href={`/patients/${patient._id}`}>{patient.name}</Link>
                    </td>
                    <td className="hide-sm">{patient.condition ?? <span className="muted">–</span>}</td>
                    <td>{patient.phone}</td>
                    <td className="num">
                      <Rate summary={week} />
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
