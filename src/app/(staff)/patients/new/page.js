import Link from 'next/link';
import { FormShell } from '@/components/FormShell';
import { createPatientAction } from '@/server/actions';

export const metadata = { title: 'Add patient' };

export default function NewPatientPage() {
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div>
        <Link href="/patients">← Patients</Link>
        <h1 style={{ marginTop: 8 }}>Add a patient</h1>
        <p className="muted">The patient receives an SMS with their private link. Add their medicines on the next page.</p>
      </div>
      <div className="card">
        <FormShell
          action={createPatientAction}
          submitLabel="Add patient"
          columns={2}
          fields={[
            { name: 'name', label: 'Full name', required: true },
            { name: 'phone', label: 'Mobile number', type: 'tel', required: true, placeholder: '0803 123 4567', hint: 'Used for SMS reminders.' },
            { name: 'condition', label: 'Condition', placeholder: 'e.g. Hypertension' },
            { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
          ]}
        />
      </div>
      <p className="muted">After adding, open the patient from the <Link href="/patients">list</Link> to add medicines and appointments.</p>
    </div>
  );
}
