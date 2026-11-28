# Mini games: design and how to build one

This file is the single source of truth for the Mini games area. It is written so a developer or an AI assistant can add a game without asking anyone. Read sections 1 to 4 first, then follow section 6.

## 1. Where it lives

| Thing                | Place                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| List of games        | `src/modules/games/registry.tsx` (`GAMES`, `GROUPS`)                                                                                            |
| Hub and list screens | `src/modules/games/GamesScreen.tsx`                                                                                                             |
| Shared types         | `src/modules/games/types.ts` (`GameProps`, `GameResult`)                                                                                        |
| Tests                | `src/modules/games/Games.test.tsx`                                                                                                              |
| Route                | `#/games` (hub), `#/games/brain`, `#/games/break`                                                                                               |
| Module registration  | `src/shell/navigation/registry.ts` (`id: "games"`, `navParent: "home"`, not in the bottom bar; reached from the Home tile and the feature list) |

A game with `status: "soon"` shows a dimmed tile that says **Coming soon** and cannot be tapped. Nothing fake is playable. A game is only `ready` when it really plays and has tests. **Ready today: Tic-tac-toe** (`src/modules/games/tictactoe/`) and **Penalty shootout** (`src/modules/games/penalty/`). Tic-tac-toe is the working example to copy: `rules.ts` (pure rules and the bot, no React), `rules.test.ts`, `TicTacToe.tsx` (the screen) and `TicTacToe.test.tsx`.

## 2. The two groups

- **Brain Gym** (`group: "brain"`): study games. They are built from the student's own questions, flashcards and glossary. A finished round counts as study time and may count toward the daily goal and streak.
- **Break Room** (`group: "break"`): entertainment. They never read the question bank, never write attempts, never touch the streak or the daily goal. They exist to rest the head between sessions.

Keep this split strict. A study game that does not use the student's content belongs in Break Room; a fun game must never be counted as study.

## 3. Rules every game follows

0. **Full screen.** `GamesScreen` already calls `useRequestFocus()` (from `src/core/focus.ts`), so on a phone the tab bar and top bar are hidden for every page under `#/games`. A game must therefore bring its own Back button (`PageHeader` with `onBack`, as the existing games do) and must not assume the tab bar is there. Leave a margin at the bottom for the phone's gesture bar.

1. **Private and offline-friendly.** A game must run with no network. Brain Gym reads data the app already has in memory or in the offline store; it adds no new server calls.
2. **Text only.** No image-based features (a standing product rule). Draw with CSS, SVG or canvas shapes and text. Do not use pictures of anatomy or any uploaded image.
3. **No invented pressure.** No fake timers that punish, no "only 2 left!" tricks. A timer is part of the game only when the tile says so (Speed round).
4. **Accessible.** 44 px tap targets, keyboard play where the game allows it, a visible focus ring, all text meets contrast in all six theme/mode combinations (default, forest, space, AMOLED; light and dark), and `prefers-reduced-motion` turns animation down. The `a11y` and `design` scripts in `scripts/` must pass with the game open.
5. **Phone first.** 360 px wide, one hand, no sideways scroll. Landscape is a bonus.
6. **Same bones.** Use `PageHeader` (with Back), `Tile`, `Button` and the colours from `src/ui-kit`. Do not add a new colour or a new button style.
7. **Pause-safe.** Leaving the tab or locking the phone must not end a round unfairly. Use timestamps, not tick counting (see `src/modules/focus/domain/engine.ts` for the pattern).
8. **No secrets, no keys, no third-party scripts.** Games are plain React code in this repo.

## 4. Data a game may use

Only through the existing providers, never by calling Supabase directly (the layer rules in `eslint.config.js` enforce this):

- Questions: `useBank()` from `src/modules/question-bank/ui/bank.tsx`. `QuestionRepo.list`, `getMany` and `get` give `QuestionRecord`s (stem, options, explanation, path, tags, type).
- Flashcards and glossary: `useWorkspace()` from `src/modules/workspace/ui/workspace.tsx` (`flashcards()`, `glossary()`).
- Weak topics: `useInsightsData` / `src/modules/workspace/domain/insights.ts`.
- Attempts (Brain Gym only, when it should count): `usePractice()` and `AttemptRepo` in `src/modules/practice`. Reuse the existing grading helpers in `practice/domain/grading.ts` so marks and percentages match the rest of the app.

A game module may import from other modules (the layer rules allow modules to import modules) but not from `shell`, `platform` or `account`.

## 5. The idea list

Every game below has a one-line idea, the data it needs and a rough size (S = a day, M = a few days). Items marked **first** are the recommended build order.

### Brain Gym (study)

