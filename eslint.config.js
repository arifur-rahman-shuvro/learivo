import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * Layering: a folder may only import from the layers listed for it. Lower layers never reach up.
 *   core, motion  <  ui-kit, auth, help, landing  <  modules  <  platform, account  <  shell
 * Tests are exempt. See docs/STRUCTURE.md.
 */
const LAYERS = [
  "core",
  "motion",
  "ui-kit",
  "platform",
  "auth",
  "landing",
  "help",
  "modules",
  "account",
  "shell",
];
const MAY_IMPORT = {
  core: [],
  motion: ["core"],
  "ui-kit": ["core", "motion"],
  platform: ["core", "modules"],
  auth: ["core", "motion", "ui-kit"],
  landing: ["core", "motion", "ui-kit"],
  help: ["core", "motion", "ui-kit"],
  modules: ["core", "motion", "ui-kit", "help", "auth"],
  account: ["core", "motion", "ui-kit", "platform", "help", "auth", "modules"],
  shell: LAYERS,
};
const layerRules = LAYERS.map((layer) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  ignores: ["**/*.test.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: LAYERS.filter((l) => l !== layer && !MAY_IMPORT[layer].includes(l)).map((l) => ({
          group: [`**/${l}`, `**/${l}/**`],
          message: `"${layer}" may not import from "${l}" (see docs/STRUCTURE.md, layering).`,
        })),
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ["dist", "node_modules", "backend", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["scripts/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  { files: ["public/theme-init.js"], languageOptions: { globals: { ...globals.browser } } },
  { files: ["public/sw.js"], languageOptions: { globals: { ...globals.serviceworker } } },
  ...layerRules,
  prettier,
);
