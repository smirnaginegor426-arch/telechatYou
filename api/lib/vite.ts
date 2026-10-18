import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { getSessionToken, getSessionUser } from "./session";
import { isPrivateExperimentalUser } from "./experimental-access";

type App = Hono<{ Bindings: HttpBindings }>;

/** The current application. */
const CURRENT_SHELL = "index.html";
/** The frozen 10 Oct 2026 build, compiled by legacy/vite.config.ts. */
const LEGACY_SHELL = path.join("legacy", "index.html");

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  const readShell = (relative: string): string | null => {
    const absolute = path.resolve(distPath, relative);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf-8") : null;
  };

  /**
   * Two applications ship in this build. Only the private experimental account
   * receives the current one; every other account — including visitors who are
   * not signed in — receives the original build. The legacy bundle is missing
   * (for example during `vite dev`) the current shell is served instead.
   */
  const shellFor = async (headers: Headers): Promise<string | null> => {
    const user = await getSessionUser(getSessionToken(headers));
    const experimental = isPrivateExperimentalUser(user);
    const preferred = experimental ? CURRENT_SHELL : LEGACY_SHELL;
    return readShell(preferred) ?? readShell(CURRENT_SHELL);
  };

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
