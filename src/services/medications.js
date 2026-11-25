import { AppError, notFound } from '../lib/errors.js';
import { toObjectId } from '../lib/db.js';
import { addDays, localDate, zonedToUtc } from '../lib/time.js';
import { appointmentSchema, medicationSchema, parse } from '../lib/validation.js';
import { getPatient } from './patients.js';

export async function addMedication(db, { clinic, patientId, input, userId, now = new Date() }) {
  const patient = await getPatient(db, clinic._id, patientId);
  if (!patient) throw notFound('Patient');
  const data = parse(medicationSchema, input);
  // The same medicine twice at once would double the reminders: stop the old one first.
  const escaped = data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicate = await db.collection('medications').findOne({
    patientId: patient._id,
    name: { $regex: `^${escaped}$`, $options: 'i' },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: data.startDate } }],
  });
  if (duplicate) {
    throw new AppError('DUPLICATE', `${duplicate.name} is already on this patient's list`, {
      fields: { name: 'Already active: stop the current one first, or change its times' },
    });
  }
  const medication = { clinicId: clinic._id, patientId: patient._id, ...data, createdBy: toObjectId(userId), createdAt: now };
  const { insertedId } = await db.collection('medications').insertOne(medication);
  return { ...medication, _id: insertedId };
}

export async function listMedications(db, clinicId, patientId) {
  return db
    .collection('medications')
    .find({ clinicId: toObjectId(clinicId), patientId: toObjectId(patientId) })
    .sort({ endDate: 1, name: 1 })
    .toArray();
}

// Medications that have at least one day inside [fromDay, toDay].
export function activeFilter(clinicId, fromDay, toDay, extra = {}) {
  return {
    clinicId: toObjectId(clinicId),
    startDate: { $lte: toDay },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: fromDay } }],
    ...extra,
  };
}

// Stopping keeps the history: the medication ends today, so past doses still count.
export async function stopMedication(db, { clinic, medicationId, now = new Date() }) {
  const id = toObjectId(medicationId);
  const today = localDate(now, clinic.timezone);
  const medication = id && (await db.collection('medications').findOne({ _id: id, clinicId: clinic._id }));
  if (!medication) throw notFound('Medication');
  const endDate = medication.startDate > today ? addDays(medication.startDate, -1) : today;
  await db.collection('medications').updateOne({ _id: id }, { $set: { endDate, stoppedAt: now } });
}

export async function addAppointment(db, { clinic, patientId, input, now = new Date() }) {
  const patient = await getPatient(db, clinic._id, patientId);
  if (!patient) throw notFound('Patient');
  const data = parse(appointmentSchema, input);
  const appointment = {
    clinicId: clinic._id,
    patientId: patient._id,
    at: zonedToUtc(data.date, data.time, clinic.timezone),
    reason: data.reason,
    status: 'scheduled',
    createdAt: now,
  };
  const { insertedId } = await db.collection('appointments').insertOne(appointment);
  return { ...appointment, _id: insertedId };
}

export async function setAppointmentStatus(db, { clinic, appointmentId, status }) {
  if (!['scheduled', 'attended', 'missed', 'cancelled'].includes(status)) throw new Error('Unknown status');
  const id = toObjectId(appointmentId);
  const result = id && (await db.collection('appointments').updateOne({ _id: id, clinicId: clinic._id }, { $set: { status } }));
  if (!result?.matchedCount) throw notFound('Appointment');
}

export async function listAppointments(db, clinicId, { patientId, from, to } = {}) {
  const filter = { clinicId: toObjectId(clinicId) };
  if (patientId) filter.patientId = toObjectId(patientId);
  if (from || to) filter.at = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
  return db.collection('appointments').find(filter).sort({ at: 1 }).toArray();
}
