import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_URL, fakeSender, makeClinic, setupDatabase } from './helpers.js';
import { addStaff, authenticate, getUser, listStaff, MAX_FAILED_LOGINS, registerClinic } from '../src/services/accounts.js';
import { createPatient, findByPortalToken, getPatient, listPatients, resetPortalLink } from '../src/services/patients.js';
import { addAppointment, addMedication, listAppointments, listMedications, setAppointmentStatus, stopMedication } from '../src/services/medications.js';
import { logDose, portalView, unlogDose } from '../src/services/doses.js';
import { clinicOverview, patientReport } from '../src/services/dashboard.js';
import { runReminders } from '../src/services/reminders.js';
import { listMessages } from '../src/services/messages.js';

const ctx = setupDatabase();
const NOW = new Date('2026-11-24T09:30:00Z'); // 10:30 in Lagos
const metformin = { name: 'Metformin', dosage: '500 mg', times: '08:00, 20:00', startDate: '2026-11-17' };

async function clinicWithPatient(sender = fakeSender()) {
  const { user, clinic } = await makeClinic(ctx.db);
  const { patient, portalLink } = await createPatient(ctx.db, sender, {
    clinic,
    input: { name: 'Chidi Okafor', phone: '0803 123 4567', condition: 'Type 2 diabetes' },
    appUrl: APP_URL,
    now: NOW,
  });
  const medication = await addMedication(ctx.db, { clinic, patientId: String(patient._id), input: metformin, userId: user.id, now: NOW });
  return { user, clinic, patient, medication, portalLink, sender };
}

describe('accounts', () => {
  test('registering creates a clinic and its admin, and the email must be unique', async () => {
    const input = { clinicName: 'Hope Clinic', timezone: 'Africa/Lagos', name: 'Ngozi', email: 'Ngozi@Hope.test', password: 'long enough pass' };
    const admin = await registerClinic(ctx.db, input, { rounds: 4 });
    assert.equal(admin.role, 'admin');
    assert.equal((await getUser(ctx.db, admin)).email, 'ngozi@hope.test');
    assert.equal((await getUser(ctx.db, admin)).passwordHash, undefined);
    await assert.rejects(registerClinic(ctx.db, input, { rounds: 4 }), { code: 'EMAIL_TAKEN' });
    assert.equal(await ctx.db.collection('clinics').countDocuments(), 1);
  });

  test('login works, fails with a wrong password, and locks after 5 failures', async () => {
    await registerClinic(ctx.db, { clinicName: 'Hope', timezone: 'Africa/Lagos', name: 'N', email: 'n@hope.test', password: 'long enough pass' }, { rounds: 4 });
    assert.equal((await authenticate(ctx.db, { email: 'N@hope.test', password: 'long enough pass' })).name, 'N');
    await assert.rejects(authenticate(ctx.db, { email: 'nobody@hope.test', password: 'x' }), { code: 'BAD_CREDENTIALS' });
    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      await assert.rejects(authenticate(ctx.db, { email: 'n@hope.test', password: 'wrong' }), { code: 'BAD_CREDENTIALS' });
    }
    await assert.rejects(authenticate(ctx.db, { email: 'n@hope.test', password: 'long enough pass' }), { code: 'LOCKED' });
    const later = new Date(Date.now() + 16 * 60 * 1000);
    assert.ok(await authenticate(ctx.db, { email: 'n@hope.test', password: 'long enough pass' }, { now: later }));
  });

  test('only an admin can add team members', async () => {
    const { user } = await makeClinic(ctx.db);
    const nurse = await addStaff(ctx.db, user, { name: 'Nurse Bisi', email: 'bisi@clinic.test', password: 'another long one' }, { rounds: 4 });
    assert.equal(nurse.role, 'staff');
    await assert.rejects(addStaff(ctx.db, nurse, { name: 'X', email: 'x@clinic.test', password: 'another long one' }), { code: 'FORBIDDEN' });
    await assert.rejects(addStaff(ctx.db, user, { name: 'Y', email: 'bisi@clinic.test', password: 'another long one' }, { rounds: 4 }), { code: 'EMAIL_TAKEN' });
    assert.equal((await listStaff(ctx.db, user.clinicId)).length, 2);
  });
});

