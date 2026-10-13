import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const RECOVERY_KEY_RE = /^[a-f0-9]{32}$/;

export function generateRecoveryKey(): string {
  return randomBytes(16).toString("hex");
}

export function normalizeRecoveryKey(value: string): string {
  return value.trim().replace(/[\s-]/g, "").toLowerCase();
}

export function hashRecoveryKey(value: string): string {
  return createHash("sha256").update(normalizeRecoveryKey(value)).digest("hex");
}

export function recoveryKeyMatches(value: string, expectedHash: string): boolean {
  if (!RECOVERY_KEY_RE.test(normalizeRecoveryKey(value)) || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    return false;
  }
  const supplied = Buffer.from(hashRecoveryKey(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
