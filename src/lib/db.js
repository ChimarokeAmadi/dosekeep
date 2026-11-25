import { MongoClient, ObjectId } from 'mongodb';
import { getConfig } from './config.js';

// One connection pool per server instance. On Vercel a warm function reuses it
// between requests instead of reconnecting every time.
const cache = globalThis.__dosekeepDb ?? (globalThis.__dosekeepDb = { promise: null });

export function getDb() {
  if (!cache.promise) {
    const { mongodbUri, dbName } = getConfig();
    if (!mongodbUri) throw new Error('MONGODB_URI is not set');
    const client = new MongoClient(mongodbUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000, appName: 'dosekeep' });
    cache.promise = client
      .connect()
      .then(async (connected) => {
        const db = connected.db(dbName);
        await ensureIndexes(db);
        return db;
      })
      .catch((error) => {
        cache.promise = null; // try again on the next request
        throw error;
      });
  }
  return cache.promise;
}

export async function ensureIndexes(db) {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ clinicId: 1 }),
    db.collection('patients').createIndex({ clinicId: 1, name: 1 }),
    db.collection('patients').createIndex({ portalTokenHash: 1 }, { unique: true }),
    db.collection('medications').createIndex({ clinicId: 1, patientId: 1 }),
    db.collection('doseLogs').createIndex({ medicationId: 1, scheduledFor: 1 }, { unique: true }),
    db.collection('doseLogs').createIndex({ clinicId: 1, scheduledFor: 1 }),
    db.collection('appointments').createIndex({ clinicId: 1, at: 1 }),
    db.collection('appointments').createIndex({ patientId: 1, at: 1 }),
    db.collection('reminders').createIndex({ key: 1 }, { unique: true }),
    db.collection('reminders').createIndex({ clinicId: 1, createdAt: -1 }),
    db.collection('loginAttempts').createIndex({ email: 1 }),
    db.collection('loginAttempts').createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 }),
  ]);
}

// Returns null instead of throwing for ids that are not valid ObjectIds (e.g. typed in a URL).
export function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return typeof id === 'string' && ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
}

export function isDuplicateKey(error) {
  return error?.code === 11000;
}
