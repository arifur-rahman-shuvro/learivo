# Learivo design system and theme architecture

Code lives in `src/ui-kit/themes/` and `src/ui-kit/`. The Design Lab (`src/App.tsx`) shows every core component in the active theme.

## Principles

1. Components use semantic tokens only, never raw colours.
2. A theme is data plus a few visual slots. It is not a colour swap.
3. Accessibility is enforced by tests, not by review alone.
4. Motion has a purpose, respects `prefers-reduced-motion`, and can be turned off with Low effects.
5. Mobile is designed first: 44px minimum touch targets, thumb-reach navigation.

## Token layers

| Layer             | Examples                                                                                                                                           | Where                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Colour tokens     | `bg`, `surface1-3`, `text`, `textMuted`, `accent`, `accentContrast`, `border`, `borderStrong`, `focus`, `success`, `warning`, `danger`, `chart1-4` | `ThemeTokenSet.colors`              |
| Style tokens      | fonts, radii, shadows, button shadows, surface texture, page background, progress-ring cap and glow, motion durations and easing                   | `ThemeTokenSet.style`               |
| Component classes | `.lv-card`, `.lv-btn-*`, `.lv-input` in `src/styles/`                                                                                              | combine tokens into component looks |

Tokens compile to CSS custom properties named `--lv-<kebab-name>` under `[data-theme="<id>"][data-mode="<mode>"]` (see `src/ui-kit/themes/css.ts`). Tailwind utilities such as `bg-surface-1`, `text-muted` and `rounded-card` map to those variables in `src/styles/`.

## Theme registry

`src/ui-kit/themes/registry.ts` lists every theme. Adding a theme:

1. Create `src/ui-kit/themes/<id>/tokens.ts` exporting a `ThemeDefinition` (at least one mode).
2. Add the id to `ThemeId` in `src/ui-kit/themes/types.ts`.
3. Register it in `registry.ts`.
4. Add its slots (background, loader, empty-state art) in `src/ui-kit/themes/slots.tsx`.
5. Run `pnpm test`. The contrast and key-consistency tests cover the new theme automatically.

A mode a theme does not support falls back to its default mode (Space is dark only).

## Slots (structural differences)

| Slot            | Default                               | Forest                        | Space                          |
| --------------- | ------------------------------------- | ----------------------------- | ------------------------------ |
| Background      | gradient mesh (page background token) | tree line and drifting leaves | starfield, orbit rings, planet |
| Loader          | spinning ring                         | swaying sprout                | orbiting node                  |
| Empty-state art | card with check                       | sprout                        | planet with ring               |

The per-theme empty-state art is the fallback. The common empty and error screens use the shared scenes in `src/ui-kit/illustrations/Scenes.tsx` (questions, caught up, insights, search, saved, exams, cards, error). They are drawn only with `var(--lv-*)` colours, so they recolour in every theme, are `aria-hidden`, and are passed to `EmptyState` through its `art` prop.

## The three themes

|                       | Default              | Forest                                           | Space                       |
| --------------------- | -------------------- | ------------------------------------------------ | --------------------------- |
| Modes                 | light, dark          | light (parchment), dark (night forest)           | dark only                   |
| Headings and body     | Inter                | Fraunces (serif) and Nunito Sans                 | Space Grotesk               |
| Numbers               | JetBrains Mono       | JetBrains Mono                                   | JetBrains Mono              |
| Radii (control, card) | 10px, 16px           | 14px, 22px                                       | 8px, 14px                   |
| Depth                 | soft layered shadows | hard offset shadow plus soft shadow, paper grain | luminous 1px edges and glow |
| Progress ring         | round cap            | round cap                                        | flat cap with glow          |
| Motion                | 120ms and 220ms      | 160ms and 320ms (slower, organic)                | 100ms and 200ms (snappy)    |

Fonts are self-hosted Latin-only variable files in `src/ui-kit/themes/fonts/` (loaded by `fonts.css`), so they work offline and call no third-party server. Bangla text falls back to the system font.

## Accessibility rules (enforced in `src/ui-kit/themes/themes.test.ts`)

For every theme and mode:

- Body text at least 4.5:1 on bg and all three surfaces.
- Muted text at least 4.5:1 on bg, surface1 and surface2.
- Text on accent at least 4.5:1; accent at least 3:1 on bg and surface1.
- Control borders and focus ring at least 3:1.
- Status colours at least 4.5:1 as text on surface1; chart colours at least 3:1.

Also: visible focus ring on all interactive elements, labelled inputs with linked hints and errors, `role="progressbar"` with values, and 44px touch targets.

Also checked in a real browser by `pnpm a11y` and `pnpm design` (axe, tap targets, focus return). Not verified: screen-reader behaviour and contrast of text placed on gradient or textured backgrounds.

## Brand

- Mark: an L whose upright stroke is a notched bookmark ribbon, with a node dot suggesting a learning path. Code-generated SVG in `src/ui-kit/brand/Logo.tsx` and `public/favicon.svg`.
- Icons: a small custom stroke icon set in `src/ui-kit/icons/icons.tsx` (stroke width adjustable per theme with `--lv-icon-stroke`).
- Brand files: `public/favicon.svg`, app icons (`icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon`), `public/brand/` (mark, lockup, 240 px logo), `public/social/og-default.png` and `docs/brand/github-social-preview.png`. They are built by `scripts/brand.mjs`; do not edit them by hand.
- Art direction for any new picture: flat shapes, 1.75 px round-cap line, theme colours only, no gradients (except the icon tile), no text, people, photos or clinical imagery. See `docs/reports/`.

## Persistence

Theme and mode are stored in `localStorage` (`learivo.theme`, `learivo.mode`) and applied before first paint by `public/theme-init.js`. The choice is not saved to the account.
