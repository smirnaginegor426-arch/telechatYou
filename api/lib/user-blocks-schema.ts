import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/** Create account block relations before the API starts serving requests. */
export async function ensureUserBlocksSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS user_blocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    blockerId BIGINT UNSIGNED NOT NULL,
    blockedId BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY user_blocks_pair_uniq (blockerId, blockedId),
    KEY user_blocks_blocker_idx (blockerId),
    KEY user_blocks_blocked_idx (blockedId)
  ) ENGINE=InnoDB`));
}
