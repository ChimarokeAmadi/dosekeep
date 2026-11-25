import { after, before, beforeEach } from 'node:test';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ensureIndexes, toObjectId } from '../src/lib/db.js';
import { registerClinic } from '../src/services/accounts.js';

// A real MongoDB (in memory) for each test file, emptied before every test.
export function setupDatabase() {
  const ctx = {};
  before(async () => {
    ctx.server = await MongoMemoryServer.create();
    ctx.client = await MongoClient.connect(ctx.server.getUri());
    ctx.db = ctx.client.db('dosekeep-test');
  });
  beforeEach(async () => {
    await ctx.db.dropDatabase();
    await ensureIndexes(ctx.db);
  });
  after(async () => {
    await ctx.client?.close();
    await ctx.server?.stop();
  });
  return ctx;
}

// Records messages instead of sending them.
export function fakeSender({ fail = false } = {}) {
  const sent = [];
  return {
    provider: 'fake',
    sent,
    async send(message) {
      if (fail) throw new Error('network down');
      sent.push(message);
      return { id: `msg-${sent.length}` };
    },
  };
}

export const APP_URL = 'https://dosekeep.test';

export async function makeClinic(db, overrides = {}) {
  const user = await registerClinic(
    db,
    { clinicName: 'Sunrise Clinic', timezone: 'Africa/Lagos', name: 'Ada Admin', email: `admin${Math.random()}@clinic.test`, password: 'correct horse battery', ...overrides },
    { rounds: 4 },
  );
  const clinic = await db.collection('clinics').findOne({ _id: toObjectId(user.clinicId) });
  return { user, clinic };
}

// Lagos is UTC+1 all year, so 08:00 local is 07:00Z.
export const at = (iso) => new Date(iso);
