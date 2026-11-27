// Creates a sample clinic with 8 patients and 5 weeks of realistic dose history,
// so the dashboard has something to show. Safe to run again: it replaces the sample clinic.
//
//   node --env-file=.env.local scripts/seed.js     (or: npm run seed, with MONGODB_URI and SEED_PASSWORD set)

import { MongoClient } from 'mongodb';
import { getConfig } from '../src/lib/config.js';
import { ensureIndexes } from '../src/lib/db.js';
import { occurrences } from '../src/lib/schedule.js';
import { addDays, localDate, zonedToUtc } from '../src/lib/time.js';
import { addStaff, registerClinic } from '../src/services/accounts.js';
import { createPatient } from '../src/services/patients.js';
import { addAppointment, addMedication } from '../src/services/medications.js';

export const ADMIN_EMAIL = 'ada.nnamdi@sunriseclinic.ng';
const NURSE_EMAIL = 'bisi.lawal@sunriseclinic.ng';
// The sample clinic's admin email in earlier versions; its clinic is removed on the next seed.
const PREVIOUS_ADMIN_EMAILS = ['demo@dosekeep.app'];

// Same "random" history every run.
function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Numbers in the 0700 000 range are not assigned to real subscribers.
const PATIENTS = [
  { name: 'Chidi Okafor', phone: '07000000101', condition: 'Type 2 diabetes', adherence: 0.95, meds: [['Metformin', '500 mg', ['08:00', '20:00'], 'With food']] },
  { name: 'Aisha Bello', phone: '07000000102', condition: 'Hypertension', adherence: 0.62, meds: [['Amlodipine', '5 mg', ['08:00']], ['Lisinopril', '10 mg', ['20:00']]] },
  { name: 'Tunde Adeyemi', phone: '07000000103', condition: 'HIV', adherence: 0.98, meds: [['TLD', '1 tablet', ['21:00'], 'Same time every night']] },
  { name: 'Ngozi Eze', phone: '07000000104', condition: 'Hypertension', adherence: 0.71, meds: [['Nifedipine', '20 mg', ['07:00', '19:00']]] },
  { name: 'Emeka Nwosu', phone: '07000000105', condition: 'Tuberculosis', adherence: 0.88, meds: [['RHZE', '4 tablets', ['07:00'], 'Before breakfast']] },
  { name: 'Fatima Sule', phone: '07000000106', condition: 'Asthma', adherence: 0.83, meds: [['Montelukast', '10 mg', ['21:00']]] },
  { name: 'Kelechi Obi', phone: '07000000107', condition: 'Type 2 diabetes', adherence: 0.55, meds: [['Metformin', '850 mg', ['08:00', '14:00', '20:00']], ['Glimepiride', '2 mg', ['08:00']]] },
  { name: 'Yetunde Balogun', phone: '07000000108', condition: 'Epilepsy', adherence: 0.92, meds: [['Levetiracetam', '500 mg', ['08:00', '20:00']]] },
];

export async function seed(db, { password, now = new Date(), log = console.log } = {}) {
  const olds = await db.collection('users').find({ email: { $in: [ADMIN_EMAIL, ...PREVIOUS_ADMIN_EMAILS] } }).toArray();
  for (const { clinicId } of olds) {
    await Promise.all(
      ['users', 'patients', 'medications', 'doseLogs', 'appointments', 'reminders'].map((c) => db.collection(c).deleteMany({ clinicId })),
    );
    await db.collection('clinics').deleteOne({ _id: clinicId });
  }

  const admin = await registerClinic(db, { clinicName: 'Sunrise Family Clinic', timezone: 'Africa/Lagos', name: 'Dr. Ada Nnamdi', email: ADMIN_EMAIL, password }, { rounds: 10 });
  await addStaff(db, admin, { name: 'Nurse Bisi Lawal', email: NURSE_EMAIL, password, role: 'staff' }, { rounds: 10 });
  const clinic = await db.collection('clinics').findOne({ name: 'Sunrise Family Clinic' }, { sort: { _id: -1 } });
  const tz = clinic.timezone;
  const today = localDate(now, tz);
  const start = addDays(today, -35);
  const rand = random(2026);
  const sender = { provider: 'log', send: async () => ({ id: null }) };
  const links = [];

  for (const p of PATIENTS) {
    const { patient, portalLink } = await createPatient(db, sender, { clinic, input: p, appUrl: getConfig().appUrl, now: zonedToUtc(start, '09:00', tz) });
    links.push([p.name, portalLink]);

    for (const [name, dosage, times, instructions] of p.meds) {
      const medication = await addMedication(db, { clinic, patientId: String(patient._id), input: { name, dosage, times, startDate: start, instructions }, userId: admin.id });
      // Every past dose: taken with the patient's usual probability, a little worse at weekends.
      const past = occurrences(medication, zonedToUtc(start, '00:00', tz), now, tz);
      const logs = past
        .filter((d) => {
          const weekend = [0, 6].includes(new Date(`${d.day}T12:00:00Z`).getUTCDay());
          return rand() < p.adherence - (weekend ? 0.08 : 0) && d.at.getTime() < now.getTime() - 20 * 60 * 1000;
        })
        .map((d) => ({
          clinicId: clinic._id,
          patientId: patient._id,
          medicationId: medication._id,
          scheduledFor: d.at,
          status: 'taken',
          source: rand() < 0.9 ? 'patient' : 'staff',
          loggedAt: new Date(d.at.getTime() + Math.round((rand() - 0.3) * 60) * 60 * 1000),
        }));
      if (logs.length) await db.collection('doseLogs').insertMany(logs);
    }
  }

  const patients = await db.collection('patients').find({ clinicId: clinic._id }).sort({ name: 1 }).toArray();
  const book = (i, days, time, reason, status) =>
    addAppointment(db, { clinic, patientId: String(patients[i]._id), input: { date: addDays(today, days), time, reason } }).then((a) =>
      status ? db.collection('appointments').updateOne({ _id: a._id }, { $set: { status } }) : a,
    );
  await Promise.all([
    book(0, 1, '09:30', 'Blood pressure review'),
    book(3, 1, '11:00', 'Monthly refill'),
    book(5, 3, '10:00', 'HbA1c test'),
    book(6, 6, '14:00', 'Sputum test'),
    book(1, -7, '10:00', 'Check-up', 'attended'),
    book(4, -3, '09:00', 'Blood pressure review', 'missed'),
  ]);

  log(`Sample clinic ready: ${clinic.name}`);
  log(`  admin: ${ADMIN_EMAIL}   staff: ${NURSE_EMAIL}   password: (the one you set)`);
  log('  patient portal links:');
  for (const [name, link] of links) log(`    ${name.padEnd(16)} ${link}`);
  return { clinic, links };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { mongodbUri, dbName } = getConfig();
  // DEMO_PASSWORD is the old name, still accepted.
  const password = process.env.SEED_PASSWORD || process.env.DEMO_PASSWORD;
  if (!mongodbUri || !password || password.length < 10) {
    console.error('Set MONGODB_URI and SEED_PASSWORD (at least 10 characters).');
    process.exit(1);
  }
  const client = await MongoClient.connect(mongodbUri);
  try {
    const db = client.db(dbName);
    await ensureIndexes(db);
    await seed(db, { password });
  } finally {
    await client.close();
  }
}
