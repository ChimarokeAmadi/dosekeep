import './globals.css';

// Every page shows live, per-clinic or per-patient data, so nothing is prerendered or cached.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: { default: 'DoseKeep: medication reminders for clinics', template: '%s · DoseKeep' },
  description: 'SMS medication and appointment reminders with adherence tracking for small clinics.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
