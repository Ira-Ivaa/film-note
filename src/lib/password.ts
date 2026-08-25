import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Throwaway hash of a random string, computed once per process. Not a secret:
 * it matches no account and is never compared against stored credentials, so it
 * needs no environment variable.
 */
let decoyHash: Promise<string> | null = null;

/**
 * Spends the same CPU as a real password check. Call it on the "no such user"
 * branch of login so that response time does not reveal which emails exist.
 */
export async function burnPasswordTime(plain: string): Promise<void> {
  decoyHash ??= bcrypt.hash(randomBytes(16).toString('hex'), COST);
  await bcrypt.compare(plain, await decoyHash);
}
