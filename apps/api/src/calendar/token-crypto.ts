import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * AES-256-GCM for the Google refresh token at rest. A database dump alone can't be
 * used to read the calendar without TOKEN_ENCRYPTION_KEY, which lives only in env.
 * Format: base64(iv).base64(authTag).base64(ciphertext)
 */
export function encrypt(plain: string, keyB64: string): string {
  const key = Buffer.from(keyB64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string, keyB64: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * OAuth `state`: proves the callback belongs to a connect flow this server started
 * (CSRF protection) and expires after 10 minutes.
 */
export function signState(secretB64: string, now = Date.now()): string {
  const body = `${randomBytes(12).toString('base64url')}.${now + 10 * 60_000}`;
  return `${body}.${hmac(body, secretB64)}`;
}

export function verifyState(state: string, secretB64: string, now = Date.now()): boolean {
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(hmac(body, secretB64));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Number(parts[1]) > now;
}

function hmac(body: string, secretB64: string) {
  return createHmac('sha256', Buffer.from(secretB64, 'base64')).update(`oauth-state:${body}`).digest('base64url');
}
