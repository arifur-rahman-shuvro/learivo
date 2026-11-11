/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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

export default defineConfig({
  plugins: [react(), tailwindcss(), themeCss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
