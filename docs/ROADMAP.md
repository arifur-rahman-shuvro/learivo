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

## Status and deviations (updated 2026-11-15)

| Phase | Status                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| 0-1   | Done (blueprint)                                                                                                           |
| 2     | Done, and the app shell and Home screen were redesigned afterwards at the owner's request                                  |
| 3     | Done, except the items below. Go service live on Render free (owner-checked 2026-11-12)                                    |
| 4     | Done; owner phone-tested and approved (2026-11-13)                                                                         |
| 5     | Done; owner phone-tested and approved (2026-11-13)                                                                         |
| 6     | Done; owner phone-tested and approved (2026-11-13)                                                                         |
| 7     | Done; M5 applied; owner checked everything (2026-11-15)                                                                    |
| 8     | Done; M6 applied; owner checked everything (2026-11-15). Open items listed below                                           |
| 9     | Done in part: flashcards, glossary, achievements; owner phone-tested 2026-11-15 (AI helpers and sharing deferred by owner) |

Phase 3 items not done, with reasons:

- **Go service database connection (pgx).** The service is deployed at learivo-api on Render (free plan). The owner confirmed `/healthz` returns ok and `/v1/me` returns `missing_token` without a token. No route needs the database yet, and the Go package registry is blocked in the build session, so the connection is added with the first database route in Phase 4. Moving to an always-on host is a launch task.
- **Staging Supabase project.** The free plan allows two projects and ShuvroMed uses one. Until launch, migrations are additive, tested locally and in CI, then verified right after applying.
- **Error tracking (Sentry).** Needs an account; add it together with the Go deployment.

Deviations from the blueprint: hash routing instead of TanStack Router, no Radix, Zustand or Dexie yet (each is added when its phase needs it), and the Go service replaces Supabase Edge Functions (sections 3, 4 and 8 of the blueprint still say Edge Functions).

Phase 4 deviations from the blueprint:

- Question create, edit, search and bulk actions go from the browser to Supabase under row-level security, not through the Go service. The Go database connection stays deferred.
- Answers are stored as validated JSON (`answer_spec`) instead of a separate options table.
- Statements and explanations are plain text; rich text comes later.
- Import files are parsed in the browser and inserted in batches of 500. The duplicate policies are Skip, Import anyway and Replace.
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
- Notes: one note per question, plus free notes. Note search and simple rich text were added later.
- Planner basics are limited to the daily goal and streak. The exam countdown was added later; a calendar planner is not built.
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

## Follow-up: five-option questions and partial marking (M7)

- Short answer removed. sba / single_choice / multi_select / true_false always have exactly 5 options (enforced in the app and by the database).
- True/false: a lead-in question plus 5 statements, each with its own True/False key. 0.2 marks per statement correctly marked.
- Multiple answer with k correct: each correct pick earns 1/k; a wrong pick cancels one correct pick (ticking everything earns 0).
- Negative marking uses the same units (a wrong statement costs 1/5 of the penalty, a wrong pick 1/k).
- Insights and the revision queue treat "partly correct" as not fully correct.

## Follow-up: remaining Phase 0–8 items

- Done: FK covering indexes (M8), import "Replace" policy, note search, safe rich text (bold, italic, code, bullet lists) in notes and explanations, exam countdown with a daily pace on Home (M9), crash reporting wired but off until a Sentry DSN is provided at build time (no personal data is sent).
- Owner-only / unavailable: backup secrets (see RUNBOOK), a separate staging Supabase project (free-plan limit), leaked-password protection (paid Supabase setting), real-user, screen-reader and penetration tests.

## Phase 9: flashcards, glossary, achievements (M10)

- Review > Flashcards: the student writes cards (front/back), due cards are revised and rated Again/Hard/Good/Easy with the same scheduler as questions.
- Review > Glossary: own terms and meanings with search; matching words are underlined (hover or focus to read the meaning) in explanations, notes and flashcards.
- Insights > Achievements: 11 milestones worked out from the student's own sessions (answers, streaks, exams, clean sheets, accuracy). Nothing is shared.
- Not built, by the owner's choice: AI helpers and sharing (these need the Go server and an outside AI service).

