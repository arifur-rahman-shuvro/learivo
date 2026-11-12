# Learivo design system and theme architecture

Status: Phase 2. Code lives in `src/themes/` and `src/design-system/`. Run `pnpm dev` and open the Design Lab to see every component in the active theme.

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
| Component classes | `.lv-card`, `.lv-btn-*`, `.lv-input` in `src/app.css`                                                                                              | combine tokens into component looks |

Tokens compile to CSS custom properties named `--lv-<kebab-name>` under `[data-theme="<id>"][data-mode="<mode>"]` (see `src/themes/css.ts`). Tailwind utilities such as `bg-surface-1`, `text-muted` and `rounded-card` map to those variables in `src/app.css`.

## Theme registry

`src/themes/registry.ts` lists every theme. Adding a theme:

1. Create `src/themes/<id>/tokens.ts` exporting a `ThemeDefinition` (at least one mode).
2. Add the id to `ThemeId` in `src/themes/types.ts`.
3. Register it in `registry.ts`.
4. Add its slots (background, loader, empty-state art) in `src/themes/slots.tsx`.
5. Run `pnpm test`. The contrast and key-consistency tests cover the new theme automatically.

A mode a theme does not support falls back to its default mode (Space is dark only).

## Slots (structural differences)

| Slot            | Default                               | Forest                        | Space                          |
| --------------- | ------------------------------------- | ----------------------------- | ------------------------------ |
| Background      | gradient mesh (page background token) | tree line and drifting leaves | starfield, orbit rings, planet |
| Loader          | spinning ring                         | swaying sprout                | orbiting node                  |
| Empty-state art | card with check                       | sprout                        | planet with ring               |

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

Fonts are self-hosted through `@fontsource-variable/*` packages, so they work offline and do not call third-party servers.

## Accessibility rules (enforced in `src/themes/themes.test.ts`)

For every theme and mode:

- Body text at least 4.5:1 on bg and all three surfaces.
- Muted text at least 4.5:1 on bg, surface1 and surface2.
- Text on accent at least 4.5:1; accent at least 3:1 on bg and surface1.
- Control borders and focus ring at least 3:1.
- Status colours at least 4.5:1 as text on surface1; chart colours at least 3:1.

Also: visible focus ring on all interactive elements, labelled inputs with linked hints and errors, `role="progressbar"` with values, and 44px touch targets.

Not yet verified: screen-reader behaviour, full keyboard flows, and contrast of text placed on gradient or textured backgrounds. These are covered in Phase 8.

## Brand

- Mark: an L whose upright stroke is a notched bookmark ribbon, with a node dot suggesting a learning path. Code-generated SVG in `src/design-system/Logo.tsx` and `public/favicon.svg`.
- Icons: a small custom stroke icon set in `src/design-system/icons.tsx` (stroke width adjustable per theme with `--lv-icon-stroke`).
- Known gap: the mark reads well as a favicon but the node-and-foot arrangement can look face-like on the app-icon tile. A refinement pass is scheduled for Phase 7.

## Persistence

Theme and mode are stored in `localStorage` (`learivo.theme`, `learivo.mode`) and applied before first paint by an inline script in `index.html`. Cloud persistence in `user_preferences` arrives in Phase 3 so the choice follows the student across devices.