describe('patients and the portal link', () => {
  test('a new patient gets a private link by SMS, and only a hash of it is stored', async () => {
    const { patient, portalLink, sender } = await clinicWithPatient();
    assert.equal(patient.phone, '+2348031234567');
    assert.match(portalLink, /^https:\/\/dosekeep\.test\/p\/[\w-]{32}$/);
    assert.ok(sender.sent[0].body.includes(portalLink));
    const [stored] = await listMessages(ctx.db, patient.clinicId);
    assert.equal(stored.patientName, 'Chidi Okafor');
    assert.ok(stored.body.includes('[private link]'));
    assert.ok(!JSON.stringify(await ctx.db.collection('patients').findOne()).includes(portalLink.split('/p/')[1]));

    const token = portalLink.split('/p/')[1];
    assert.equal((await findByPortalToken(ctx.db, token)).patient.name, 'Chidi Okafor');
    assert.equal(await findByPortalToken(ctx.db, 'x'.repeat(32)), null);
    assert.equal(await findByPortalToken(ctx.db, 'short'), null);
  });

  test('resetting the link turns the old one off', async () => {
    const { clinic, patient, portalLink } = await clinicWithPatient();
    const { portalLink: fresh } = await resetPortalLink(ctx.db, fakeSender(), { clinic, patientId: String(patient._id), appUrl: APP_URL, now: NOW });
    assert.equal(await findByPortalToken(ctx.db, portalLink.split('/p/')[1]), null);
    assert.ok(await findByPortalToken(ctx.db, fresh.split('/p/')[1]));
  });

  test("a clinic can never see another clinic's patients", async () => {
    const { patient } = await clinicWithPatient();
    const other = await makeClinic(ctx.db, { clinicName: 'Other Clinic' });
    assert.equal(await getPatient(ctx.db, other.clinic._id, String(patient._id)), null);
    assert.equal(await getPatient(ctx.db, other.clinic._id, 'not-an-id'), null);
    assert.deepEqual(await listPatients(ctx.db, other.clinic._id), []);
    await assert.rejects(
      addMedication(ctx.db, { clinic: other.clinic, patientId: String(patient._id), input: metformin }),
      { code: 'NOT_FOUND' },
    );
  });
});

