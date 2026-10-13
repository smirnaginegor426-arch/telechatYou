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

const s3Endpoint = process.env.S3_ENDPOINT?.trim() ?? "";
const s3Bucket = process.env.S3_BUCKET?.trim() ?? "";
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID?.trim() ?? "";
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim() ?? "";
const s3Region = process.env.S3_REGION?.trim() || "auto";
const s3Values = [s3Endpoint, s3Bucket, s3AccessKeyId, s3SecretAccessKey];
const hasSomeS3Values = s3Values.some(Boolean);
const hasAllS3Values = s3Values.every(Boolean);

const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";
const cloudinaryValues = [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret];
const hasSomeCloudinaryValues = cloudinaryValues.some(Boolean);
const hasAllCloudinaryValues = cloudinaryValues.every(Boolean);

if (hasSomeCloudinaryValues && !hasAllCloudinaryValues) {
  throw new Error(
    "Cloudinary storage is only partially configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET together.",
  );
}
if (hasSomeS3Values && !hasAllS3Values) {
  throw new Error(
    "Persistent object storage is only partially configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY together.",
  );
}
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
  // Optional S3-compatible object storage (Cloudflare R2, AWS S3, etc.).
  s3Enabled: hasAllS3Values,
  s3Endpoint,
  s3Bucket,
  s3AccessKeyId,
  s3SecretAccessKey,
  s3Region,
  // Optional Cloudinary media storage. Uploads are stored as authenticated raw assets.
  cloudinaryEnabled: hasAllCloudinaryValues,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
};