| Id         | Name                | Idea                                                                   | Data needed            | Size         |
| ---------- | ------------------- | ---------------------------------------------------------------------- | ---------------------- | ------------ |
| `speed`    | Speed round         | 60 seconds, as many answers as possible, score = right answers         | questions              | S, **first** |
| `streak`   | Streak run          | Questions until the first mistake; best streak is saved                | questions              | S, **first** |
| `boss`     | Weak spot boss      | The weakest topic has a health bar; each right answer hurts it         | questions, weak topics | M            |
| `match`    | Match pairs         | Match terms to meanings (glossary or flashcards) against the clock     | glossary / cards       | S, **first** |
| `blitz`    | True or false blitz | Swipe or tap true/false on statements made from true/false questions   | T/F questions          | S            |
| `gap`      | Fill the gap        | A sentence from an explanation with one key term hidden, pick the term | explanations, glossary | M            |
| `scramble` | Word scramble       | Unscramble a glossary term, with its meaning as the hint               | glossary               | S            |
| `daily`    | Daily five          | Five questions a day, one try each, same for the whole day             | questions              | M            |

More ideas, not yet in the list: Odd one out (three terms from one topic and one from another), Order the steps (put a process in order), Elimination duel (remove wrong options before answering), Flash sprint (race through due flashcards), Mnemonic maker (the student writes a mnemonic, saved to Notes).

### Break Room (entertainment)

Arcade and sports games, short rounds (one to three minutes), played with one thumb. The owner's brief: Tic-tac-toe, mini table tennis, mini cricket, penalty shootout and games of that kind. Build them as our own simple versions (our own rules, shapes and names); do not copy any other app's artwork, characters or code, and do not use a company's game or trademark by name.

| Id          | Name              | Idea                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Controls                                       | Size |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---- |
| `tictactoe` | Tic-tac-toe       | **Ready.** Easy, medium and hard (unbeatable) bot, or two players on one phone; the first move alternates each round                                                                                                                                                                                                                                                                                                                                                                        | Tap a square                                   | S    |
| `pingpong`  | Mini table tennis | Ready. Vs Computer (Easy, Normal, Hard, Expert), 2 Players on one phone (lower half is player 1, upper half is player 2, the top score bar is upside down so the player facing you can read it), Practice against a wall. First to 5, 7, 11 or 21, win by two, deuce, single set or best of 3 or 5. The ball speeds up each hit; hit the middle of the paddle for a perfect hit, move fast for a smash. Sound, volume, vibration, sensitivity, three table colours, statistics on the phone | Drag the paddle (arrows and A/D on a keyboard) | L    |
| `cricket`   | Mini cricket      | Ready. One tap swings; timing (PERFECT 80 ms, GOOD 160, AVERAGE 250, POOR) sets power, early goes left, late goes right and a tap on the left or right side of the screen aims a little. Fielders chase, catch or stop the ball; runs come from distance, never from a dice roll. Modes: Quick Play, 6-Ball, 10-Wicket, Target Chase. Easy, Medium, Hard. Sound, vibration, pause, best score per mode kept on the phone                                                                    | Tap anywhere (or Space) to swing               | L    |
| `penalty`   | Penalty shootout  | Five kicks each against a keeper who dives; choose a corner and power                                                                                                                                                                                                                                                                                                                                                                                                                       | Swipe to aim and shoot                         | M    |
| `hoops`     | Basket shots      | Flick the ball into the hoop in 30 seconds; the hoop moves as the score grows                                                                                                                                                                                                                                                                                                                                                                                                               | Flick                                          | M    |
| `snake`     | Snake             | The classic; eat, grow, do not bite yourself                                                                                                                                                                                                                                                                                                                                                                                                                                                | Swipe                                          | M    |
| `memory`    | Memory match      | Flip cards and find pairs (symbols and letters, no images)                                                                                                                                                                                                                                                                                                                                                                                                                                  | Tap                                            | S    |
| `calm`      | Breathing break   | One calm minute: a circle grows and shrinks, follow it                                                                                                                                                                                                                                                                                                                                                                                                                                      | None                                           | S    |

Build order suggestion: Tic-tac-toe, Penalty shootout, Mini cricket and Mini table tennis are done. Penalty shootout shows a turn-based way to do "sports": rules and dice are pure functions with an injected random source (`rules.ts`), the animation is CSS only (no game loop). Mini cricket is the real-time example: `cricket/engine.ts` is a state machine (ready, bowling, swung, play, result, paused, over) driven by a clock and a dice function that tests pass in, so it needs no screen; `cricket/fielding.ts` decides the outcome of a shot from where the ball goes and who can reach it; `cricket/render.ts` only draws a `View` on a canvas (with a camera that zooms in while the ball is coming); all tuning numbers are in `cricket/config.ts`. Mini table tennis is the second real-time example: `pingpong/game.ts` is a state machine (idle, countdown, serve, rally, point, paused, setComplete, matchComplete, restarting) that runs the physics in fixed 1/120 s steps from whatever time the screen gives it, so the frame rate never changes the game; `physics.ts` (continuous collision, so the ball cannot pass a paddle), `scoring.ts`, `ai.ts` (reaction delay, prediction, placement, mistakes: levels differ in skill, not in ball speed), `controls.ts` (which finger owns which paddle) are all pure and tested; `render.ts` only draws a `View`. Each of them is a template for the next real-time game, so a shared loop was not needed. They need a small shared game loop (a `requestAnimationFrame` loop that uses timestamps, with a pause when the tab is hidden); write it once in `src/modules/games/shared/` when Table tennis is built.

