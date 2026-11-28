# Where things live

A map of `src/`. Find what you want to change, then edit that one place.

## Layers (enforced by lint)

```
core, motion   <   ui-kit, auth, help, landing   <   modules   <   platform, account   <   shell
```

A folder may only import from layers to its left. `pnpm lint` fails if a lower layer reaches up
(for example `ui-kit` importing `shell`). Tests are exempt. The rule is in `eslint.config.js`.

| Folder      | What it is                                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`     | No UI. Config, Supabase client, monitoring, `createStore`, toast, intents, focus mode, dialog open/close stores, backup reminder rule                                                                                               |
| `motion/`   | All animation: tokens, CSS, origin morph, grow-in                                                                                                                                                                                   |
| `ui-kit/`   | Presentational building blocks. `primitives/`, `feedback/`, `overlays/`, `icons/`, `brand/`, `illustrations/` (empty and error scenes), `themes/`                                                                                   |
| `landing/`  | The introduction page signed-out visitors see first (its own chunk; may import core, motion, ui-kit)                                                                                                                                |
| `auth/`     | Sign-in screen and auth provider                                                                                                                                                                                                    |
| `help/`     | The "All features" list, its icons and data                                                                                                                                                                                         |
| `modules/`  | The features: `question-bank`, `practice`, `workspace` (home, review, insights), `ai`, `profile`, `data`, `notifications` (settings screen and invitation). Each has `domain/` (rules, no React), `data/` (stores), `ui/` (screens) |
| `platform/` | Offline cache, background sync, installable-app code. Wraps the feature stores                                                                                                                                                      |
| `account/`  | Account menu, profile, settings, data and backup dialogs                                                                                                                                                                            |
| `shell/`    | The app skeleton: `AppShell`, `AppFrame`, `ModuleHost`, `Gates`, `navigation/`, `chrome/`                                                                                                                                           |
| `styles/`   | `index.css` loads `theme`, motion, `base`, `components`                                                                                                                                                                             |
| `testing/`  | Test fakes and fixtures                                                                                                                                                                                                             |

## "I want to change..."

| Change                                                     | Edit                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Sidebar, top bar, bottom bar, content width and spacing    | `shell/AppFrame.tsx` (layout only, no data)                           |
| Which screen shows for a tab, and the providers around it  | `shell/ModuleHost.tsx`                                                |
| The five tabs, their order and routes                      | `shell/navigation/registry.ts`                                        |
| Tab bar look and sliding highlight                         | `shell/navigation/BottomNav.tsx`                                      |
| Loading, sign-in or app, and wiring the services           | `shell/AppShell.tsx`                                                  |
| Toast look                                                 | `shell/chrome/ToastHost.tsx`                                          |
| How fast or bouncy anything is                             | `motion/tokens.ts` (single source)                                    |
| Keyframes, loaders, reduced-motion rules                   | `motion/motion.css`                                                   |
| Panels growing out of the tapped control                   | `motion/origin.ts`                                                    |
| Colours, fonts, radius, shadows per theme                  | `ui-kit/themes/<theme>/tokens.ts`                                     |
| Buttons, cards, inputs, focus ring                         | `styles/components.css`, `styles/base.css`                            |
| Dialog, Picker, Segmented, Button, Field and so on         | `ui-kit/` (import from `ui-kit/index.ts`)                             |
| Backup file format and restore                             | `account/backup/backupData.ts`                                        |
| Empty-state and error pictures                             | `ui-kit/illustrations/Scenes.tsx`                                     |
| The AI prompt text                                         | `modules/question-bank/domain/promptBuilder.ts`                       |
| Social preview, app icons, logo files, install screenshots | `scripts/brand.mjs`, `scripts/pwa-shots.mjs` (then commit the images) |

## Rules of thumb

- `tokens.ts` is the single source for motion. The build turns it into `--lv-m-*` CSS variables
  and a test fails if the CSS uses one that does not exist. Do not write a raw `cubic-bezier(...)`
  or millisecond value in a component; use a `lv-t-*` helper class or `MOTION`.
- Domain code never imports React or Supabase.
- Global "is it open" or "which one" values use `core/store.ts` (`createStore`), not hand-rolled
  listeners.
- Big screens are split into a thin screen plus parts: Questions uses `ui/parts/` (FilterBar, BulkBar, useQuestionPages); Practice is a router plus `PracticeHome` and `practiceSetup`; Review, Home and Insights keep side pieces in `ReviewParts`, `HomeParts` and `InsightsCharts`.
- A screen composes parts. If a screen grows past about 250 lines, move its pieces to the
  feature's `ui/parts/`.

## Other

- `src/modules/focus/`: Focus Timer and Study dashboard. `domain/engine.ts` (timestamp timer, no UI), `controller.ts` (active timer, recovery, saving), `stats.ts`, `settings.ts`; `data/` (repo interface, Supabase and in-memory); `ui/` (Study screen, timer, stats, history, settings, floating pill). `src/modules/games/` is the Mini games area (`registry.tsx` lists the games, `tictactoe/` is the first playable game and the example to copy, `penalty/` is the second (turn-based with CSS animation), `cricket/` is the third and the biggest (`engine.ts` state machine, `fielding.ts` outcomes, `timing.ts`, `shot.ts`, `match.ts`, `config.ts` all tuning numbers, `render.ts` canvas drawing, `audio.ts` synthesized sound, `storage.ts`), `types.ts` is the contract a playable game follows; read `docs/GAMES.md` before adding one); `src/ui-kit/layout/` holds PageHeader and Tile; `src/core/hash.ts` reads the page address for sub-pages. `ui/FlipClock.tsx` and `flip.css` are the full-screen flip clock.
- `supabase/functions/push/`: the push notification server (Deno Edge Function: `index.ts` routes, `coach.ts` decisions, `messages.ts` wording, `webpush.ts` encryption). Its pure files are unit tested from `src/modules/notifications/server/`. `src/core/push.ts` is the phone side (permission, subscribe).
- `supabase/migrations/`: database changes. `scripts/`: smoke test, browser checks and brand image builders. `docs/`: see the table in the README. `public/`: static files served as they are (`social/`, `brand/`, `pwa/`; never `public/assets/`, which the build uses for hashed files that are cached for a year).
