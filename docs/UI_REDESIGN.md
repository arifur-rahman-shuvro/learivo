# UI re-engineering roadmap

Written first as the plan, then kept up to date as each phase ships. Anything not seen on a real phone is marked **Not verified**.

## 1. Why

The app grew screen by screen. Today (screenshots taken 2026-11-27, 390 px wide):

- **Home** stacks 8 cards, including a 16-shortcut "All features" grid that is half hidden behind "More", plus a Customize button. Nothing says what to do first.
- **Review** hides six tools (Due now, Mistakes, Bookmarks, Notes, Flashcards, Glossary) in a row of small scrolling tabs. Flashcards is a plain list with a tiny "Edit" link.
- **Questions** opens with four equal buttons (Add, Export, Organize, Duplicates) above the search.
- **Navigation** has six items, so labels are cut off ("Questions"). Study time appears twice (a Study tab and an Insights tab).
- Every screen invents its own header, card spacing and button hierarchy.

## 2. Principles (what UWorld, AMBOSS and Anki get right)

1. **One main action per screen.** Home says "Revise 2 due cards" or "Start today's mix", not eight options.
2. **Hubs with big tiles, then one page per tool.** A tile is big, has an icon, a name, one line of help and a live count. Tapping opens its own page with a Back button. No tabs for things that are really separate tools.
3. **Five navigation items**, never more. Everything else is one tap away from a hub.
4. **Same bones everywhere:** page header (title, one-line help, optional action), then content in clear groups, then secondary actions in a "More" menu.
5. **Numbers that mean something:** counts on tiles (due, mistakes), rings and streak in one strip, not scattered cards.
6. **Calm, readable, 44 px tap targets,** works one-handed on a phone, keeps working in all six theme/mode combinations (including AMOLED).
7. **Nothing breaks:** routes, intents, saved data and every existing feature stay. This is a restructure of how things are reached and shown.

## 3. New information architecture

Bottom navigation (5): **Home, Questions, Practice, Review, Progress.**

| Area         | What it holds                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home         | One "next step" card, goal + streak strip, a 2x2 jump grid (Practice, Review, Focus timer, Mini games), this week, weak areas, exam countdown       |
| Questions    | Search first, **Add** as the one primary button, Export / Organize / Duplicates under a **More** menu                                               |
| Practice     | Quick start, exams, custom practice, recent results. A **Mini games** tile and a **Focus timer** tile sit at the end                                |
| Review (hub) | Big tiles: Due now, Mistakes, Flashcards, Notes, Bookmarks, Glossary, each with a count. Each opens its own page (`#/review/flashcards`, and so on) |
| Progress     | Today's Insights, with **Study time** merged in from the Study stats. Focus timer is one tap away                                                   |
| Focus timer  | Still `#/study`; reached from Home, Practice, the floating pill and the command palette (it is no longer in the bottom bar)                         |
| Mini games   | New `#/games` hub. Every game card says **Coming soon**; nothing fake is playable                                                                   |

## 4. Flashcards, rebuilt

- Study mode: one big card, tap to flip (3D flip), then four honest ratings (Again, Hard, Good, Easy) that feed the existing spaced-repetition schedule. Progress bar, "n left", keyboard (Space flips, 1-4 rate), and a finish screen with what was learned.
- Deck page: search, filter (Due, New, All), cards as rows you can open, edit and delete, **New card**.
- Cards made from questions keep their link to the question.

## 5. Own ideas (added on purpose)

- **Next step card on Home** that chooses by priority: revision due, then unfinished daily goal, then weakest subject, then a quick mix.
- **Tile counts everywhere** (due, mistakes, notes) so the student sees what needs attention without opening anything.
- **Back button and breadcrumb-free pages:** every sub-page has Back to its hub.
- **Questions "More" menu** and a sticky search so the list is the star.
- **Mini games hub** designed now (names, one-line idea, Coming soon), so adding a real game later is one new file.
- **Empty states with one clear button** (not a paragraph of help).
- **Skeleton and quick transitions** only where they stop layout jumps; no decoration.

## 6. Phases

1. **P1 Foundation and navigation.** `PageHeader`, `Tile` and `TileGrid` in the UI kit, 5-item bottom bar, Progress label, Games route and hub, Focus timer reachable from Home and Practice.
2. **P2 Home.** Next step card, strip, jump grid, remove the 16-shortcut grid, simplify Customize.
3. **P3 Review hub and sub-pages,** then **Flashcards rebuild.**
4. **P4 Questions and Practice polish.**
5. **P5 Progress (merge Study time), final audit** (all themes, a11y, e2e), docs.

Every phase: typecheck, lint, tests (new ones mutation-checked), build, e2e, accessibility and design audits, screenshots compared with the "before" set, then merge. No database change is planned; if one turns up it is listed here first.

## 7. Status

All five phases are built and checked, plus a follow-up: Home "Browse all features" is a large tile, and Mini games is a two-choice hub (Brain Gym, Break Room) described in `docs/GAMES.md`. P4: Questions has one main button (Add questions) with Export, Organize and Duplicates under a More menu, a short search box, an icon bookmark; the shared page header now wraps its action under the title on narrow screens so nothing overlaps. P5: Progress > Study time now also shows the Focus timer statistics and a button that opens the timer. **Not verified:** any of it on a real phone.