More ideas: Minesweeper, Simon says (repeat the pattern), Mini sudoku, Stack the tower (tap to drop blocks), Quick maths, Word guess (hidden five-letter word), Number slide (merge tiles), Reaction test (tap when the screen changes), Air hockey, Darts, Bowling, Carrom.

## 6. How to add a game (step by step)

1. **Add the manifest.** In `registry.tsx` add one entry to `GAMES` with a new unique `id` (never rename an id once it ships), `group`, `title`, a one-line `help` and an icon from `src/ui-kit`. Keep `status: "soon"` until it works. `Games.test.tsx` already checks ids are unique and that each group shows only its own games.
2. **Make the screen.** Create `src/modules/games/<id>/<Name>.tsx` with `export default function Name(props: GameProps)`. Put the rules (scoring, shuffling, win and lose) in plain TypeScript files next to it, with no React, so they can be unit tested.
3. **Routing is already built.** A running game lives at `#/games/<group>/<id>`. `GamesScreen.tsx` finds the game in `GAMES`; when it is `ready` and has a `load`, it opens it lazily (its own chunk) and passes `GameProps` (`onExit`, `onFinish`). You do not edit `GamesScreen.tsx`.
4. **Make it ready.** In your `registry.tsx` entry set `status: "ready"` and `load: () => import("./<id>/<Name>.tsx")`. The tile becomes tappable by itself.
5. **Finish a round.** Call `onFinish(result)` exactly once, then show the game's own result screen with Play again and Back to games.
6. **Test.** Unit tests for the rules (include a test that fails when the scoring is broken: change the rule, watch the test fail, change it back). A component test that plays one round with `MemoryRepo` data. Add the game's route to the `routes` lists in `scripts/a11y.mjs` and `scripts/design.mjs`.
7. **Run the full set:** `pnpm format; pnpm typecheck; pnpm lint; pnpm test; pnpm build; pnpm e2e; pnpm a11y; pnpm design; pnpm envcheck; pnpm paper`.
8. **Update the docs in the same commit:** set the game to ready in section 5, add a line to `docs/FEATURES.md` and `docs/STATUS.md`.

## 7. Saving scores (not built yet)

Nothing is saved today. When the first game ships, scores should be stored per student, never shared:

- Local first: keep best score and last played per `gameId` in the existing offline store, so it works with no network.
- Sync: a new table `game_scores (user_id, game_id, best_score, plays, updated_at)` with row security "own rows only", added as an additive migration listed in `docs/MIGRATIONS.md`. Do not change existing tables. Do not apply a migration to the live project without the owner's go-ahead.
- Brain Gym rounds that should count as study time can be saved as a Focus session (`focus_sessions`, kind `custom`) so Progress shows them with the rest.

## 8. Things to avoid

- Playable-looking tiles for games that do not exist.
- Leaderboards against other people (the app is private, single student).
- Streak or daily-goal credit from Break Room games.
- Sound as the only feedback; if sound is added it must be off by default and respect the phone's silent mode.
- Adding a game that needs a new library. Prefer plain React and CSS.

## 9. Mini table tennis: design decisions

Built from the owner's PDF brief (2026-11-28). Short log of the choices:

- **Own look, own code.** The reference game was only a concept; nothing is copied. Top-down table, rounded shapes, three colour themes (Midnight, Forest, Sunset).
- **Fixed-step physics** (`PHYSICS.step`, 1/120 s) with continuous collision on the paddle line, so a fast ball never tunnels. A long freeze (hidden tab) is cut short (`maxSteps`), never replayed.
- **Every tuning number is in `pingpong/config.ts`** (paddle size, ball speed and gain, angles, spin, AI levels, flow times, themes). Change there, not in the engine.
- **Skill, not luck:** where the ball meets the paddle sets the angle, a moving paddle adds sideways speed and spin, the middle is a perfect hit (faster), a fast paddle is a smash. The ball speeds up each hit up to `maxSpeed` so a long rally gets exciting but stays readable.
- **AI levels differ in reaction delay, prediction, movement speed, aiming error, mistake chance and placement**, never only in ball speed. A test plays the levels against each other and a stronger level must beat a weaker one.
- **Touch ownership:** in a 2 Players match a finger takes the paddle of the half it lands in and keeps it until it lifts or the touch is cancelled, so fingers cannot cross over or fight. Pause, a hidden tab or a lost window releases every finger.
- **Practice** is a wall instead of an opponent: no score, a rally counter and the best rally.
- **Ideas added beyond the brief:** the opponent's score bar is upside down in 2 Players, a ball speed bar, a spin mark on the ball, a tint of the end where a point was won, a rally number that grows behind the ball, a smash shake, statistics (record per level, longest rally, hits, perfect hits, smashes, time).
- **Not built (kept out on purpose):** Tournament, Endless and Time Attack modes (the three modes already cover play and practice), unlockable cosmetics, achievements, network play. They need a save format decision first.
