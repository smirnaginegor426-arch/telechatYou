import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { getActiveAccountSlotId, getSessionToken, getSessionUser } from "./session";
import { isPrivateExperimentalUser, privateExperimentalMatch } from "./experimental-access";

type App = Hono<{ Bindings: HttpBindings }>;

/** The current application. */
const CURRENT_SHELL = "index.html";
/** The frozen 10 Oct 2026 build, compiled by legacy/vite.config.ts. */
const LEGACY_SHELL = path.join("legacy", "index.html");

/**
 * Public rollout: serve the current application to every visitor.
 * Set to false only if the legacy build needs to be restored for everyone
 * except the explicitly allowlisted account.
 */
const SERVE_CURRENT_BUILD_TO_EVERYONE = true;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  const readShell = (relative: string): string | null => {
    const absolute = path.resolve(distPath, relative);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf-8") : null;
  };

  /**
   * Two applications ship in this build. During the public rollout, every
   * visitor receives the current application. The legacy bundle remains
   * available for a deliberate rollback if needed.
   */
  const shellFor = async (headers: Headers): Promise<string | null> => {
    const experimental =
      SERVE_CURRENT_BUILD_TO_EVERYONE ||
      isPrivateExperimentalUser(await getSessionUser(getSessionToken(headers)));
    const preferred = experimental ? CURRENT_SHELL : LEGACY_SHELL;
    return readShell(preferred) ?? readShell(CURRENT_SHELL);
  };

  /**
   * Self-diagnostic for the split: says which build the caller receives and why.
   * It only ever describes the caller's own session, so it cannot expose another
   * account. Open /build-info in the browser that shows the wrong build.
   */
  app.get("/build-info", async (c) => {
    const headers = c.req.raw.headers;
    const token = getSessionToken(headers);
    const user = await getSessionUser(token);
    const matchedBy = privateExperimentalMatch(user);

    return c.json({
      build:
        SERVE_CURRENT_BUILD_TO_EVERYONE || matchedBy !== "none" ? "current" : "legacy",
      matchedBy,
      forcedForEveryone: SERVE_CURRENT_BUILD_TO_EVERYONE,
      signedIn: Boolean(user),
      userId: user?.id ?? null,
      username: user?.username ?? null,
      sessionCookieFound: Boolean(token),
      accountSwitcherActive: Boolean(getActiveAccountSlotId(headers)),
      configuredTesterId: process.env.TCY_PRIVATE_TESTER_USER_ID?.trim() || null,
      shells: {
        current: readShell(CURRENT_SHELL) !== null,
        legacy: readShell(LEGACY_SHELL) !== null,
      },
    });
  });

  // Browser navigations choose their application before static files are tried,
  // so "/" cannot leak the current shell to a non-experimental account. Every
  // HTML navigation is handled here, including /index.html, so the only way to
  // reach a shell is through the session check below.
  app.use("*", async (c, next) => {
    if (c.req.method !== "GET") return next();
    if (!(c.req.header("accept") ?? "").includes("text/html")) return next();

    const shell = await shellFor(c.req.raw.headers);
    if (!shell) return next();

    // The shell depends on who is asking, so it must never be cached.
    c.header("Cache-Control", "no-store");
    return c.html(shell);
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound(async (c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }

    const shell = await shellFor(c.req.raw.headers);
    if (!shell) return c.json({ error: "Not Found" }, 404);

    c.header("Cache-Control", "no-store");
    return c.html(shell);
  });
}