describe('doses', () => {
  test('a patient can mark a dose in its window, once, and not outside it', async () => {
    const { clinic, patient, medication } = await clinicWithPatient();
    const morning = '2026-11-24T07:00:00.000Z'; // 08:00 Lagos, now is 10:30
    const dose = { clinic, patient, medicationId: String(medication._id), source: 'patient', now: NOW };
    assert.deepEqual(await logDose(ctx.db, { ...dose, at: morning }), { status: 'taken' });
    await logDose(ctx.db, { ...dose, at: morning }); // second tap is harmless
    assert.equal(await ctx.db.collection('doseLogs').countDocuments(), 1);

    await assert.rejects(logDose(ctx.db, { ...dose, at: '2026-11-23T07:00:00.000Z' }), { code: 'OUTSIDE_WINDOW' });
    await assert.rejects(logDose(ctx.db, { ...dose, at: '2026-11-24T07:30:00.000Z' }), { code: 'NOT_SCHEDULED' });
    await assert.rejects(logDose(ctx.db, { ...dose, at: 'garbage' }), { code: 'NOT_SCHEDULED' });
    await assert.rejects(logDose(ctx.db, { ...dose, medicationId: 'nope', at: morning }), { code: 'NOT_FOUND' });
  });

  test('staff can record a past dose but not a future one', async () => {
    const { clinic, patient, medication, user } = await clinicWithPatient();
    const dose = { clinic, patient, medicationId: String(medication._id), source: 'staff', userId: user.id, now: NOW };
    await logDose(ctx.db, { ...dose, at: '2026-11-20T19:00:00.000Z' });
    await assert.rejects(logDose(ctx.db, { ...dose, at: '2026-11-24T19:00:00.000Z' }), { code: 'NOT_DUE' });
  });

  test('staff can undo a dose recorded as taken by mistake, and it counts as missed again', async () => {
    const { clinic, patient, medication, user } = await clinicWithPatient();
    const at = '2026-11-20T19:00:00.000Z';
    const dose = { clinic, patient, medicationId: String(medication._id), at };
    await logDose(ctx.db, { ...dose, source: 'staff', userId: user.id, now: NOW });
    assert.deepEqual(await unlogDose(ctx.db, dose), { status: 'not-taken' });
    assert.equal(await ctx.db.collection('doseLogs').countDocuments(), 0);

    await assert.rejects(unlogDose(ctx.db, dose), { code: 'NOT_FOUND' }); // nothing left to undo
    await assert.rejects(unlogDose(ctx.db, { ...dose, medicationId: 'nope' }), { code: 'NOT_FOUND' });
    const other = await makeClinic(ctx.db, { email: 'other@clinic.test' });
    await assert.rejects(unlogDose(ctx.db, { ...dose, clinic: other.clinic }), { code: 'NOT_FOUND' }); // another clinic can't touch it
  });

  test('the portal shows today, the week and the next appointment', async () => {
    const { clinic, patient, medication } = await clinicWithPatient();
    await logDose(ctx.db, { clinic, patient, medicationId: String(medication._id), source: 'patient', at: '2026-11-24T07:00:00.000Z', now: NOW });
    await addAppointment(ctx.db, { clinic, patientId: String(patient._id), input: { date: '2026-11-28', time: '10:00', reason: 'Blood sugar check' } });
    const view = await portalView(ctx.db, { clinic, patient, now: NOW });
    assert.deepEqual(view.today.map((d) => `${d.time} ${d.status}`), ['08:00 taken', '20:00 upcoming']);
    assert.equal(view.week.taken, 1);
    assert.equal(view.week.missed, 12); // the week is the 18th to today: 6 past days, two doses a day, none logged
    assert.equal(view.nextAppointment.reason, 'Blood sugar check');
  });
});

