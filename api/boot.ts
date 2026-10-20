import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { storage, StorageError } from "./lib/storage";
import { getSessionToken, getSessionUser } from "./lib/session";
import { ensureCommunitySchema } from "./lib/community-schema";
import { ensureFilesSchema } from "./lib/files-schema";
import { ensureRecoverySecretSchema } from "./lib/recovery-secret-schema";
import { ensureAccountSecurityPasswordSchema } from "./lib/account-security-password-schema";
import { ensurePinnedMessageSchema } from "./lib/pinned-message-schema";
import { ensureUserCustomDataSchema } from "./lib/user-custom-data-schema";
import { ensureUserBlocksSchema } from "./lib/user-blocks-schema";
import { ensureEmailVerificationSchema } from "./lib/email-verification-schema";
import { emailDeliveryConfigSummary, isEmailDeliveryConfigured } from "./lib/email-service";
import { ensureAlphaAccessKeySchema, redeemAlphaAccessKey } from "./lib/alpha-access";
import { assertRateLimit } from "./lib/rate-limit";
import { canReadFileKey } from "./lib/file-access";

// Make email configuration problems obvious in the server logs at startup.
if (!isEmailDeliveryConfigured()) {
  console.warn(
    `[email] Delivery is NOT configured (${emailDeliveryConfigSummary()}). ` +
      "Email verification and password recovery will be disabled until both values are set.",
  );
}

const app = new Hono<{ Bindings: HttpBindings }>();

// Never let an unhandled API error fall through to Hono's plain-text/HTML error page.
app.onError((error, c) => {
  const pathname = new URL(c.req.url).pathname;
  const requestId = randomUUID();
  console.error(JSON.stringify({
    event: "http.unhandled_error",
    requestId,
    method: c.req.method,
    path: pathname,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));

  if (pathname.startsWith("/api/")) {
    return c.json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: `Внутренняя ошибка API. Код запроса: ${requestId}`,
        requestId,
      },
    }, 500);
  }
  return c.text(`Internal server error. Request ID: ${requestId}`, 500);
});

// Security headers for both the app shell and API responses.
// The CSP is deliberately limited to directives that should not block the app's
// existing scripts/styles: it prevents framing, plugins and hostile base/form targets.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Permitted-Cross-Domain-Policies", "none");
  c.header("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  c.header("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");

  if (env.isProduction) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    c.header("Cache-Control", "private, no-store, max-age=0");
    c.header("Pragma", "no-cache");
  }
});

// Reject cross-site writes to the API to reduce CSRF risk. Same-origin app calls
// retain Origin and Fetch Metadata headers in browsers and Android WebView.
app.use("/api/*", async (c, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method.toUpperCase())) {
    const origin = c.req.header("origin");
    if (origin) {
      let suppliedOrigin = "";
      try {
        suppliedOrigin = new URL(origin).origin;
      } catch {
        return c.json({ error: "Invalid request origin" }, 403);
      }
      if (suppliedOrigin !== new URL(c.req.url).origin) {
        return c.json({ error: "Cross-origin request blocked" }, 403);
      }
    }
    if (c.req.header("sec-fetch-site")?.toLowerCase() === "cross-site") {
      return c.json({ error: "Cross-site request blocked" }, 403);
    }
  }
  await next();
});

app.use(bodyLimit({
  maxSize: 32 * 1024 * 1024,
  onError: (c) => c.json({
    error: {
      code: "PAYLOAD_TOO_LARGE",
      message: "Запрос превышает 32 МБ. Для вложений доступно до 20 МБ.",
    },
  }, 413),
}));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError({ error, path, type, req }) {
      const cause = error.cause instanceof Error ? error.cause : undefined;
      console.error(JSON.stringify({
        event: "trpc.error",
        procedure: path ?? "unknown",
        type: type ?? "unknown",
        method: req.method,
        requestPath: new URL(req.url).pathname,
        code: error.code,
        message: error.message,
        causeMessage: cause?.message,
        stack: error.stack,
        causeStack: cause?.stack,
      }));
    },
  });
});