## Follow-up: smarter import prompts

- Import > Make a prompt: a form (subject, chapter, topic, subtopic, exam, institution, year, source, tags, level, question types, difficulty, count, explanation length, languages, extra wishes) builds a ready-to-paste prompt for AI or any AI chat. The student's details are written onto every question. The form is remembered on this device only.
- Two modes: write new questions, or copy existing ones from photos, PDF pages or text (keeps the wording, solves a missing answer key and tags it `check-answer`, pads or trims to 5 options and tags `check-options`, describes pictures in words and tags `had-image`, because Learivo does not store images).
- Review step: "Add to every question" fills subject, chapter, tags, exam, institution, year and source only where a question lacks them.
- Invalid questions: "Copy a fix request for the AI" builds a message asking for corrected JSON for only the failing questions.

## Owner phone check

- 2026-11-15: owner reported that everything (5-option marking, Phase 9, smart import prompts) was tested on the phone and passed.

## Follow-up: account menu and profile (M11)

- The top bar now has one avatar button instead of Settings, the email and Sign out. It opens a menu with the student's name and email, **Your profile**, **Appearance**, **Settings** and **Sign out**. It works with the keyboard (arrow keys, Escape returns focus to the avatar).
- Your profile: a name (up to 40 characters) and one of 8 avatar colours. The avatar is a person glyph until a name is saved, then shows initials. Stored on the student's own `profiles` row (M11 adds `avatar`; row-level security already limited it to the owner).
- Appearance: theme and mode. Settings: Your data (counts and clearing) and the search shortcut note. The signed-out screen keeps a small Appearance button.
- Not built: uploading a photo (Learivo stores no images), changing the sign-in email or password from the menu.

## Follow-up: flexible options (M12)

- Choice questions (single best, single choice, multiple answer, true/false) now have **2 to 5** options or statements instead of exactly 5. New questions still start with 5 blank rows; the editor has Add option and Remove option.
- Marking is unchanged: each true/false statement is worth 1/n of the mark, each correct pick in multiple answer is 1/k.
- The prompt maker has an "Options per question" setting (AI decides 2 to 5, or exactly 2, 3, 4 or 5).
- Existing questions with 5 options are untouched.

## Next: Phase 10 to 12 (proposed 2026-11-16)

Built on what already exists (practice palette and flags, goal ring, exam countdown, flashcards, glossary, achievements and offline are done). Each item is small enough to ship and phone-test alone.

### Phase 10: Learn from mistakes (highest value)

1. **Mistake reasons.** After an attempt, tag each wrong answer: careless, did not know, mixed up, guessed. Insights shows which reason costs the most marks. (new column on attempt_items)
2. **Mistake notebook.** One screen of every question you got wrong, grouped by reason and subject, with a one-tap "practise these".
3. **Confidence mark.** Optional "sure / unsure" before answering; Insights shows lucky guesses and overconfident misses.
4. **Result breakdown.** Per-subject bars and time per question on the result screen.

### Phase 11: Look and structure

5. **Subject colours.** Pick a colour per subject; used on chips, charts and the question list.
6. **Question list upgrade.** Type badge, difficulty dots, saved filter views ("Anatomy, hard, never answered").
7. **Home refresh.** Weekly 7-day bar chart, streak, and a single "Start today's session" button that mixes due reviews and weak topics.
8. **Empty states and first-run tour.** A sample bank the student can delete, and a short checklist (add questions, take a test, set exam date).
9. **Theme polish.** Motion and focus states reviewed across Default, Forest and Space.

### Phase 12: Planning and safety

