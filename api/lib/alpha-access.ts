import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { alphaAccessKeys } from "@db/schema";
import { getDb } from "../queries/connection";
import { affectedRows } from "./rate-limit";

type AlphaKeyType = "tester" | "subscriber";

const INITIAL_ALPHA_KEYS: Array<{
  key: string;
  keyType: AlphaKeyType;
  alreadyUsed: boolean;
}> = [
  { key: "TCY-NEW-7KQ9-M4XP", keyType: "tester", alreadyUsed: false },
  { key: "TCY-NEW-R8W2-Z6VN", keyType: "tester", alreadyUsed: false },
  { key: "TCY-NEW-H3JD-9BFT", keyType: "tester", alreadyUsed: false },
  { key: "TCY-ALPHA-7KQ9-M2VX-R8NP", keyType: "tester", alreadyUsed: false },
  { key: "TCY-ALPHA-4M8Q-T2ZP-K6RW", keyType: "tester", alreadyUsed: false },
  // The owner confirmed this subscriber key had already been used.
  { key: "TCY-ALPHA-9R4K-P7WQ-X3ND", keyType: "subscriber", alreadyUsed: true },
];

// Store the new tester key as a digest so the plaintext code isn't added to GitHub.
// It will be inserted idempotently at startup; only the recipient gets the raw key.
const INITIAL_ALPHA_KEY_HASHES: Array<{
  keyHash: string;
  keyType: AlphaKeyType;
  alreadyUsed: boolean;
}> = [
  { keyHash: "fa1dafcba838c3b23892c2081fdc0cacc1a6f9b6c60fa239e9709d891017a696", keyType: "tester", alreadyUsed: false },
];

function hashAlphaKey(key: string): string {
  return createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
}

/**
 * Create the persistent single-use key table and seed issued codes idempotently.
 * INSERT IGNORE never resets the usedAt value of an existing key.
 */
export async function ensureAlphaAccessKeySchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS alpha_access_keys (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    keyHash VARCHAR(64) NOT NULL,
    keyType ENUM('tester','subscriber') NOT NULL DEFAULT 'tester',
    usedAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY alpha_access_keys_hash_unique (keyHash),
    KEY alpha_access_keys_used_idx (usedAt)
  ) ENGINE=InnoDB`));

  for (const item of INITIAL_ALPHA_KEYS) {
    const keyHash = hashAlphaKey(item.key);
    await getDb().execute(sql`INSERT IGNORE INTO alpha_access_keys (keyHash, keyType, usedAt)
      VALUES (${keyHash}, ${item.keyType}, ${item.alreadyUsed ? new Date() : null})`);
  }

  for (const item of INITIAL_ALPHA_KEY_HASHES) {
    await getDb().execute(sql`INSERT IGNORE INTO alpha_access_keys (keyHash, keyType, usedAt)
      VALUES (${item.keyHash}, ${item.keyType}, ${item.alreadyUsed ? new Date() : null})`);
  }
}

export type AlphaKeyRedemption = "accepted" | "used" | "invalid";

/**
 * Consume a key in one atomic database update. Concurrent requests cannot both
 * succeed: only the request that changes usedAt from NULL is accepted.
 */
export async function redeemAlphaAccessKey(rawKey: string): Promise<AlphaKeyRedemption> {
  const normalized = rawKey.trim().toUpperCase();
  if (!/^[A-Z0-9-]{12,64}$/.test(normalized)) return "invalid";

  const keyHash = hashAlphaKey(normalized);
  const consumed = await getDb()
    .update(alphaAccessKeys)
    .set({ usedAt: new Date() })
    .where(and(eq(alphaAccessKeys.keyHash, keyHash), isNull(alphaAccessKeys.usedAt)));

  if (affectedRows(consumed) === 1) return "accepted";

  const [existing] = await getDb()
    .select({ usedAt: alphaAccessKeys.usedAt })
    .from(alphaAccessKeys)
    .where(eq(alphaAccessKeys.keyHash, keyHash))
    .limit(1);

  if (existing?.usedAt) return "used";
  return "invalid";
}
