import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * One-time recovery code in the format AAA1-BBB1-CCCC1:
 * letters A–Z, and each group ends with one digit from 1 to 9.
 */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "123456789";

export const RECOVERY_CODE_RE = /^[A-Z]{3}[1-9]-[A-Z]{3}[1-9]-[A-Z]{4}[1-9]$/;

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

function group(letterCount: number): string {
  let out = "";
  for (let i = 0; i < letterCount; i++) out += pick(LETTERS);
  return out + pick(DIGITS);
}

export function generateRecoveryCode(): string {
  return [group(3), group(3), group(4)].join("-");
}

/** Accept what the user types: any case, surrounding spaces ignored. */
export function normalizeRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function recoveryCodeMatches(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashRecoveryCode(code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
