/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";
import { fileURLToPath, URL } from "node:url";
import { themeToCss } from "./src/themes/css.ts";

/** Serves the compiled theme tokens as a virtual CSS module. */
function themeCss(): Plugin {
  const id = "virtual:learivo-theme.css";
  return {
    name: "learivo-theme-css",
    resolveId: (source) => (source === id ? "\0" + id : null),
    load: (loaded) => (loaded === "\0" + id ? themeToCss() : null),
  };
}

/**
 * Writes asset-manifest.json: the list of every file in this build. The service worker caches
 * them all when it installs, so the whole app opens offline.
 */
function assetManifest(): Plugin {
  return {
    name: "learivo-asset-manifest",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = [
        "/",
        "/manifest.webmanifest",
        "/favicon.svg",
        "/icon-192.png",
        "/icon-512.png",
        "/apple-touch-icon.png",
        ...Object.keys(bundle).map((name) => `/${name}`),
      ];
      const build = createHash("sha256")
        .update(files.join("\n") + Object.keys(bundle).join())
        .digest("hex")
        .slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "asset-manifest.json",
        source: JSON.stringify({ build, files }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), themeCss(), assetManifest()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely, so keeping them in their own files lets the browser (and the
        // offline cache) reuse them when only the app's own code changes.
        codeSplitting: {
          groups: [
            { name: "supabase", test: /node_modules[\\/]@supabase/ },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
