import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { credentials, recoveryCodes } from "@db/schema";
import { getDb } from "./connection";
import { affectedRows } from "../lib/rate-limit";

export async function getCredentialByUserId(userId: number) {
  return getDb().query.credentials.findFirst({
    where: eq(credentials.userId, userId),
  });
}

export async function upsertPasswordHash(userId: number, passwordHash: string) {
  await getDb()
    .insert(credentials)
    .values({ userId, passwordHash })
    .onDuplicateKeyUpdate({ set: { passwordHash } });
}

/** Mark every unused code of this user as used, so only the newest one can work. */
export async function invalidateRecoveryCodes(userId: number) {
  await getDb()
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
}

export async function createRecoveryCode(userId: number, codeHash: string, expiresAt: Date) {
  await getDb().insert(recoveryCodes).values({ userId, codeHash, expiresAt });
}

/** The newest code that is still usable (not used, not expired). */
export async function getActiveRecoveryCode(userId: number) {
  return getDb().query.recoveryCodes.findFirst({
    where: and(
      eq(recoveryCodes.userId, userId),
      isNull(recoveryCodes.usedAt),
      gt(recoveryCodes.expiresAt, new Date()),
    ),
    orderBy: [desc(recoveryCodes.id)],
  });
}

export async function bumpRecoveryAttempts(id: number, attempts: number, maxAttempts: number) {
  const next = attempts + 1;
  await getDb()
    .update(recoveryCodes)
    .set({
      attempts: next,
      // lock the code after too many wrong guesses
      usedAt: next >= maxAttempts ? new Date() : undefined,
    })
    .where(eq(recoveryCodes.id, id));
}

/**
 * Atomically consume a code. Returns false if someone else already used it
 * (or it expired), so the same code can never be accepted twice.
 */
export async function consumeRecoveryCode(id: number): Promise<boolean> {
  const res = await getDb()
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(recoveryCodes.id, id),
        isNull(recoveryCodes.usedAt),
        gt(recoveryCodes.expiresAt, new Date()),
      ),
    );
  return affectedRows(res) === 1;
}
