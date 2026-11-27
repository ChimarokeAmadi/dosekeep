import { addDays, localDate, localTime, zonedToUtc } from '../lib/time.js';
import { loadDoses } from './doses.js';
import { sendMessage } from './messages.js';

// The reminder job runs every 15 minutes. Each run looks a little ahead and a little
// back, so a late or skipped run still sends the reminder. The unique message key
// stops a dose from being reminded twice.
export const DOSE_LOOKBACK_MS = 60 * 60 * 1000;
export const DOSE_LOOKAHEAD_MS = 15 * 60 * 1000;
// Appointment reminders go out the day before, from 08:00 clinic time.
export const APPOINTMENT_REMINDER_FROM = '08:00';

const firstName = (patient) => patient.name.split(' ')[0];

export function doseText(clinic, patient, dose) {
  return `${clinic.name}: hi ${firstName(patient)}, it's time for ${dose.medication.name} ${dose.medication.dosage} (${dose.time}). Mark it as taken with your DoseKeep link.`;
}

export function appointmentText(clinic, patient, appointment) {
  const day = localDate(appointment.at, clinic.timezone);
  const time = localTime(appointment.at, clinic.timezone);
  return `${clinic.name}: hi ${firstName(patient)}, a reminder of your appointment tomorrow (${day}) at ${time}: ${appointment.reason}.`;
}

export async function runReminders(db, sender, { now = new Date() } = {}) {
  const counts = { dose: { sent: 0, failed: 0, duplicate: 0 }, appointment: { sent: 0, failed: 0, duplicate: 0 } };
  const clinics = await db.collection('clinics').find().toArray();

  for (const clinic of clinics) {
    const doses = (
      await loadDoses(db, { clinic, from: new Date(now.getTime() - DOSE_LOOKBACK_MS), to: new Date(now.getTime() + DOSE_LOOKAHEAD_MS), now })
    ).filter((dose) => dose.status !== 'taken');

    const tomorrow = addDays(localDate(now, clinic.timezone), 1);
    const appointments =
      localTime(now, clinic.timezone) < APPOINTMENT_REMINDER_FROM
        ? []
        : await db
            .collection('appointments')
            .find({
              clinicId: clinic._id,
              status: 'scheduled',
              at: { $gte: zonedToUtc(tomorrow, '00:00', clinic.timezone), $lt: zonedToUtc(addDays(tomorrow, 1), '00:00', clinic.timezone) },
            })
            .toArray();

    const patientIds = [...doses.map((d) => d.patientId), ...appointments.map((a) => a.patientId)];
    const patients = new Map(
      (await db.collection('patients').find({ _id: { $in: patientIds }, active: true }).toArray()).map((p) => [String(p._id), p]),
    );

    for (const dose of doses) {
      const patient = patients.get(String(dose.patientId));
      if (!patient) continue;
      const outcome = await sendMessage(db, sender, {
        key: `dose:${dose.medicationId}:${dose.at.toISOString()}`,
        clinicId: clinic._id,
        patientId: patient._id,
        kind: 'dose',
        to: patient.phone,
        sample: patient.sample === true,
        body: doseText(clinic, patient, dose),
        now,
      });
      counts.dose[outcome] += 1;
    }

    for (const appointment of appointments) {
      const patient = patients.get(String(appointment.patientId));
      if (!patient) continue;
      const outcome = await sendMessage(db, sender, {
        key: `appointment:${appointment._id}:day-before`,
        clinicId: clinic._id,
        patientId: patient._id,
        kind: 'appointment',
        to: patient.phone,
        sample: patient.sample === true,
        body: appointmentText(clinic, patient, appointment),
        now,
      });
      counts.appointment[outcome] += 1;
    }
  }
  return counts;
}
