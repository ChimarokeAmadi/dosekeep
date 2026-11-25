import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'dk_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // one working shift

function key(secret) {
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user, secret, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ clinicId: user.clinicId, role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

export async function readSessionToken(token, secret) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] });
    return { id: payload.sub, clinicId: payload.clinicId, role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}
