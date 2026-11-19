# Where things live

Use this as a map. "I want to change X" points to the one place to edit.

## The app skeleton (layout)

| Change                                                              | Edit                                          |
| ------------------------------------------------------------------- | --------------------------------------------- |
| Sidebar, top bar, bottom bar, content width and spacing             | `src/app/AppFrame.tsx` (layout only, no data) |
| What the five tabs are, their order and routes                      | `src/app/registry.ts`                         |
| Tab bar look and its sliding highlight                              | `src/design-system/BottomNav.tsx`             |
| Which screen shows for a tab, and the data providers around screens | `src/app/ModuleHost.tsx`                      |
| Loading, sign-in or app, and wiring the services                    | `src/app/AppShell.tsx`                        |
| Dialogs that download only when opened (guide, backup, AI)          | `src/app/Gates.tsx`                           |

## Animation and motion

All of it is in `src/motion/`.

| Change                                                             | Edit                     |
| ------------------------------------------------------------------ | ------------------------ |
| How fast or bouncy anything is (every duration and curve)          | `src/motion/tokens.ts`   |
| Keyframes, loader animations, reduced-motion and Low-effects rules | `src/motion/motion.css`  |
| Panels growing out of the tapped control, closing back into it     | `src/motion/origin.ts`   |
| Charts and bars that grow in                                       | `src/motion/useGrown.ts` |

`tokens.ts` is the single source: the build turns it into `--lv-m-*` CSS variables, and the
script-driven animations read the same values. A test fails if the CSS uses a variable that
does not exist. Do not write a raw `cubic-bezier(...)` or millisecond value in a component;
use a `lv-t-*` helper class or `MOTION`.

## Look and feel

| Change                                                       | Edit                           |
| ------------------------------------------------------------ | ------------------------------ |
| Colours, fonts, corner radius, shadows per theme             | `src/themes/<theme>/tokens.ts` |
| Buttons, cards, inputs, focus ring                           | `src/app.css`                  |
| Shared components (Dialog, Picker, Segmented, Avatar, icons) | `src/design-system/`           |

## Features

Each feature is a folder in `src/modules/<name>/` with the same shape:
`domain/` (rules, no React), `data/` (database and in-memory stores), `ui/` (screens).
Domain code never imports React or Supabase, which keeps it easy to test.

## Other

- `src/offline/`, `src/sync/`, `src/pwa/`: offline cache, background sync, installable app.
- `src/auth/`: sign-in. `src/lib/`: small shared helpers.
- `supabase/migrations/`: database changes. `scripts/`: smoke test and checks.
