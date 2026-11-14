# Learivo roadmap

Each phase ends with a written report and owner approval before the next begins.

| Phase | Goal                                                                                                                                                         | Size   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 0-1   | Discovery and architecture (blueprint)                                                                                                                       | M      |
| 2     | Design system and UX: tokens, theme registry (Default, Forest, Space), brand SVGs, component library, screen specs                                           | L      |
| 3     | Foundation: repo, CI, staging and production projects, auth, profiles, row-level-security base, deploy pipeline, app shell, module registry, sync skeleton   | L      |
| 4     | Core Question Bank: six question types, taxonomy, editor, search and filters, bulk actions, history, duplicates, collections, JSON and CSV import and export | XL     |
| 5     | Practice and Exams: practice sessions, exam builder and player, scoring, results; matching, structured and case-study types                                  | XL     |
| 6     | Personal workspace: notebook, bookmarks, revision (FSRS), analytics, planner basics                                                                          | L      |
| 7     | Advanced experience: offline packs, command palette, global search, dashboard customization, Forest and Space decorative layers, performance                 | L      |
| 8     | QA and production: full tests, security review, accessibility, load test, backup and restore drill                                                           | L      |
| 9     | Expansion: optional AI helpers, flashcards, glossary, achievements, sharing if justified                                                                     | varies |

## Rules

- Nothing is called done unless it was actually run and verified.
- No production database change without the exact SQL being shown and approved first.
- Secrets live only in GitHub, Cloudflare, Supabase and host settings, never in the repository.

## Status and deviations (updated 2026-11-12)

| Phase | Status                                                                                    |
| ----- | ----------------------------------------------------------------------------------------- |
| 0-1   | Done (blueprint)                                                                          |
| 2     | Done, and the app shell and Home screen were redesigned afterwards at the owner's request |
| 3     | Done, except the items below. Go service live on Render free (owner-checked 2026-11-12)   |
| 4     | Built and tested; waiting for the owner's phone test and approval (see below)             |
| 5     | Built and tested; M3 applied; waiting for the owner's phone test and approval (see below) |
| 6     | Done; owner phone-tested and approved (2026-11-13)                                        |
| 7     | Built and tested; M5 applied; waiting for the owner's phone test and approval (see below) |
| 8     | Built and checked; M6 applied; waiting for the owner's approval (see below)               |
| 9     | Not started; waits for the owner's approval                                               |

Phase 3 items not done, with reasons:

- **Go service database connection (pgx).** The service is deployed at learivo-api on Render (free plan). The owner confirmed `/healthz` returns ok and `/v1/me` returns `missing_token` without a token. No route needs the database yet, and the Go package registry is blocked in the build session, so the connection is added with the first database route in Phase 4. Moving to an always-on host is a launch task.
- **Staging Supabase project.** The free plan allows two projects and ShuvroMed uses one. Until launch, migrations are additive, tested locally and in CI, then verified right after applying.
- **Error tracking (Sentry).** Needs an account; add it together with the Go deployment.

Deviations from the blueprint: hash routing instead of TanStack Router, no Radix, Zustand or Dexie yet (each is added when its phase needs it), and the Go service replaces Supabase Edge Functions (sections 3, 4 and 8 of the blueprint still say Edge Functions).

Phase 4 deviations from the blueprint:

- Question create, edit, search and bulk actions go from the browser to Supabase under row-level security, not through the Go service. The Go database connection stays deferred.
- Answers are stored as validated JSON (`answer_spec`) instead of a separate options table.
- Statements and explanations are plain text; rich text comes later.
- Import files are parsed in the browser and inserted in batches of 500. The duplicate policies are Skip and Import anyway; Replace is not built.
- Search uses a generated full-text column (simple dictionary), which handles Bengali.
- Not checked in a real browser session against production: the owner must try the screens at https://learivo.pages.dev.

Phase 5 notes:

- Practice sessions and exams are marked in the browser when submitted; each question is stored as a frozen snapshot inside the attempt, so results stay correct if the question is later edited or deleted. A student could in theory edit their own results; this is a private study tool, so that only affects themselves.
- Marking: multiple select needs exactly the right set; short answer and fill-in-the-blank ignore case, spacing and trailing punctuation; negative marking never takes a score below zero.
- Untimed practice measures time only while the session is open on screen. Timed sessions use the wall clock from when they started.
- Not built in Phase 5: matching, structured and case-study question types (they need a new answer format and a change to the question table), bookmarks and weak-area suggestions (Phase 6), offline sessions (Phase 7).
- Database advisor (performance, informational): a few foreign-key columns have no covering index yet; harmless at this size, to be reviewed in the QA phase.

Phase 6 notes:

