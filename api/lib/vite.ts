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
 * Roll out the frozen 10 Oct build to everyone except the approved private
 * account. Keep false so the current build is never globally exposed.
 */
const SERVE_CURRENT_BUILD_TO_EVERYONE = false;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  const readShell = (relative: string): string | null => {
    const absolute = path.resolve(distPath, relative);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf-8") : null;
  };

  /**
   * Only the server-verified private account receives the current application.
   * Everyone else, including signed-out visitors, receives the frozen legacy
   * build. Fail closed if the requested shell was not produced by the build.
   */
  const shellFor = async (headers: Headers): Promise<string | null> => {
    const experimental =
      SERVE_CURRENT_BUILD_TO_EVERYONE ||
      isPrivateExperimentalUser(await getSessionUser(getSessionToken(headers)));
    const preferred = experimental ? CURRENT_SHELL : LEGACY_SHELL;
    return readShell(preferred);
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
      privateTesterUserId: 1633623,
      shells: {
        current: readShell(CURRENT_SHELL) !== null,
        legacy: readShell(LEGACY_SHELL) !== null,
      },
    });
  });

  /**
   * A document request is decided by the shape of the path, not by the Accept
   * header. Accept used to be the classifier, but a client sending a wildcard
   * accept value (curl, a crawler, a link preview bot, an image proxy) skipped
   * the session check and was handed the current shell straight out of the
   * build output by the static handler below. Extension-less paths and *.html
   * are the documents; anything with a file extension is an asset and stays
   * static.
   */
  const isDocumentRequest = (pathname: string) => {
    if (pathname.endsWith(".html")) return true;
    return !pathname.slice(pathname.lastIndexOf("/") + 1).includes(".");
  };

  // Document requests choose their application before static files are tried,
  // so neither "/" nor "/index.html" can leak the current shell to a
  // non-experimental account: the only way to reach a shell is through the
  // session check below.
  app.use("*", async (c, next) => {
    if (c.req.method !== "GET") return next();
    if (!isDocumentRequest(new URL(c.req.url).pathname)) return next();

    const shell = await shellFor(c.req.raw.headers);
    if (!shell) {
      c.header("Cache-Control", "no-store");
      return c.text("The requested TeleChat You build is unavailable. Please try again later.", 503);
    }

    // The shell depends on who is asking, so it must never be cached.
    c.header("Cache-Control", "no-store");
    return c.html(shell);
  });

  // Vite fingerprints every asset file name, so the bundles never change under
  // the same URL. Without this header the browser and Cloudflare re-downloaded
  // ~700 KB of JS/CSS on every visit, which is what made the splash feel long.
  app.use("*", async (c, next) => {
    if (c.req.method !== "GET") return next();

    const pathname = new URL(c.req.url).pathname;
    const isBundle =
      pathname.startsWith("/assets/") || pathname.startsWith("/legacy/assets/");
    if (!isBundle) return next();

    // Only files that really exist get the long cache: a missing hashed asset
    // must stay a plain 404 instead of being remembered for a year.
    const absolute = path.resolve(distPath, "." + pathname);
    if (absolute.startsWith(distPath) && fs.existsSync(absolute)) {
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    }
    await next();
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound(async (c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }

    const shell = await shellFor(c.req.raw.headers);
    if (!shell) {
      c.header("Cache-Control", "no-store");
      return c.text("The requested TeleChat You build is unavailable. Please try again later.", 503);
    }

    c.header("Cache-Control", "no-store");
    return c.html(shell);
  });
}
