import { FormShell } from '@/components/FormShell';
import { addStaffAction } from '@/server/actions';
import { requireStaff } from '@/server/session';
import { listStaff } from '@/services/accounts';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
  const { db, clinic, user } = await requireStaff();
  const staff = await listStaff(db, clinic._id);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p>People who can sign in to {clinic.name}.</p>
        </div>
      </div>
      <div className="grid-2">
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={String(s._id)}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>
                    <span className="pill">{s.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {user.role === 'admin' ? (
          <div className="card">
            <h2>Add a team member</h2>
            <FormShell
              action={addStaffAction}
              submitLabel="Add"
              fields={[
                { name: 'name', label: 'Name', required: true },
                { name: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'off' },
                { name: 'password', label: 'Temporary password', type: 'password', required: true, autoComplete: 'new-password', hint: 'At least 10 characters. Share it with them in person.' },
                {
                  name: 'role',
                  label: 'Role',
                  type: 'select',
                  required: true,
                  defaultValue: 'staff',
                  options: [
                    { value: 'staff', label: 'Staff: patients, medicines, appointments' },
                    { value: 'admin', label: 'Admin: also team and reminders' },
                  ],
                },
              ]}
            />
          </div>
        ) : (
          <p className="card muted">Only an admin can add team members.</p>
        )}
      </div>
    </div>
  );
}
