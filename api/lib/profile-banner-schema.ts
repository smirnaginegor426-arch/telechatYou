import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/** Add the optional profile-cover column on existing production databases. */
export async function ensureProfileBannerSchema(): Promise<void> {
  try {
    await getDb().execute(sql.raw("ALTER TABLE profiles ADD COLUMN bannerKey VARCHAR(255) NULL"));
  } catch (error) {
    const dbError = error as { code?: string; errno?: number };
    if (dbError.code !== "ER_DUP_FIELDNAME" && dbError.errno !== 1060) throw error;
  }
}
