# Mini games: design and how to build one

This file is the single source of truth for the Mini games area. It is written so a developer or an AI assistant can add a game without asking anyone. Read sections 1 to 4 first, then follow section 6.

## 1. Where it lives

| Thing                | Place                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| List of games        | `src/modules/games/registry.tsx` (`GAMES`, `GROUPS`)                                                      |
| Hub and list screens | `src/modules/games/GamesScreen.tsx`                                                                       |
| Shared types         | `src/modules/games/types.ts` (`GameProps`, `GameResult`)                                                  |
| Tests                | `src/modules/games/Games.test.tsx`                                                                        |
| Route                | `#/games` (hub), `#/games/brain`, `#/games/break`                                                         |
| Module registration  | `src/shell/navigation/registry.ts` (`id: "games"`, not in the bottom bar; reached from Home and Practice) |

A game with `status: "soon"` shows a dimmed tile that says **Coming soon** and cannot be tapped. Nothing fake is playable. A game is only `ready` when it really plays and has tests. **Ready today: Tic-tac-toe** (`src/modules/games/tictactoe/`), which is also the working example to copy: `rules.ts` (pure rules and the bot, no React), `rules.test.ts`, `TicTacToe.tsx` (the screen) and `TicTacToe.test.tsx`.

## 2. The two groups

- **Brain Gym** (`group: "brain"`): study games. They are built from the student's own questions, flashcards and glossary. A finished round counts as study time and may count toward the daily goal and streak.
- **Break Room** (`group: "break"`): entertainment. They never read the question bank, never write attempts, never touch the streak or the daily goal. They exist to rest the head between sessions.

Keep this split strict. A study game that does not use the student's content belongs in Break Room; a fun game must never be counted as study.

## 3. Rules every game follows

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

| Id          | Name              | Idea                                                                                                                 | Controls                          | Size |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---- |
| `tictactoe` | Tic-tac-toe       | **Ready.** Easy, medium and hard (unbeatable) bot, or two players on one phone; the first move alternates each round | Tap a square                      | S    |
| `pingpong`  | Mini table tennis | Rally against the computer; the ball speeds up; first to 7 or best of 3                                              | Drag the paddle                   | M    |
| `cricket`   | Mini cricket      | Six balls, time the swing to hit; runs by where the ball lands; best score kept                                      | Tap to swing, swipe for direction | M    |
| `penalty`   | Penalty shootout  | Five kicks each against a keeper who dives; choose a corner and power                                                | Swipe to aim and shoot            | M    |
| `hoops`     | Basket shots      | Flick the ball into the hoop in 30 seconds; the hoop moves as the score grows                                        | Flick                             | M    |
| `snake`     | Snake             | The classic; eat, grow, do not bite yourself                                                                         | Swipe                             | M    |
| `memory`    | Memory match      | Flip cards and find pairs (symbols and letters, no images)                                                           | Tap                               | S    |
| `calm`      | Breathing break   | One calm minute: a circle grows and shrinks, follow it                                                               | None                              | S    |

Build order suggestion: Tic-tac-toe (smallest, proves the game contract), then Penalty shootout, Table tennis, Cricket. They need a small shared game loop (a `requestAnimationFrame` loop that uses timestamps, with a pause when the tab is hidden); write it once in `src/modules/games/shared/` when the first real-time game is built.

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
