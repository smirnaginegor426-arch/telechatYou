import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const RECOVERY_SECRET_RE = /^[a-f0-9]{64}$/;

export function generateRecoverySecret(): string {
  return randomBytes(32).toString("hex");
}

export function normalizeRecoverySecret(value: string): string {
  return value.trim().replace(/[\s-]/g, "").toLowerCase();
}

export function hashRecoverySecret(value: string): string {
  return createHash("sha256").update(normalizeRecoverySecret(value)).digest("hex");
}

export function recoverySecretMatches(value: string, expectedHash: string | undefined): boolean {
  const normalized = normalizeRecoverySecret(value);
  if (!RECOVERY_SECRET_RE.test(normalized) || !expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    return false;
  }

  const supplied = Buffer.from(hashRecoverySecret(normalized), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** Group a secret into readable chunks without changing the actual key. */
export function formatRecoverySecret(secret: string): string {
  return secret.match(/.{1,8}/g)?.join("-") ?? secret;
}
