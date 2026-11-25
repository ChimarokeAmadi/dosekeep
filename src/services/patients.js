import { notFound } from '../lib/errors.js';
import { toObjectId } from '../lib/db.js';
import { hashToken, newPortalToken } from '../lib/tokens.js';
import { parse, patientSchema } from '../lib/validation.js';
import { sendMessage } from './messages.js';

// Every query includes the clinicId from the session, so one clinic can never
// read or change another clinic's patients, even with a guessed id.
const clinicFilter = (clinicId, extra = {}) => ({ clinicId: toObjectId(clinicId), ...extra });

export const portalUrl = (appUrl, token) => `${appUrl}/p/${token}`;

async function sendPortalLink(db, sender, { patient, clinic, token, appUrl, now }) {
  const link = portalUrl(appUrl, token);
  const text = (url) => `${clinic.name}: hello ${patient.name.split(' ')[0]}, this is your DoseKeep link to see your medicines and mark doses as taken: ${url}`;
  return sendMessage(db, sender, {
    key: `link:${patient._id}:${now.getTime()}`,
    clinicId: patient.clinicId,
    patientId: patient._id,
    kind: 'link',
    to: patient.phone,
    body: text(link),
    storedBody: text('[private link]'),
    now,
  });
}

export async function createPatient(db, sender, { clinic, input, appUrl, now = new Date() }) {
  const data = parse(patientSchema, input);
  const token = newPortalToken();
  const patient = { clinicId: clinic._id, ...data, portalTokenHash: hashToken(token), active: true, createdAt: now };
  const { insertedId } = await db.collection('patients').insertOne(patient);
  patient._id = insertedId;
  const sms = await sendPortalLink(db, sender, { patient, clinic, token, appUrl, now });
  return { patient, portalLink: portalUrl(appUrl, token), sms };
}

export async function listPatients(db, clinicId) {
  return db.collection('patients').find(clinicFilter(clinicId, { active: true })).sort({ name: 1 }).toArray();
}

export async function getPatient(db, clinicId, patientId) {
  const id = toObjectId(patientId);
  if (!id) return null;
  return db.collection('patients').findOne(clinicFilter(clinicId, { _id: id }));
}

// Makes the old link stop working and texts the new one.
export async function resetPortalLink(db, sender, { clinic, patientId, appUrl, now = new Date() }) {
  const patient = await getPatient(db, clinic._id, patientId);
  if (!patient) throw notFound('Patient');
  const token = newPortalToken();
  await db.collection('patients').updateOne({ _id: patient._id }, { $set: { portalTokenHash: hashToken(token) } });
  const sms = await sendPortalLink(db, sender, { patient, clinic, token, appUrl, now });
  return { portalLink: portalUrl(appUrl, token), sms };
}

export async function findByPortalToken(db, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 64) return null;
  const patient = await db.collection('patients').findOne({ portalTokenHash: hashToken(token), active: true });
  if (!patient) return null;
  const clinic = await db.collection('clinics').findOne({ _id: patient.clinicId });
  return clinic ? { patient, clinic } : null;
}