10. **Study planner.** From the exam date and bank size, a daily quota and a simple week calendar.
11. **Full backup and restore.** One file with questions, notes, flashcards and history; restore into an empty account.
12. **Duplicate merge.** Find near-duplicate questions and merge, keeping notes and history.
13. **Printable paper.** A built exam as a print-friendly page.

Deferred by the owner: AI helpers, sharing, Go API features. Not planned: image questions (Learivo stores no images).

## Progress on Phase 10 to 12 (2026-11-16)

Done and pushed:

- Mistake reasons (M13): tag why a wrong answer was missed on Results; Insights shows where marks go. The Review > Mistakes tab is the mistake notebook.
- Insights overview redesigned: accuracy ring and streak, strongest and weakest subject, reason chart, 12-week activity heatmap.
- Settings > Change password (re-checks the current password first, then sets the new one, minimum 8 characters).
- Home > All features: every feature grouped, with an icon, a one-line description, search and a direct link. Also on the welcome screen.
- Add questions hub (write, make a prompt, paste, upload, add a subject) and a tidier Import dialog (Make a prompt, Paste JSON, Upload file, with a step line for each).
- Home > This week: seven-day activity bars.
- Back up and restore (Settings and All features): one JSON file with questions, notes, bookmarks, flashcards, glossary, exam target and daily goal. Restore shows a preview and only adds what is missing; nothing is overwritten or deleted. Practice history is not included.
- Study planner: with an exam date set, Home shows how many questions are not practised yet, the daily quota that finishes them in time, and a coverage bar.
- First-run sample questions: on the empty welcome screen, "Try sample questions" adds five (subject Sample, tag sample) so practice and exams can be tried at once.
- Question list: difficulty shown as five dots; filters can be saved as named views (kept on this device) and brought back from a menu.
- Printable exam paper: on each saved exam in Practice, Print paper draws the exam's questions by its rules and lays out a paper with the title, instructions, time, marks scheme and one section per question type, with an optional answer key (with or without explanations). Print or save as PDF; Pick different questions redraws.
- Duplicates (Questions screen): finds questions saved twice (same wording and type, spacing and case ignored), keeps the oldest, archives the rest and moves their tags and collections across. Archived copies can be restored.
- AI connection (bring your own key): Settings > AI connection. Google Gemini, OpenAI, Anthropic and OpenRouter. The key is kept only in this browser, is never sent to Learivo's servers or stored in the database, and is forgotten on sign out. Add questions > Make a prompt > Generate questions asks the student's own AI (up to 25 at a time, one automatic retry if the reply cannot be read) and sends the reply into the normal import preview, so nothing is saved unseen. A source-material box makes questions only from the student's own notes. The key page link and a helper prompt for an AI chat are in the dialog. Not tested against the real providers: only against fake replies.
- Interactive user guide: six first steps that tick themselves from the student's own data, plus short answers (marks, AI import, revision, offline, privacy, shortcuts). Opened from the account menu, All features and the welcome screen.

Still open from the proposal: confidence mark, result breakdown per subject and time, subject colours.

## Polish and re-engineering roadmap (2026-11-17)

Found by running the app at phone width (390 px) with sample data, plus a look at bundle size and code.

What is already good: clean Home, clear empty states, consistent cards, lazy-loaded screens, Sentry only loads when a key is set.

What is rough:

- **Practice session:** one long scrolling page. The bottom tab bar stays on screen during a timed exam. Check answer, Next and the question grid are far apart. Flag, Bookmark and Note look like plain text.
- **Practice start:** four dropdowns and several fields before the first question. No one-tap start.
- **Question list:** seven filter controls stacked on a phone, and a very long page. Stems are cut to one line.
- **Mistakes tab:** cannot group by the reason the student chose.
- **Empty and loading:** every empty screen uses the same picture. Loading is a blank area.
- **Weight:** Questions screen is 79 kB and Import/Export is an 800-line file. Five font families ship.
- **Safety nets:** no reminder to back up. Accessibility is checked by hand, not on every screen in CI.

