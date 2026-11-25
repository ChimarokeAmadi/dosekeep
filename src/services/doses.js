import { AppError, notFound } from '../lib/errors.js';
import { isDuplicateKey, toObjectId } from '../lib/db.js';
import { indexLogs, summarize, withStatus } from '../lib/adherence.js';
import { isInPatientWindow, isScheduledAt, occurrences, WINDOW_BEFORE_MS } from '../lib/schedule.js';
import { addDays, localDate, zonedToUtc } from '../lib/time.js';
import { activeFilter } from './medications.js';

// The schedule is not stored dose by dose. It is calculated from each medication's
// times, and only the doses that were actually taken are stored (doseLogs).
// A dose without a log becomes "missed" once its window has passed.
export async function loadDoses(db, { clinic, from, to, now = new Date(), patientId }) {
  const tz = clinic.timezone;
  const patientFilter = patientId ? { patientId: toObjectId(patientId) } : {};
  const [medications, logs] = await Promise.all([
    db.collection('medications').find(activeFilter(clinic._id, localDate(from, tz), localDate(to, tz), patientFilter)).toArray(),
    db.collection('doseLogs').find({ clinicId: clinic._id, scheduledFor: { $gte: from, $lt: to }, ...patientFilter }).toArray(),
  ]);
  const medicationsById = new Map(medications.map((m) => [String(m._id), m]));
  const scheduled = medications.flatMap((m) => occurrences(m, from, to, tz));
  return withStatus(scheduled, indexLogs(logs), now)
    .map((dose) => ({ ...dose, medication: medicationsById.get(String(dose.medicationId)) }))
    .sort((a, b) => a.at - b.at || a.medication.name.localeCompare(b.medication.name));
}

export function dayRange(clinic, now, days) {
  const today = localDate(now, clinic.timezone);
  const dayList = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  return {
    today,
    dayList,
    from: zonedToUtc(dayList[0], '00:00', clinic.timezone),
    to: zonedToUtc(addDays(today, 1), '00:00', clinic.timezone),
  };
}

// source "patient": from the portal, only inside the dose window.
// source "staff": a nurse records a dose the patient reports at a visit or on the phone.
export async function logDose(db, { clinic, patient, medicationId, at, source, userId, now = new Date() }) {
  const id = toObjectId(medicationId);
  const medication = id && (await db.collection('medications').findOne({ _id: id, clinicId: clinic._id, patientId: patient._id }));
  if (!medication) throw notFound('Medication');

  const scheduledFor = new Date(at);
  if (Number.isNaN(scheduledFor.getTime()) || !isScheduledAt(medication, scheduledFor, clinic.timezone)) {
    throw new AppError('NOT_SCHEDULED', 'This dose is not on the schedule');
  }
  if (source === 'patient' && !isInPatientWindow(scheduledFor, now)) {
    throw new AppError('OUTSIDE_WINDOW', 'A dose can be marked from 1 hour before to 3 hours after its time', { status: 409 });
  }
  if (source === 'staff' && scheduledFor.getTime() - WINDOW_BEFORE_MS > now.getTime()) {
    throw new AppError('NOT_DUE', 'This dose is not due yet', { status: 409 });
  }

  try {
    await db.collection('doseLogs').updateOne(
      { medicationId: medication._id, scheduledFor },
      {
        $setOnInsert: {
          clinicId: clinic._id,
          patientId: patient._id,
          medicationId: medication._id,
          scheduledFor,
          status: 'taken',
          source,
          loggedBy: toObjectId(userId),
          loggedAt: now,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error; // two taps at once: already recorded
  }
  return { status: 'taken' };
}

// Staff correction for a dose recorded as taken by mistake. Missed doses are never stored
// (they are calculated), so removing the record is all it takes: once the window has
// passed the dose counts as missed again, and while it is still open it shows as due.
export async function unlogDose(db, { clinic, patient, medicationId, at }) {
  const id = toObjectId(medicationId);
  const scheduledFor = new Date(at);
  if (!id || Number.isNaN(scheduledFor.getTime())) throw notFound('Dose');
  const { deletedCount } = await db.collection('doseLogs').deleteOne({
    clinicId: clinic._id,
    patientId: patient._id,
    medicationId: id,
    scheduledFor,
  });
  if (deletedCount === 0) throw notFound('Dose');
  return { status: 'not-taken' };
}

export async function portalView(db, { clinic, patient, now = new Date() }) {
  const week = dayRange(clinic, now, 7);
  const doses = await loadDoses(db, { clinic, patientId: patient._id, from: week.from, to: week.to, now });
  const nextAppointment = await db
    .collection('appointments')
    .findOne({ patientId: patient._id, status: 'scheduled', at: { $gte: now } }, { sort: { at: 1 } });
  return {
    day: week.today,
    today: doses.filter((d) => d.day === week.today),
    week: summarize(doses),
    nextAppointment,
  };
}
