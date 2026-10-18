import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";

/**
 * The original TeleChat You build (10 Oct 2026).
 *
 * It is compiled into dist/public/legacy and served to every account except the
 * private experimental one (see api/lib/vite.ts). The sources in ./src are
 * frozen: they are a snapshot of the first shipped version, so they are built
 * without type checking and are never modernised. Only deliberate additions the
 * owner asks for go in (the system update screen); everything else keeps the
 * look and behaviour of the day it shipped.
 *
 * The project is self-contained: it sets its own root, PostCSS pipeline and
 * Tailwind config so that running `vite build` from the repository root cannot
 * mix it up with the current app.
 */
const legacyRoot = import.meta.dirname;

export default defineConfig({
  root: legacyRoot,
  base: "/legacy/",
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(legacyRoot, "tailwind.config.js") }),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(legacyRoot, "src"),
    },
  },
  build: {
    outDir: path.resolve(legacyRoot, "../dist/public/legacy"),
    emptyOutDir: true,
  },
});
