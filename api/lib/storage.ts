import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "./env";

export type ReviewStatus = "active";
export interface UploadFileInput { fileContent: Uint8Array | string; fileName: string; contentType?: string }
export interface UploadResult { key: string; fileName: string; size: number; contentType: string; reviewStatus: ReviewStatus }
export interface FileMeta { key: string; fileName?: string; size: number; contentType: string; lastModified?: string; reviewStatus: ReviewStatus }
export interface ListFilesInput { prefix?: string; delimiter?: "/" | ""; maxKeys?: number; pageToken?: string }
export interface ListFilesResult { folders: string[]; objects: FileMeta[]; nextPageToken?: string }
export interface PresignedUrlResult { key: string; url: string; expireTime?: string }
export interface DeleteFilesResult { deleted: string[]; failed: { key: string; message: string }[] }

export class StorageError extends Error {
  readonly code: "STORAGE_OBJECT_NOT_FOUND" | "STORAGE_INVALID_INPUT" | "STORAGE_FILE_TOO_LARGE";

  constructor(code: "STORAGE_OBJECT_NOT_FOUND" | "STORAGE_INVALID_INPUT" | "STORAGE_FILE_TOO_LARGE", message: string) {
    super(message);
    this.code = code;
    this.name = "StorageError";
  }
}

const root = path.resolve(env.uploadDir);
const maxBytes = env.maxUploadMb * 1024 * 1024;
const s3 = env.s3Enabled
  ? new S3Client({
      region: env.s3Region,
      endpoint: env.s3Endpoint,
      maxAttempts: 3,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    })
  : null;

if (env.isProduction && !s3) {
  console.warn(
    "[storage] S3 object storage is not configured. Files are stored on the local filesystem and may disappear when the host restarts or redeploys.",
  );
}

const mimeTypes: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".pdf": "application/pdf", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown",
  ".zip": "application/zip", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function assertKey(key: string) {
  if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some((s) => !s || s === "." || s === "..") || /[\u0000-\u001f]/.test(key)) {
    throw new StorageError("STORAGE_INVALID_INPUT", "Некорректный ключ файла");
  }
}
function safePath(key: string): string {
  assertKey(key);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new StorageError("STORAGE_INVALID_INPUT", "Некорректный путь файла");
  return full;
}
function encodeKey(key: string) { return key.split("/").map(encodeURIComponent).join("/"); }
function contentTypeFor(key: string) { return mimeTypes[path.extname(key).toLowerCase()] ?? "application/octet-stream"; }
function randomKey(fileName: string) {
  const normalized = fileName.replace(/\\/g, "/").split("/").map((part) => part.replace(/[^\p{L}\p{N}._ -]/gu, "_")).join("/");
  assertKey(normalized);
  const dir = path.posix.dirname(normalized);
  const base = path.posix.basename(normalized);
  const ext = path.posix.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  const unique = `${stem}-${randomBytes(6).toString("hex")}${ext}`;
  return dir === "." ? unique : `${dir}/${unique}`;
}

function isMissingS3Object(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    value.$metadata?.httpStatusCode === 404 ||
    ["NoSuchKey", "NoSuchObject", "NotFound"].includes(value.name ?? "") ||
    ["NoSuchKey", "NoSuchObject", "NotFound"].includes(value.Code ?? "")
  );
}

