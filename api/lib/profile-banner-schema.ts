import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/** Add the optional profile-cover column on existing production databases. */
export async function ensureProfileBannerSchema(): Promise<void> {
  try {
    await getDb().execute(sql.raw("ALTER TABLE profiles ADD COLUMN bannerKey VARCHAR(255) NULL"));
  } catch (error) {
    // Drizzle may wrap the MySQL error in a QueryError, so inspect the cause
    // chain instead of relying only on the outer error's code.
    let current: unknown = error;
    for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
      const dbError = current as {
        code?: string;
        errno?: number;
        cause?: unknown;
        message?: string;
        sqlMessage?: string;
      };

      if (
        dbError.code === "ER_DUP_FIELDNAME" ||
        dbError.errno === 1060 ||
        /Duplicate column name ['"]bannerKey['"]/i.test(
          dbError.sqlMessage ?? dbError.message ?? "",
        )
      ) {
        // The column already exists; this migration is safe to run repeatedly.
        return;
      }

      current = dbError.cause;
    }

    throw error;
  }
}
