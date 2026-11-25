'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { parse, registerFormSchema } from '@/lib/validation';
import { addStaff, authenticate, registerClinic } from '@/services/accounts';
import { createPatient, getPatient, resetPortalLink } from '@/services/patients';
import { addAppointment, addMedication, setAppointmentStatus, stopMedication } from '@/services/medications';
import { logDose, unlogDose } from '@/services/doses';
import { runReminders } from '@/services/reminders';
import { endSession, requireStaff, smsSender, startSession } from './session';

const SECRET_FIELDS = new Set(['password', 'confirmPassword']);

function formValues(formData) {
  return Object.fromEntries([...formData.entries()].filter(([key]) => !key.startsWith('$') && !SECRET_FIELDS.has(key)));
}

// Turns expected errors (validation, not found, wrong password) into form state.
// Anything unexpected is logged and shown as a generic message.
async function attempt(formData, work) {
  try {
    return { ok: true, attempt: Date.now(), ...(await work()) };
  } catch (error) {
    if (!(error instanceof AppError)) console.error(error);
    return {
      ok: false,
      attempt: Date.now(),
      error: error instanceof AppError ? error.message : 'Something went wrong. Please try again.',
      fields: error.fields ?? {},
      values: formData ? formValues(formData) : {},
    };
  }
}

export async function registerAction(_prev, formData) {
  const result = await attempt(formData, async () => {
    const input = Object.fromEntries(formData);
    parse(registerFormSchema, input); // both passwords match, plus the usual field checks
    const user = await registerClinic(await getDb(), input, { rounds: getConfig().bcryptRounds });
    await startSession(user);
  });
  if (result.ok) redirect('/dashboard');
  return result;
}

export async function loginAction(_prev, formData) {
  const result = await attempt(formData, async () => {
    const user = await authenticate(await getDb(), Object.fromEntries(formData));
    await startSession(user);
  });
  if (result.ok) redirect('/dashboard');
  return result;
}

export async function logoutAction() {
  await endSession();
  redirect('/');
}

export async function createPatientAction(_prev, formData) {
  const { db, clinic } = await requireStaff();
  return attempt(formData, async () => {
    const { patient, portalLink, sms } = await createPatient(db, smsSender(), {
      clinic, input: Object.fromEntries(formData), appUrl: getConfig().appUrl,
    });
    revalidatePath('/patients');
    return {
      message: `${patient.name} was added. ${sms === 'sent' ? 'The portal link was sent by SMS.' : 'The SMS could not be sent: give them the link below.'}`,
      link: portalLink,
      next: { href: `/patients/${patient._id}`, label: `Open ${patient.name} to add medicines →` },
    };
  });
}

export async function resetLinkAction(patientId) {
  const { db, clinic } = await requireStaff();
  return attempt(null, async () => {
    const { portalLink, sms } = await resetPortalLink(db, smsSender(), { clinic, patientId, appUrl: getConfig().appUrl });
    return { message: `New link created${sms === 'sent' ? ' and sent by SMS' : ''}. The old link no longer works.`, link: portalLink };
  });
}

export async function addMedicationAction(patientId, _prev, formData) {
  const { db, clinic, user } = await requireStaff();
  return attempt(formData, async () => {
    const medication = await addMedication(db, { clinic, patientId, input: Object.fromEntries(formData), userId: user.id });
    revalidatePath(`/patients/${patientId}`);
    return { message: `${medication.name} added.` };
  });
}

// Buttons without a message area: expected errors (e.g. a stale page) are ignored,
// and the page simply re-renders with the current data.
async function quietly(work) {
  try {
    await work();
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
}

export async function stopMedicationAction(patientId, medicationId) {
  const { db, clinic } = await requireStaff();
  await quietly(() => stopMedication(db, { clinic, medicationId }));
  revalidatePath(`/patients/${patientId}`);
}

export async function addAppointmentAction(patientId, _prev, formData) {
  const { db, clinic } = await requireStaff();
  return attempt(formData, async () => {
    await addAppointment(db, { clinic, patientId, input: Object.fromEntries(formData) });
    revalidatePath(`/patients/${patientId}`);
    return { message: 'Appointment booked. The patient gets an SMS the day before.' };
  });
}

export async function appointmentStatusAction(patientId, appointmentId, status) {
  const { db, clinic } = await requireStaff();
  await quietly(() => setAppointmentStatus(db, { clinic, appointmentId, status }));
  revalidatePath(`/patients/${patientId}`);
}

export async function staffLogDoseAction(patientId, medicationId, at) {
  const { db, clinic, user } = await requireStaff();
  const patient = await getPatient(db, clinic._id, patientId);
  if (!patient) return;
  await quietly(() => logDose(db, { clinic, patient, medicationId, at, source: 'staff', userId: user.id }));
  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/dashboard');
}

// Undo for a dose recorded as taken by mistake.
export async function staffUnlogDoseAction(patientId, medicationId, at) {
  const { db, clinic } = await requireStaff();
  const patient = await getPatient(db, clinic._id, patientId);
  if (!patient) return;
  await quietly(() => unlogDose(db, { clinic, patient, medicationId, at }));
  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/dashboard');
}

export async function addStaffAction(_prev, formData) {
  const { db, user } = await requireStaff();
  return attempt(formData, async () => {
    const added = await addStaff(db, user, Object.fromEntries(formData), { rounds: getConfig().bcryptRounds });
    revalidatePath('/team');
    return { message: `${added.name} can now sign in.` };
  });
}

// The scheduled job calls /api/cron/reminders; this button lets an admin run it now (useful in a demo).
export async function runRemindersAction() {
  const { db, user } = await requireStaff();
  return attempt(null, async () => {
    if (user.role !== 'admin') throw new AppError('FORBIDDEN', 'Only an admin can run reminders');
    const counts = await runReminders(db, smsSender());
    revalidatePath('/reminders');
    return { message: `Sent ${counts.dose.sent} dose and ${counts.appointment.sent} appointment reminders (${counts.dose.failed + counts.appointment.failed} failed).` };
  });
}
