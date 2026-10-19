import { eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { channels } from "@db/schema";

function mysqlErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { code?: string; cause?: { code?: string; cause?: { code?: string } } };
  return value.code ?? value.cause?.code ?? value.cause?.cause?.code;
}

/**
 * Read the optional permission separately from the normal channel row.
 * This keeps ordinary channel reads and posting operational while an older
 * database is waiting for the additive comments column migration.
 */
export async function getChannelCommentsEnabled(chatId: number): Promise<boolean> {
  try {
    const rows = await getDb()
      .select({ enabled: sql<boolean>`commentsEnabled` })
      .from(channels)
      .where(eq(channels.chatId, chatId))
      .limit(1);
    return Boolean(rows[0]?.enabled);
  } catch (error) {
    if (mysqlErrorCode(error) === "ER_BAD_FIELD_ERROR" || mysqlErrorCode(error) === "1054") {
      return false;
    }
    throw error;
  }
}

/** Save channel comment permission without changing the regular channel schema. */
export async function setChannelCommentsEnabled(chatId: number, enabled: boolean): Promise<void> {
  await getDb().execute(sql`UPDATE channels SET commentsEnabled = ${enabled} WHERE chatId = ${chatId}`);
}
