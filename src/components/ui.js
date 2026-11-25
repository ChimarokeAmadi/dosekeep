import { formatRate } from '@/lib/adherence';

const STATUS = {
  taken: { icon: '✓', label: 'Taken' },
  missed: { icon: '✕', label: 'Missed' },
  due: { icon: '●', label: 'Due now' },
  upcoming: { icon: '○', label: 'Later' },
};

// Status is always icon + word, never colour alone.
export function DoseStatus({ status }) {
  const s = STATUS[status];
  return (
    <span className={`badge badge-${status}`}>
      <span aria-hidden="true">{s.icon}</span> {s.label}
    </span>
  );
}

export function Stat({ label, value, note, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

export function Rate({ summary }) {
  const atRisk = summary.rate !== null && summary.rate < 0.8;
  return (
    <span className={atRisk ? 'rate rate-low' : 'rate'}>
      {formatRate(summary.rate)}
      {atRisk && <span className="sr-only"> (at risk)</span>}
      {atRisk && <span aria-hidden="true"> ⚠</span>}
    </span>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}
