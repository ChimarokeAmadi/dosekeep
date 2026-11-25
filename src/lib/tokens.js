import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Patient portal links carry a random token. Only its SHA-256 hash is stored,
// so a copy of the database does not give access to anyone's portal.
export function newPortalToken() {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function safeEqual(a, b) {
  const left = Buffer.from(hashToken(a));
  const right = Buffer.from(hashToken(b));
  return timingSafeEqual(left, right);
}