function requireS3(): S3Client {
  if (!s3 || !env.s3Bucket) {
    throw new Error("S3-compatible storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  }
  return s3;
}

export class Storage {
  async uploadFile(input: UploadFileInput): Promise<UploadResult> {
    const data = typeof input.fileContent === "string" ? Buffer.from(input.fileContent, "utf8") : Buffer.from(input.fileContent);
    if (!data.byteLength) throw new StorageError("STORAGE_INVALID_INPUT", "Файл пустой");
    if (data.byteLength > maxBytes) throw new StorageError("STORAGE_FILE_TOO_LARGE", `Файл превышает лимит ${env.maxUploadMb} МБ`);

    const key = randomKey(input.fileName);
    const contentType = input.contentType || contentTypeFor(key);

    if (s3) {
      await s3.send(new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: data,
        ContentLength: data.byteLength,
        ContentType: contentType,
      }));
    } else {
      const full = safePath(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, data, { flag: "wx" });
    }

    return { key, fileName: path.posix.basename(key), size: data.byteLength, contentType, reviewStatus: "active" };
  }

  async readFile(input: { fileKey: string }): Promise<Uint8Array> {
    assertKey(input.fileKey);
    if (s3) {
      try {
        const response = await s3.send(new GetObjectCommand({ Bucket: env.s3Bucket, Key: input.fileKey }));
        if (!response.Body) throw new StorageError("STORAGE_OBJECT_NOT_FOUND", "Файл не найден");
        return new Uint8Array(await response.Body.transformToByteArray());
      } catch (error) {
        if (error instanceof StorageError) throw error;
        if (isMissingS3Object(error)) throw new StorageError("STORAGE_OBJECT_NOT_FOUND", "Файл не найден");
        throw error;
      }
    }

    try { return new Uint8Array(await readFile(safePath(input.fileKey))); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError("STORAGE_OBJECT_NOT_FOUND", "Файл не найден"); throw e; }
  }

  async getPresignedUrls(input: { keys: string[]; download?: boolean }): Promise<{ urls: PresignedUrlResult[]; failures: { key: string; message: string }[] }> {
    // Keep all downloads behind the authenticated app endpoint; object storage stays private.
    const urls = input.keys.map((key) => ({ key, url: `/api/files/${encodeKey(key)}${input.download ? "?download=1" : ""}` }));
    return { urls, failures: [] };
  }

  async fileExists(input: { fileKey: string }): Promise<boolean> {
    try { await this.headFile(input); return true; }
    catch (e) { if (e instanceof StorageError && e.code === "STORAGE_OBJECT_NOT_FOUND") return false; throw e; }
  }

  async headFile(input: { fileKey: string }): Promise<FileMeta> {
    assertKey(input.fileKey);
    if (s3) {
      try {
        const info = await s3.send(new HeadObjectCommand({ Bucket: env.s3Bucket, Key: input.fileKey }));
        return {
          key: input.fileKey,
          fileName: path.posix.basename(input.fileKey),
          size: Number(info.ContentLength ?? 0),
          contentType: info.ContentType || contentTypeFor(input.fileKey),
          lastModified: info.LastModified?.toISOString(),
          reviewStatus: "active",
        };
      } catch (error) {
        if (isMissingS3Object(error)) throw new StorageError("STORAGE_OBJECT_NOT_FOUND", "Файл не найден");
        throw error;
      }
    }

    const full = safePath(input.fileKey);
    try {
      const info = await stat(full);
      if (!info.isFile()) throw new StorageError("STORAGE_OBJECT_NOT_FOUND", "Файл не найден");
      return { key: input.fileKey, fileName: path.posix.basename(input.fileKey), size: info.size, contentType: contentTypeFor(input.fileKey), lastModified: info.mtime.toISOString(), reviewStatus: "active" };
    } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError("STORAGE_OBJECT_NOT_FOUND", "Файл не найден"); throw e; }
  }

  async listFiles(input: ListFilesInput = {}): Promise<ListFilesResult> {
    const prefix = input.prefix ?? "";
    if (prefix) assertKey(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix);
    const size = Math.max(1, Math.min(input.maxKeys ?? 100, 100));

    if (s3) {
      const result = await s3.send(new ListObjectsV2Command({
        Bucket: env.s3Bucket,
        Prefix: prefix || undefined,
        Delimiter: input.delimiter === "/" ? "/" : undefined,
        MaxKeys: size,
        ContinuationToken: input.pageToken || undefined,
      }));
      const objects: FileMeta[] = (result.Contents ?? []).flatMap((item) => {
        if (!item.Key) return [];
        return [{
          key: item.Key,
          fileName: path.posix.basename(item.Key),
          size: Number(item.Size ?? 0),
          contentType: contentTypeFor(item.Key),
          lastModified: item.LastModified?.toISOString(),
          reviewStatus: "active" as const,
        }];
      });
      const folders = (result.CommonPrefixes ?? [])
        .map((item) => item.Prefix ?? "")
        .filter(Boolean);
      return { folders, objects, nextPageToken: result.NextContinuationToken };
    }

    const objects: FileMeta[] = [];
    const folders = new Set<string>();
    const start = prefix ? safePath(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix) : root;
    const walk = async (dir: string) => {
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return; throw e; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const key = path.relative(root, full).split(path.sep).join("/");
        if (entry.isDirectory()) {
          if (input.delimiter === "/") folders.add(`${key}/`);
          else await walk(full);
        } else if (entry.isFile()) {
          if (input.delimiter === "/" && prefix && key.slice(prefix.length).includes("/")) {
            folders.add(`${key.slice(0, key.indexOf("/", prefix.length))}/`);
            continue;
          }
          objects.push(await this.headFile({ fileKey: key }));
        }
      }
    };
    await walk(start);
    const offset = Math.max(0, Number(input.pageToken ?? "0") || 0);
    const sorted = objects.sort((a, b) => a.key.localeCompare(b.key));
    const slice = sorted.slice(offset, offset + size);
    return { folders: [...folders].sort(), objects: slice, nextPageToken: offset + size < sorted.length ? String(offset + size) : undefined };
  }

  async deleteFile(input: { fileKey: string }): Promise<boolean> {
    assertKey(input.fileKey);
    if (s3) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: env.s3Bucket,
        Delete: { Objects: [{ Key: input.fileKey }], Quiet: true },
      }));
      return true;
    }
    try { await unlink(safePath(input.fileKey)); return true; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return true; throw e; }
  }

  async deleteFiles(input: { fileKeys: string[] }): Promise<DeleteFilesResult> {
    const fileKeys = [...new Set(input.fileKeys)];
    for (const key of fileKeys) assertKey(key);
    if (!fileKeys.length) return { deleted: [], failed: [] };

    if (s3) {
      const result = await s3.send(new DeleteObjectsCommand({
        Bucket: env.s3Bucket,
        Delete: { Objects: fileKeys.map((key) => ({ Key: key })), Quiet: false },
      }));
      const failures = (result.Errors ?? []).map((error) => ({
        key: error.Key ?? "",
        message: error.Message ?? error.Code ?? "Не удалось удалить файл",
      }));
      const failedKeys = new Set(failures.map((failure) => failure.key));
      return { deleted: fileKeys.filter((key) => !failedKeys.has(key)), failed: failures };
    }

    const deleted: string[] = [];
    const failed: { key: string; message: string }[] = [];
    for (const key of fileKeys) {
      try { await this.deleteFile({ fileKey: key }); deleted.push(key); }
      catch (e) { failed.push({ key, message: e instanceof Error ? e.message : String(e) }); }
    }
    return { deleted, failed };
  }
}

export const storage = new Storage();