### Phase 13: Practice that feels fast (build first)

1. Focus mode: hide the tab bar and header during a session, slim progress bar on top, sticky bottom bar with Previous, Check or Next. Question grid opens as a bottom sheet.
2. Icon buttons with labels for Flag, Bookmark, Note. Keyboard shortcuts on desktop (1 to 5, N, P, F).
3. Quick start on Practice: presets (Quick 10, Due now, My mistakes, Flagged, Weak areas) and Continue where you left off. The long form folds into "Custom".
4. Remember the last custom settings.

### Phase 14: Question bank at scale

5. Filters in one sheet with removable chips and a sticky search box. Two-line stems.
6. Row actions menu, and the list loads more as you scroll.
7. Editor: autosave a draft, paste many options at once.
8. Subject colours (needs one database column).

### Phase 15: Review and insights depth

9. Mistakes grouped by reason (careless, not known, mixed up, guessed).
10. Insights: tap a weak subject to practise it. Revision forecast for the next 7 days.
11. Backup reminder on Home when the last backup is old.

### Phase 16: Finish and harden

12. Skeleton loading, a different picture per empty screen, one toast style, light motion that respects reduced-motion.
13. Accessibility check of every screen on every theme as a test in CI.
14. Weight: load dialogs on demand, load only the fonts the chosen theme uses.
15. Split files over 500 lines. Add a phone-width smoke test of the main flows to CI.

Order: 13, 14, 15, 16. Each item is pushed on its own with tests, and the phone check list goes to the owner after each phase.

### Progress on the polish roadmap (2026-11-17)

- Phase 13 done: focus mode (no tab bar or header on phones during a session, progress bar, sticky Previous / Check / Next bar, question list as a sheet, Flag / Save / Note icon buttons, N, P, F and arrow-key shortcuts on desktop). Quick start on Practice (Quick 10, New questions, My mistakes, Bookmarked, with live counts), custom form folded away, last custom choices remembered. Shortcuts for choosing an option with 1 to 5 are not built yet.
- Phase 14 partly done: on phones the question filters fold behind a Filters button, and active filters show as removable chips. Stems were already two lines. Not built: sticky search, row actions menu, load-as-you-scroll, editor draft autosave, subject colours.
- Phase 15 partly done: Home reminds the student to back up when the bank has 10 or more questions and no backup was saved in 14 days (Later waits a week). Not built: Mistakes grouped by reason (the reason lives on each attempt item, so it needs the question_history database function changed), tap-to-practise on Insights, revision forecast.
- Phase 16 partly done: an automatic accessibility check now runs on Home, Questions, Practice, Review and Insights in CI. It found and fixed empty-state headings that skipped a level. Not built: skeleton loading, different empty-state pictures, font and dialog code splitting, file splitting, phone-width smoke test.
- Generate with AI now has its own place: Add questions > Generate with AI (its own tab in the import dialog). Make a prompt shows only the prompt to copy.

- 2026-11-17: weak areas have a Practise button (Home, Insights); Home shows a 7-day revision forecast.
- 2026-11-17: Questions search stays pinned on phones while scrolling; list loads with placeholder rows instead of a spinner.
- 2026-11-17: Questions list loads the next page automatically on scroll (button kept as fallback). New-question draft autosave already existed.
- 2026-11-17: Guide, Backup and AI connection dialogs download only when first opened.
- 2026-11-17: Optimisation audit. First load on a phone-width sign-in page is about 780 kB uncompressed (about 190 kB gzipped); error monitoring code loads only when a DSN is set. Database advisors show no performance problems; the 11 "unused index" notes are foreign-key indexes on a small database and are kept for growth.
- 2026-11-17: Empty screens show an icon that matches what is missing (questions, search, insights, exams, mistakes, bookmarks, notes, caught up).
- 2026-11-17: One toast style for short confirmations (bulk actions, bookmarks, Review actions).
- 2026-11-17: Dialogs and toasts fade and rise in briefly; off with reduced motion or Low effects.
- 2026-11-17: CI opens the built app at 360, 390 and 430 px and fails if the first screen is blank, logs errors, or runs off the side (`pnpm smoke`). Large files are left as they are unless a change needs them split.
- 2026-11-17: Choice fields on Practice setup and the Questions filter bar open a roomy sheet (search, nested subjects, tick on current) instead of the phone plain radio list. New `Picker` component.
- 2026-11-17: Every dropdown now uses the Picker sheet, and short either-or choices (True/False, explanation length, options per question) use a sliding Segmented control. One shared subjectOptions helper.

