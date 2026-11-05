/**
 * Server-only helpers (Node crypto). Never import from the Android app or client components.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function randomBase62(length: number): string {
  const out: string[] = [];
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      // Reject bytes ≥ 248 so every character is equally likely.
      if (byte < 248 && out.length < length) out.push(BASE62[byte % 62]!);
    }
  }
  return out.join('');
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const API_KEY_PREFIX = 'sk-vg-v1-';

export interface GeneratedApiKey {
  /** Full secret, shown to the user once. */
  key: string;
  /** SHA-256 of the key; the only form stored. */
  hash: string;
  /** Safe to show: "sk-vg-v1-98a4••••3f12". */
  display: string;
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBase62(40);
  const key = `${API_KEY_PREFIX}${secret}`;
  return { key, hash: sha256Hex(key), display: `${API_KEY_PREFIX}${secret.slice(0, 4)}••••${secret.slice(-4)}` };
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length === API_KEY_PREFIX.length + 40;
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

/** Format: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export interface SessionToken {
  token: string;
  hash: string;
}

export function generateSessionToken(): SessionToken {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256Hex(token) };
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function randomId(prefix: string, length = 20): string {
  return `${prefix}_${randomBase62(length)}`;
}