- Review: Due now (spaced-repetition cards rated Again, Hard, Good, Easy), Mistakes, Bookmarks, Notes. Questions answered wrong in a session join the revision queue by themselves.
- The scheduler follows the published FSRS-4.5 memory model with its default parameters. It is not tuned to the student's own history yet. After Again a card returns in 10 minutes.
- Insights: overview with a 30-day accuracy trend, accuracy by subject or chapter (weakest first), exam scores over time, study time for 14 days. Every chart has a table view. They are worked out from the latest 5000 answers and 200 finished sessions.
- Home shows due cards, daily goal (stored in the cloud, 1 to 500), day streak, weak areas (under 70% after 5 or more answers) and recent sessions. A streak that was alive yesterday still counts today.
- Notes: one note per question, plus free notes. Rich text and note search are not built.
- Planner basics are limited to the daily goal and streak. A calendar planner and exam countdown are not built.
- Practice can now draw from bookmarked questions.

Phase 7 notes:

- Installable app: Learivo can be added to the phone's home screen and opens like an app. A service worker keeps the app files on the device; after one visit with a connection, the app opens with no connection. A banner appears when a new version is ready ("Update now"). Verified in a real browser: with the network off, a reload still shows the app.
- Offline question copy: the whole active question bank is copied to the device (IndexedDB) after sign-in and refreshed when online. Offline, Questions, Practice and exams read from that copy. Editing the bank, importing, notes, bookmarks and revision cards need a connection. The copy is removed on sign-out, and can be removed or refreshed by hand from the header (Saved / Offline / Syncing menu).
- Offline sessions: a practice session or exam is saved on the device first and sent to the account when a connection exists, with its original start and finish times. A retry never creates a session twice. Exams must have been opened once online to be available offline. Unsent sessions stay on the device after sign-out so no work is lost.
- Limits: in-progress sessions live on the device until finished (they do not resume on another device); offline Insights show only on-device sessions plus nothing from the account; there is one whole-bank copy, not separate subject packs; the offline sign-in with a real Supabase session was not tested (the test environment cannot reach it), only the pieces and the offline app shell.
- Command palette (Ctrl or Cmd + K, or the Search button): go to any screen, add or import questions, start practice or revision, and search every question; picking a question opens Questions filtered to it. It searches the offline copy when offline.
- Home customization: Customize on Home shows or hides five sections and sets their order; saved to the account (M5: `user_preferences.home_layout`, size-limited, covered by the same row protection).
- Forest and Space decorative layers already existed from Phase 2 and respect the low-effects setting; no change this phase.
- Performance: the app's own code in the first load is 78 kB (23 kB compressed); libraries sit in separate cached files; screens load on demand. Not measured on a real phone.

Phase 8 notes (details in docs/RUNBOOK.md):

- Security review: no known vulnerabilities in the libraries the app ships (the one moderate finding is in the lint tool, which is not shipped); no secrets or risky HTML injection in the code; the database protections were re-checked (89 SQL checks across 5 files, all pass, run in CI). New browser security headers (strict content policy, no framing, no sniffing) were added in `public/_headers`. Verified in a real browser on the sign-in screen only: the app, the service worker and the theme script run with no violations. The signed-in screens under these headers still need your phone check after deploy.
- Accessibility: automated scan (axe, WCAG 2.1 AA) of every screen in three themes, light and dark, plus the open dialogs. It found four small problems (a button label that did not match its text, list markup in the subjects dialog, a repeated page landmark inside dialogs, no skip link), all fixed and re-scanned clean. Automated scans find roughly a third of real problems; a screen-reader pass by a person has not been done.
- Load test (local Postgres, 50,000 questions and 200,000 answers for one student): browsing, filtering and search stay under 25 ms. Two slow spots were found and fixed in M6: the latest-answers query (170 ms to 3 ms per page, new index) and the answered-before lookup (about 200 requests down to one database function, which also fixed a rare wrong "last result" across page boundaries).
- Backup and restore: a 250,000-row dump and restore into an empty database matched exactly, including all protections. A weekly encrypted backup job is in place but does nothing until the owner adds two secrets (RUNBOOK). Supabase's own backup plan could not be read from here; check the dashboard.
- Not done: load test against the real Supabase project, a penetration test, screen-reader testing, and monitoring (Sentry) remain open.

Follow-up (2026-11-14), owner request: delete and clear data.

- Questions screen: "Delete" now appears for selected questions on the main list (before, questions had to be archived first). Typing DELETE confirms.
- Settings menu (was "Appearance") has a new "Your data" button: shows counts, then three permanent actions behind a typed DELETE: clear practice history, delete all questions (with their bookmarks, notes and revision cards; finished sessions keep their own copy), delete everything (also exams, subjects, tags, collections). The account and appearance settings stay. Large banks are removed in batches (about 125 ms per 500 questions locally), so very large deletes can take a minute. The copy kept on the device is cleared too.
- Not added: deleting the account itself, and deleting a single question from inside the editor (select it in the list and tap Delete).
