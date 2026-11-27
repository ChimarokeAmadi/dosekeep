// Runs the whole app locally with no setup: an in-memory MongoDB (data kept in .data/),
// the sample clinic, and `next dev`.   npm run dev:local
//
// Pass --prod to run the production build instead (npm run build first).

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ensureIndexes } from '../src/lib/db.js';
import { ADMIN_EMAIL, seed } from './seed.js';

const PASSWORD = process.env.SEED_PASSWORD || process.env.DEMO_PASSWORD || 'sunrise-local-2026';
const prod = process.argv.includes('--prod');

mkdirSync('.data/mongo', { recursive: true });
const mongo = await MongoMemoryServer.create({ instance: { dbPath: '.data/mongo', storageEngine: 'wiredTiger', port: 27099 } });
const uri = mongo.getUri();
const env = {
  ...process.env,
  MONGODB_URI: uri,
  MONGODB_DB: 'dosekeep',
  SESSION_SECRET: process.env.SESSION_SECRET || 'local-development-secret-change-me-0123456789',
  CRON_SECRET: process.env.CRON_SECRET || 'local-cron-secret',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  BCRYPT_ROUNDS: '10',
};
Object.assign(process.env, env);

const client = await MongoClient.connect(uri);
const db = client.db('dosekeep');
await ensureIndexes(db);
if (!(await db.collection('users').findOne({ email: ADMIN_EMAIL }))) {
  await seed(db, { password: PASSWORD });
  console.log(`  (local password: ${PASSWORD})`);
} else {
  console.log(`Using existing local data. Sign in as ${ADMIN_EMAIL}. Delete .data/ to start fresh.`);
}
await client.close();

const next = spawn('npx', ['next', prod ? 'start' : 'dev'], { env, stdio: 'inherit' });
const stop = async () => {
  next.kill();
  await mongo.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
next.on('exit', stop);