## Upgrade and strengthening roadmap (2026-11-17, Phases 17 to 23)

Written after reading the code of every module, not from memory. Each item names the gap that was found. Order is by value for a daily-use study app and by risk (database changes are additive and tested locally first).

| Phase | Goal                             | Gap found in the code                                                                                                                                                                                                                                                               |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17    | Time per question                | Only the whole-session time is stored. `attempt_items` has no per-question seconds, so Results cannot show slow questions and Insights cannot show speed per subject.                                                                                                               |
| 18    | Backup v2                        | The backup holds questions, notes, bookmarks, flashcards, glossary, target and goal. It leaves out practice and exam history, exam definitions, revision (FSRS) state, mistake reasons and saved views. A restore loses the student's progress.                                     |
| 19    | Duplicate detection v2           | Detection matches only identical wording after trim, case and spacing. Punctuation, accents, number formats, reordered options and small rewordings are missed. Import and AI results are checked against exact copies only.                                                        |
| 20    | AI hardening and end-to-end test | AI is tested with a fake network only. No time-out, cancel, retry or progress. Generated questions are not checked against the bank for near copies before import.                                                                                                                  |
| 21    | Motion and SVG polish            | Animated score ring on Results, drawn charts, per-theme illustrations, Home and Insights skeletons, page transitions. All respecting reduced motion.                                                                                                                                |
| 22    | Practice depth                   | Per-question timer on screen, pause and resume, a smart session that mixes due revision, weak areas and new questions, compare an exam with its previous attempt, question quality hints in the editor (no explanation, repeated options, single-answer type with several correct). |
| 23    | Organise and recover             | Undo for deletes, a version history screen with restore (versions are stored but have no screen), tag rename and merge, rule-based smart collections.                                                                                                                               |
| 24    | Revision engine                  | One daily plan that combines due cards and the daily goal, streak protection, end-of-session summary.                                                                                                                                                                               |
| 25    | Data portability                 | CSV export that includes attempts, flashcards to and from Anki-style CSV, printable flashcards.                                                                                                                                                                                     |
| 26    | Reliability at scale             | Error boundary per screen, session-expiry handling, a window-rendered question list that stays fast at thousands of questions, a full-flow test through the app with the memory repositories.                                                                                       |

Progress notes for these phases are added below as each item is pushed.

- Phase 17 (2026-11-18): time per question. New column `attempt_items.seconds` (M14, tested locally, applied to production). Player counts seconds per question while the page is visible and saves them on leaving a question and on submit. Results show per-question time, average per question and the slowest questions with one plain note about pace. Insights (Study time) show average time per question and time per subject. Sessions finished before this change have no per-question time and are left out of these numbers. "Practise missed questions" after results already existed, so it is removed from Phase 22.
- Phase 18 (2026-11-18): backup v2. The file (version 2) now also holds the latest 500 finished practice and exam sessions with every question's answer, flag, time and mistake reason, saved exams (subjects stored by name, not id), and revision-card schedules. Restore adds only what is missing (sessions match on start time and title), links sessions back to restored questions by content, and reads version 1 files as before. Unusable history in a file is dropped, not guessed. Not run against a real restore with a real account; large histories restore slowly because each session is written one by one.