describe('dashboard', () => {
  test('patients under 80% adherence are flagged as at risk', async () => {
    const { clinic, patient, medication } = await clinicWithPatient();
    const good = (await createPatient(ctx.db, fakeSender(), { clinic, input: { name: 'Amaka Eze', phone: '08091234567' }, appUrl: APP_URL, now: NOW })).patient;
    const goodMed = await addMedication(ctx.db, { clinic, patientId: String(good._id), input: { ...metformin, times: '08:00', startDate: '2026-11-22' } });
    for (const at of ['2026-11-22T07:00:00Z', '2026-11-23T07:00:00Z', '2026-11-24T07:00:00Z']) {
      await logDose(ctx.db, { clinic, patient: good, medicationId: String(goodMed._id), source: 'staff', at, now: NOW });
    }

    const overview = await clinicOverview(ctx.db, { clinic, now: NOW });
    assert.equal(overview.patients.length, 2);
    assert.deepEqual(overview.atRisk.map((r) => r.patient.name), ['Chidi Okafor']);
    assert.equal(overview.daily.length, 14);
    assert.equal(overview.week.taken, 3);
    assert.equal(overview.dueNow.length, 1); // Chidi's 08:00 dose, still in its window
    assert.equal(overview.dueNow[0].patient.name, 'Chidi Okafor');

    const report = await patientReport(ctx.db, { clinic, patient, now: NOW });
    assert.equal(report.month.rate, 0);
    assert.equal(report.daily.at(-1).day, '2026-11-24');
    assert.equal(report.recentMissed.length, 8);
    assert.equal(String(medication.patientId), String(patient._id));
  });

  test('stopping a medication keeps its history; appointments can be marked', async () => {
    const { clinic, patient, medication } = await clinicWithPatient();
    await stopMedication(ctx.db, { clinic, medicationId: String(medication._id), now: NOW });
    const [stopped] = await listMedications(ctx.db, clinic._id, patient._id);
    assert.equal(stopped.endDate, '2026-11-24');
    const tomorrow = await patientReport(ctx.db, { clinic, patient, now: new Date('2026-11-26T09:00:00Z') });
    assert.equal(tomorrow.todayDoses.length, 0);
    assert.ok(tomorrow.month.missed > 0);
    await assert.rejects(stopMedication(ctx.db, { clinic, medicationId: 'x' }), { code: 'NOT_FOUND' });
    await assert.rejects(addMedication(ctx.db, { clinic, patientId: String(patient._id), input: { ...metformin, name: 'METFORMIN', startDate: '2026-11-20' } }), { code: 'DUPLICATE' });
    const restarted = await addMedication(ctx.db, { clinic, patientId: String(patient._id), input: { ...metformin, startDate: '2026-11-25' } });
    assert.equal(restarted.name, 'Metformin'); // allowed once the old one has ended

    const appointment = await addAppointment(ctx.db, { clinic, patientId: String(patient._id), input: { date: '2026-11-25', time: '09:00', reason: 'Review' } });
    await setAppointmentStatus(ctx.db, { clinic, appointmentId: String(appointment._id), status: 'attended' });
    assert.equal((await listAppointments(ctx.db, clinic._id, { patientId: patient._id }))[0].status, 'attended');
    await assert.rejects(setAppointmentStatus(ctx.db, { clinic, appointmentId: String(appointment._id), status: 'eaten' }));
  });
});

describe('reminders', () => {
  test('due doses and tomorrow\'s appointments are texted once; taken doses are not', async () => {
    const { clinic, patient, medication } = await clinicWithPatient();
    await addAppointment(ctx.db, { clinic, patientId: String(patient._id), input: { date: '2026-11-25', time: '09:00', reason: 'Foot check' } });
    const sender = fakeSender();
    const evening = new Date('2026-11-24T18:50:00Z'); // 19:50 Lagos, the 20:00 dose is 10 minutes away

    const first = await runReminders(ctx.db, sender, { now: evening });
    assert.deepEqual(first.dose, { sent: 1, failed: 0, duplicate: 0 });
    assert.deepEqual(first.appointment, { sent: 1, failed: 0, duplicate: 0 });
    assert.match(sender.sent[0].body, /Metformin 500 mg \(20:00\)/);
    assert.match(sender.sent[1].body, /tomorrow \(2026-11-25\) at 09:00: Foot check/);

    const second = await runReminders(ctx.db, sender, { now: new Date(evening.getTime() + 15 * 60 * 1000) });
    assert.equal(second.dose.duplicate, 1);
    assert.equal(sender.sent.length, 2);

    await logDose(ctx.db, { clinic, patient, medicationId: String(medication._id), source: 'patient', at: '2026-11-25T07:00:00Z', now: new Date('2026-11-25T06:45:00Z') });
    const morning = await runReminders(ctx.db, sender, { now: new Date('2026-11-25T06:50:00Z') });
    assert.equal(morning.dose.sent, 0);
  });

  test('a failed SMS is recorded with its error', async () => {
    await clinicWithPatient();
    const result = await runReminders(ctx.db, fakeSender({ fail: true }), { now: new Date('2026-11-24T18:50:00Z') });
    assert.equal(result.dose.failed, 1);
    const failed = await ctx.db.collection('reminders').findOne({ kind: 'dose' });
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'network down');
  });
});