// Local disk files are private and available only to signed-in users.
app.get("/api/files/*", async (c) => {
  const token = getSessionToken(c.req.raw.headers);
  const user = await getSessionUser(token);
  if (!user) return c.json({ error: "Authentication required" }, 401);
  let key: string;
  try {
    key = new URL(c.req.url).pathname.slice("/api/files/".length).split("/").map(decodeURIComponent).join("/");
    if (!(await canReadFileKey(key, user.id))) {
      // Use 404 for both unknown and unauthorized keys to avoid key enumeration.
      return c.json({ error: "File not found" }, 404);
    }
    const meta = await storage.headFile({ fileKey: key });
    const bytes = await storage.readFile({ fileKey: key });
    const headers = new Headers({
      "Content-Type": meta.contentType,
      "Content-Length": String(meta.size),
      // This endpoint serves private or shared media; never keep bytes in a shared browser cache.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    if (c.req.query("download") === "1") {
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(meta.fileName || "file")}`);
    }
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    // Avoid serving uploaded HTML/SVG as an executable same-origin document.
    if (["text/html", "application/xhtml+xml", "image/svg+xml"].includes(meta.contentType)) {
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(meta.fileName || "file")}`);
    }
    return new Response(body, { status: 200, headers });
  } catch (error) {
    if (error instanceof StorageError && error.code === "STORAGE_OBJECT_NOT_FOUND") {
      return c.json({ error: "File not found" }, 404);
    }
    if (error instanceof StorageError && error.code === "STORAGE_INVALID_INPUT") {
      return c.json({ error: "Invalid file key" }, 400);
    }

    // Distinguish a temporary storage/network failure from a file that is truly gone.
    if (env.isProduction) console.warn("File request failed", error instanceof Error ? error.message : String(error));
    c.header("Cache-Control", "no-store");
    c.header("Retry-After", "5");
    return c.json({ error: "File storage is temporarily unavailable" }, 503);
  }
});

const ALPHA_DOWNLOAD_URL = "https://github.com/smirnaginegor426-arch/telechatYou/releases/download/v2.0-alpha/TeleChatYouAlpha.apk";

app.post("/api/alpha/redeem", async (c) => {
  c.header("Cache-Control", "no-store");

  const clientHint =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  try {
    assertRateLimit(`alpha-key-redeem:${clientHint}`, 10, 10 * 60 * 1000);
  } catch {
    return c.json(
      { ok: false, code: "RATE_LIMITED", error: "Слишком много попыток. Попробуй позже." },
      429,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, code: "INVALID", error: "Введи ключ доступа." }, 400);
  }

  const rawKey =
    body && typeof body === "object" && "key" in body
      ? (body as { key?: unknown }).key
      : undefined;
  if (typeof rawKey !== "string" || rawKey.trim().length < 12 || rawKey.length > 64) {
    return c.json({ ok: false, code: "INVALID", error: "Неверный ключ. Проверь его и попробуй снова." }, 400);
  }

  try {
    const redemption = await redeemAlphaAccessKey(rawKey);
    if (redemption === "accepted") {
      return c.json({ ok: true, downloadUrl: ALPHA_DOWNLOAD_URL });
    }
    if (redemption === "used") {
      return c.json(
        { ok: false, code: "USED", error: "Этот ключ уже использован." },
        409,
      );
    }
    return c.json(
      { ok: false, code: "INVALID", error: "Неверный ключ. Проверь его и попробуй снова." },
      400,
    );
  } catch (error) {
    console.warn(
      "[alpha-access] Key redemption failed",
      error instanceof Error ? error.message : String(error),
    );
    return c.json(
      { ok: false, code: "UNAVAILABLE", error: "Не удалось проверить ключ. Попробуй позже." },
      503,
    );
  }
});

app.all("/api/*", (c) => c.json({
  error: { code: "NOT_FOUND", message: "API endpoint not found" },
}, 404));

if (env.isProduction) {
  await ensureCommunitySchema();
  await ensureFilesSchema();
  await ensureRecoverySecretSchema();
  await ensureAccountSecurityPasswordSchema();
  await ensurePinnedMessageSchema();
  await ensureUserCustomDataSchema();
  await ensureUserBlocksSchema();
  await ensureEmailVerificationSchema();
  await ensureAlphaAccessKeySchema();
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);
  const port = parseInt(process.env.PORT || "3000", 10);
  serve({ fetch: app.fetch, port }, () => console.log(`Server running on http://localhost:${port}/`));
}

export default app;
