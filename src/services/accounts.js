import bcrypt from 'bcryptjs';
import { AppError, forbidden } from '../lib/errors.js';
import { isDuplicateKey, toObjectId } from '../lib/db.js';
import { loginSchema, parse, registerSchema, staffSchema } from '../lib/validation.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
let dummyHash;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('not-a-real-password', 12));

const toSessionUser = (user) => ({
  id: String(user._id),
  clinicId: String(user.clinicId),
  role: user.role,
  name: user.name,
});

// A new clinic and its first user, who becomes the clinic's admin.
export async function registerClinic(db, input, { rounds = 12, now = new Date() } = {}) {
  const data = parse(registerSchema, input);
  if (await db.collection('users').findOne({ email: data.email })) {
    throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', { fields: { email: 'Already registered' } });
  }

  const clinic = { name: data.clinicName, timezone: data.timezone, createdAt: now };
  const { insertedId: clinicId } = await db.collection('clinics').insertOne(clinic);
  const user = {
    clinicId,
    name: data.name,
    email: data.email,
    role: 'admin',
    passwordHash: await bcrypt.hash(data.password, rounds),
    createdAt: now,
  };
  try {
    const { insertedId } = await db.collection('users').insertOne(user);
    return toSessionUser({ ...user, _id: insertedId });
  } catch (error) {
    await db.collection('clinics').deleteOne({ _id: clinicId }); // no half-created clinic
    if (isDuplicateKey(error)) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', { fields: { email: 'Already registered' } });
    throw error;
  }
}

export async function authenticate(db, input, { now = new Date() } = {}) {
  const { email, password } = parse(loginSchema, input);
  const attempts = db.collection('loginAttempts');

  const recentFailures = await attempts.countDocuments({ email, at: { $gte: new Date(now.getTime() - LOCKOUT_MS) } });
  if (recentFailures >= MAX_FAILED_LOGINS) {
    throw new AppError('LOCKED', 'Too many failed attempts. Try again in 15 minutes.', { status: 429 });
  }

  const user = await db.collection('users').findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !ok) {
    await attempts.insertOne({ email, at: now });
    throw new AppError('BAD_CREDENTIALS', 'Wrong email or password', { status: 401 });
  }

  await attempts.deleteMany({ email });
  return toSessionUser(user);
}

export async function getClinic(db, clinicId) {
  const id = toObjectId(clinicId);
  return id ? db.collection('clinics').findOne({ _id: id }) : null;
}

export async function getUser(db, session) {
  const id = toObjectId(session?.id);
  if (!id) return null;
  return db.collection('users').findOne(
    { _id: id, clinicId: toObjectId(session.clinicId) },
    { projection: { passwordHash: 0 } },
  );
}

export async function addStaff(db, actor, input, { rounds = 12, now = new Date() } = {}) {
  if (actor.role !== 'admin') throw forbidden('Only an admin can add team members');
  const data = parse(staffSchema, input);
  try {
    const user = { clinicId: toObjectId(actor.clinicId), name: data.name, email: data.email, role: data.role, passwordHash: await bcrypt.hash(data.password, rounds), createdAt: now };
    const { insertedId } = await db.collection('users').insertOne(user);
    return toSessionUser({ ...user, _id: insertedId });
  } catch (error) {
    if (isDuplicateKey(error)) throw new AppError('EMAIL_TAKEN', 'This email is already used', { fields: { email: 'Already registered' } });
    throw error;
  }
}

export async function listStaff(db, clinicId) {
  return db
    .collection('users')
    .find({ clinicId: toObjectId(clinicId) }, { projection: { passwordHash: 0 } })
    .sort({ createdAt: 1 })
    .toArray();
}
