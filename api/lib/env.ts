import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET?.trim() ?? "";
if (isProduction && sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters in production");
}

export const env = {
  isProduction,
  databaseUrl: required("DATABASE_URL"),
  // Opaque sessions are database-backed; this secret protects the stored token hash.
  sessionSecret: sessionSecret || "development-only-change-this-session-secret",
  uploadDir: process.env.UPLOAD_DIR?.trim() || "./data/uploads",
  maxUploadMb: Math.max(1, Math.min(100, Number.parseInt(process.env.MAX_UPLOAD_MB || "20", 10) || 20)),
};
