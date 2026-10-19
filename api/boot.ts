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
import { ensureRecoverySecretSchema } from "./lib/recovery-secret-schema";
import { ensureAccountSecurityPasswordSchema } from "./lib/account-security-password-schema";
import { ensurePinnedMessageSchema } from "./lib/pinned-message-schema";
import { ensureUserCustomDataSchema } from "./lib/user-custom-data-schema";
import { ensureUserBlocksSchema } from "./lib/user-blocks-schema";
import { ensureEmailVerificationSchema } from "./lib/email-verification-schema";
import { emailDeliveryConfigSummary, isEmailDeliveryConfigured } from "./lib/email-service";

// Make email configuration problems obvious in the server logs at startup.
if (!isEmailDeliveryConfigured()) {
  console.warn(
    `[email] Delivery is NOT configured (${emailDeliveryConfigSummary()}). ` +
      "Email verification and password recovery will be disabled until both values are set.",
  );
}

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 32 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
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
    const meta = await storage.headFile({ fileKey: key });
    const bytes = await storage.readFile({ fileKey: key });
    const headers = new Headers({
      "Content-Type": meta.contentType,
      "Content-Length": String(meta.size),
      // Uploads receive unique keys, so successful file responses are safe to cache across route changes.
      "Cache-Control": "private, max-age=86400, immutable",
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

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

if (env.isProduction) {
  await ensureCommunitySchema();
  await ensureRecoverySecretSchema();
  await ensureAccountSecurityPasswordSchema();
  await ensurePinnedMessageSchema();
  await ensureUserCustomDataSchema();
  await ensureUserBlocksSchema();
  await ensureEmailVerificationSchema();
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);
  const port = parseInt(process.env.PORT || "3000", 10);
  serve({ fetch: app.fetch, port }, () => console.log(`Server running on http://localhost:${port}/`));
}

export default app;
