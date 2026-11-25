import { byDay, isAtRisk, summarize } from '../lib/adherence.js';
import { addDays } from '../lib/time.js';
import { dayRange, loadDoses } from './doses.js';
import { listAppointments } from './medications.js';
import { listPatients } from './patients.js';

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

export async function clinicOverview(db, { clinic, now = new Date(), days = 14 }) {
  const range = dayRange(clinic, now, days);
  const weekStart = addDays(range.today, -6);
  const [doses, patients, appointments] = await Promise.all([
    loadDoses(db, { clinic, from: range.from, to: range.to, now }),
    listPatients(db, clinic._id),
    listAppointments(db, clinic._id, { from: now, to: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }),
  ]);

  const lastWeek = doses.filter((d) => d.day >= weekStart);
  const byPatient = groupBy(lastWeek, (d) => String(d.patientId));
  const patientRows = patients.map((patient) => ({
    patient,
    week: summarize(byPatient.get(String(patient._id)) ?? []),
  }));
  const patientsById = new Map(patients.map((p) => [String(p._id), p]));

  return {
    days: range.dayList,
    today: range.today,
    week: summarize(lastWeek),
    todaySummary: summarize(doses.filter((d) => d.day === range.today)),
    daily: byDay(doses, range.dayList),
    patients: patientRows,
    atRisk: patientRows.filter((row) => isAtRisk(row.week)).sort((a, b) => a.week.rate - b.week.rate),
    dueNow: doses.filter((d) => d.status === 'due').map((d) => ({ ...d, patient: patientsById.get(String(d.patientId)) })),
    appointments: appointments
      .filter((a) => a.status === 'scheduled')
      .map((a) => ({ ...a, patient: patientsById.get(String(a.patientId)) }))
      .filter((a) => a.patient),
  };
}

export async function patientReport(db, { clinic, patient, now = new Date(), days = 30 }) {
  const range = dayRange(clinic, now, days);
  const doses = await loadDoses(db, { clinic, patientId: patient._id, from: range.from, to: range.to, now });
  const weekStart = addDays(range.today, -6);
  return {
    today: range.today,
    days: range.dayList,
    month: summarize(doses),
    week: summarize(doses.filter((d) => d.day >= weekStart)),
    daily: byDay(doses, range.dayList),
    todayDoses: doses.filter((d) => d.day === range.today),
    recentMissed: doses.filter((d) => d.status === 'missed').slice(-8).reverse(),
  };
}
