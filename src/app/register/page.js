import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { FormShell } from '@/components/FormShell';
import { registerAction } from '@/server/actions';

export const metadata = { title: 'Register a clinic' };

const TIME_ZONES = ['Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Cairo', 'Africa/Casablanca', 'Europe/London', 'UTC'];

export default function RegisterPage() {
  return (
    <main className="container narrow">
      <div style={{ margin: '40px 0 24px' }}>
        <Brand />
      </div>
      <div className="card stack">
        <div>
          <h1>Register your clinic</h1>
          <p className="muted">You become the clinic&apos;s admin and can add nurses and other staff afterwards.</p>
        </div>
        <FormShell
          action={registerAction}
          submitLabel="Create clinic"
          pendingLabel="Creating…"
          fields={[
            { name: 'clinicName', label: 'Clinic name', required: true, autoComplete: 'organization' },
            {
              name: 'timezone',
              label: 'Time zone',
              type: 'select',
              required: true,
              defaultValue: 'Africa/Lagos',
              options: TIME_ZONES.map((tz) => ({ value: tz, label: tz.replace('_', ' ') })),
              hint: 'Dose times are in this time zone.',
            },
            { name: 'name', label: 'Your name', required: true, autoComplete: 'name' },
            { name: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
            { name: 'password', label: 'Password', type: 'password', required: true, autoComplete: 'new-password', hint: 'At least 10 characters.' },
            { name: 'confirmPassword', label: 'Confirm password', type: 'password', required: true, autoComplete: 'new-password' },
          ]}
        />
        <p className="muted">
          Already registered? <Link href="/login">Sign in</Link>.
        </p>
      </div>
    </main>
  );
}
