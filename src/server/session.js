import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { createSessionToken, readSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session';
import { createSmsSender } from '@/lib/sms';
import { getClinic, getUser } from '@/services/accounts';

export const getSession = cache(async () => {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value, getConfig().sessionSecret);
});

// Used by every staff page and every staff action. The user and clinic are read
// from the database each time, so a deleted account loses access at once.
export const requireStaff = cache(async () => {
  const session = await getSession();
  if (!session) redirect('/login');
  const db = await getDb();
  const [clinic, user] = await Promise.all([getClinic(db, session.clinicId), getUser(db, session)]);
  if (!clinic || !user) redirect('/login?expired=1');
  return { db, clinic, user: { id: session.id, clinicId: session.clinicId, role: user.role, name: user.name } };
});

export async function startSession(user) {
  const token = await createSessionToken(user, getConfig().sessionSecret);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export function smsSender() {
  return createSmsSender(getConfig().sms);
}
