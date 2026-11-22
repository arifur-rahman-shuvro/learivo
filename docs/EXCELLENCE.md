# Engineering excellence roadmap (owner's list, 2026-11-20)

Target 9.3+/10. Order P0, P1, P2, P3. Rule from the owner: nothing is VERIFIED without real execution and recorded evidence.

Status words: **Done** (built, tested here), **Partial** (some of it), **Todo**, **Needs you / a real device** (cannot be proven from this sandbox), **Decision** (a design choice to confirm).

## Phase 1: Data integrity and recovery [P0]

### 1. Backup V3 — Partial (this pass)

Done: version 3 file with manifest (schema, record counts per section, SHA-256); integrity check on restore (cut-short, edited, missing manifest all refused, with the reason); older v1/v2 files still read; all practice and exam history (no 500 cap, read in pages); confidence per answer; mistake reasons; exam definitions; revision (FSRS) state; notes, bookmarks, flashcards, glossary; collections with members; Home layout; exam target and daily goal; restore preview; idempotent restore (second run adds nothing, tested); interrupted restore is safe to re-run; optional passphrase encryption; backup reminder. Tested with a 520-session history.
Todo: question version history (needs a database function to write old versions), tags and subjects as their own list (they come back through the questions), saved views and theme preferences (kept in browser storage, not the account), pending offline changes inside the file, streaming for very large files, migration notes between schema versions.

### 2. Disaster recovery — Todo / Needs you

Needs real production runs: scheduled backup verification, automated restore drill, restore into another account, recovery time measurement, RPO/RTO, retention policy. Supabase's own daily backups depend on the plan; check in the dashboard (Database > Backups).

### 3. Offline data safety — Partial

Done: unsent changes are never dropped by a refresh; the queue survives closing the app; changes are written one at a time; a repeat send never duplicates a question; per-change result, and refused changes listed with the reason.
Also done (2026-11-20): signing out or clearing the device sends waiting changes first and, if some cannot be sent, stops and asks (save them as a file, stay signed in, or discard); the saved file imports back; a waiting-list entry that cannot be read is set aside and reported, never replayed; the list is written before the local copy so a crash cannot lose a change; two accounts on one device are kept apart (tested).
Todo: the sign-out dialog itself is not covered by a screen test; a stored-data version number for future format changes.

## Phase 2: Offline and sync [P0]

4. Offline engine — Partial. Questions: add, edit, archive, delete, classify, tag, collect work offline. Todo: subjects, tags and collections themselves, notes, bookmarks, revision actions offline.
5. Conflict resolution — Partial (done 2026-11-20). An offline edit is compared field by field with the version it started from and with what is in the account now. Fields changed on one side only are combined silently; fields changed on both sides stop and ask. The Saved screen shows each clash side by side (mine, the account's, and what it was before) with a choice per field, plus Keep all of mine / Keep the account's version. A question deleted elsewhere asks whether to add the edit back. Nothing is overwritten before the choice; a toast and the "N to decide" label tell the student. The last 20 decisions are kept and either side can be brought back. Undecided clashes count as unsent when signing out. Tested at logic and panel level.
   Todo: a screen test of the whole Saved dialog; conflict handling for tag, collection and subject changes (those still need a connection); edits saved by an older app version compare without a starting version (every difference asks).

6. Sync engine — Partial. Ordered replay, stops on connection trouble, retry on reconnect and when the app becomes visible. Todo: exponential backoff, per-change status screen, diagnostics, multi-device and large-queue stress tests.

## Phase 3: Security and backend [P0/P1]

7. Authentication — Partial. Done 2026-11-20: when the session ends by itself (expired or revoked), the sign-in screen says so and that waiting changes are kept; signing out or deleting the account yourself shows no such notice (tested); the offline copy is not wiped by an expiry. Todo: token-refresh recovery test, concurrent sessions, password reset and account deletion verified end to end on a throwaway account (Needs you), re-authentication for sensitive actions (delete account already re-checks the password). Leaked-password protection is a dashboard switch (Needs you).
8. Database security — Partial (2026-11-20). Production was queried directly: no table without row-level security, every policy is for signed-in students and their own rows only, visitors who are not signed in have no table access, every function pins its search path, none is runnable by visitors, and the only function a student can call with owner rights is delete_my_account. A new automated check (supabase/tests/schema_audit_check.sql, 114 checks, run in CI) keeps it that way: a new table without protection, a new policy that is not own-rows, or a new owner-rights function fails the build. Shown to fail when a bad table and function were added.
   Two real accounts against production: owner reports it passed (2026-11-21; not run by the assistant, no evidence supplied). Todo: migration rollback notes.

9. Application security — Partial (2026-11-20). Done: tests that fail the build if source code uses innerHTML, dangerouslySetInnerHTML, eval, document.write, javascript: links or string timers, or builds a link from student content; hostile text (script tags, event handlers, javascript: links, iframes) rendered through the text formatter creates no elements; the header file is tested (script-src only our own, no eval, no object/frame embedding, https-only named connections, nosniff, frame deny, HSTS, no inline script in the page). Dependency audit runs in CI. AI keys stay on the device.
   Todo: the live site's headers have not been fetched from here (the sandbox cannot reach it): check on securityheaders.com (Needs you); independent penetration test (Needs a third party); file-import fuzzing.

10. Go backend — Done 2026-11-21: removed. The app never called it (no code, no network rule, no deploy pointed at it); it only ran in CI. It is still in git history (before commit "Remove unused Go backend") if a server is ever needed.

## Phase 4: AI [P1]

11. Provider reliability — Partial. Done: timeout, cancel, retry with limits for 429 and 5xx, network recovery. Todo: real-provider tests (Needs your keys on your device), token-limit and partial-answer handling.
12. AI question quality — Partial (2026-11-21). Schema validation and duplicate detection existed. Added src/modules/question-bank/domain/review.ts: checks for a missing or doubled answer key, an explanation that names another option but not the key, two-option questions, an option inside another, absolute words in the key, negative wording without NOT/EXCEPT in capitals, an empty blank, and a note that figures, dates or sources need checking (possible invented facts). They show in the editor and in the import preview ("Check this" for likely mistakes, tips for the rest), with a "need a look" count; import is blocked until the student ticks that they looked at the flagged ones (a human review step). 11 logic tests and a screen test. Not verified: these are rules of thumb on wording and structure; they cannot tell whether a fact is true, and they have not been measured against real AI output (false alarms and misses are likely). Todo: tune on real AI output, a second-opinion AI check (needs your key).
13. AI connection — Partial. Done: per-provider settings, key clearing. Todo: key validation call, connection diagnostics, usage visibility, privacy text.

## Phase 5: Frontend architecture [P1]

14. Architecture — Partial. Done: layer rules enforced by lint, dead-code sweep, stores. Done 2026-11-20: `pnpm cycles` (madge, type-only imports ignored since they vanish at build) runs in CI and fails on any real import loop; checked that a deliberately made loop is caught. Today: no loops in 252 files.
15. TypeScript — Partial. Strict mode on. Audit 2026-11-20: no ts-ignore, ts-nocheck or `any` in app code. About 150 `as` casts remain, mostly database rows typed after the query (RLS-protected, written only by this app). Done 2026-11-21: src/core/rowCheck.ts checks rows from the database at runtime (questions, attempts, attempt items, exams): required fields and kinds, allowed values, the answer's options or blanks list. A bad row stops with a plain message and reports only the table and field, never the value. Checked against production: all 135 questions, 6 attempts, 80 items and 1 exam fit. Also done: notes, review cards, flashcards and glossary terms (production rows checked: 13 cards and 1 flashcard fit; notes and glossary are empty there, so only the tests cover them). Also tags and subjects (taxonomy) now checked; production rows fit (207 tags, 2 subject nodes). Todo: collections, the data-export table reader and question history snapshots (still cast); preferences already pass through tolerant cleaners. A wrong row now stops the screen instead of being skipped: that is deliberate, but a rare odd row could block a list until fixed.
16. Error management — Partial (done 2026-11-20). A crash in one screen now stays in that screen (the menu and other screens keep working) with "Try again"; a crash outside screens shows a whole-page message with "Reload the app". Failures are sorted into lost connection, ended session or other, each with its own plain advice. Unhandled promise failures are reported and shown as one short message (not a pile), cancellations stay silent. Crash reports go to monitoring only when a DSN is set.
    Todo: boundaries around individual dialogs; retry buttons wired to the failed request itself; a log screen for the student.
17. Maintainability — Partial. Todo: split the largest files where it helps, document decisions.

## Phase 6: Performance [P1]

18 to 21 — Partial (2026-11-20). Measured in memory on this machine (not a phone, not the real database): at 10,000 questions a page lists in 11 ms and a search in about 20 ms; at 50,000, 31 ms and about 85 ms. Copying 50,000 to the offline copy took about 1 s, and a full backup of 10,000 took 0.5 s and of 50,000 about 6 s.
Found and fixed from this: (1) the offline copy silently stopped at 20,000 questions (a 50,000-question bank showed 20,000 offline); it now copies every question, tested at 20,500 and 1,300. (2) Every offline edit rewrote the whole copy (about 0.2 s of copying at 20,000 questions here, more on a phone); now only the short list of waiting changes is saved and they are laid over the copy when it loads (tested).
Guards: src/performance.test.ts fails if listing, searching, copying or backing up a 20,500-question bank becomes about ten times slower.
Todo: real-database query timing (Needs you or a test project: the sandbox cannot reach production), 100,000 questions, long-list virtualisation (the list loads pages on request, so it stays small until the student keeps loading more), bundle size budget in CI, startup time and memory on a low-end Android phone (Needs you), image-free so no image budget.

## Phase 7: Testing [P0/P1]

22. Unit — Partial (462 tests; scoring, scheduling, confidence, backup, offline queue covered).
23. Integration — Partial (SQL checks for RLS, delete account, confidence run in CI). Todo: auth lifecycle, repository tests against a real test database.
24. End-to-end — Partial (2026-11-21). CI runs `pnpm e2e`: a real Chromium at 390 px uses the real screens with in-memory data (test-only entry e2e/main.tsx, not in the production build) to add three questions in the editor, edit one, practise a session to the result screen (3/3, 100%), check Insights, archive and restore, import four questions from pasted JSON, then build an exam, sit it with one deliberate wrong answer and check the score (3 of 4, 75%). Wrong-answer variants were run for practice and exam and failed as they should. Also (2026-11-21) an offline flow: the real offline layer (copy on the device, saved changes, sync) runs in the browser over an in-memory stand-in database that fails like a dead connection while the test browser is offline (e2e/offline.tsx, test seam `makeLive` in AppShell). The test imports questions, downloads the copy, goes offline, edits one question and adds one, sees "2 waiting to sync", checks the database stand-in has not received them, goes online and checks both arrive and the old wording is gone. Two broken variants (never go online, never go offline) failed as they should. Not covered: clashes in the browser, signing out with waiting changes in the browser, the real service worker and a real network drop, real Supabase. Also a flashcard, a note and a glossary term (create, list, search filter) in the browser. Todo: offline flow in a browser, a run against the real database (the in-memory data is not the real database), Firefox/Safari in CI (the owner reports trying them by hand and that they passed; automated runs are still Chromium only).
25. Automated QA — Partial (done 2026-11-20). CI runs `pnpm a11y`: a real Chromium at 360 px opens the sign-in screen and, with a stand-in account service returning an empty account, Home, Questions, Practice, Review and Insights, in 5 theme/mode combinations. It runs axe (including colour contrast), a tap-target check (40px, label-wrapped checkboxes count by their label) and a no-sideways-scroll check. It found and fixed: Practice buttons whose spoken name did not match the visible text, and tabs and small buttons under 40px. Todo: screens with real data (only empty state is checked in a browser), dialogs, cross-browser (only Chromium), visual regression, a manual screen-reader pass. Not a full WCAG audit.

## Phase 8: Learning engine [P2]

26 to 28 — Partial (2026-11-21). Insights, confidence calibration, mistake reasons, revision forecast and a daily focus existed. Added: a Readiness card on Insights (src/modules/workspace/domain/readiness.ts). It estimates how likely a question from the student's own bank is answered right today, from finished answers only; answers lose half their weight every 21 days; it shows an 80% range, stays silent under 20 answers, says "early" under 60, and says it is not an exam-mark prediction. It also splits the next 20 questions across up to 4 areas (lower accuracy and thin evidence get more; always sums to 20) and gives plain reasons for each (accuracy and answer count, wide range, days since practice). 12 logic tests and 2 screen tests; a browser run checks the card appears. Not verified: that the weights match how real students improve (no real student data to calibrate on), and the card in the browser contrast check with real data. Also done 2026-11-21: each plan row has a Practise button (ten questions on that area), and the plan size is the student's daily goal, raised a quarter inside 30 days of the exam and half inside 7 (capped at 100), with the reason shown; tested at logic and screen level. Todo: tune the weights and the exam-date rule against real use.

## Phase 9: Design system [P2]

29 to 31 — Partial (2026-11-21). Tokens, themes, motion and a component kit exist; theme colours are unit-tested against WCAG AA. Added `pnpm design` (CI): a real Chromium at 360 px, with 8 imported questions and a finished session, in 5 theme/mode combinations, checks Home, Questions, Practice, Review, Insights (and its tabs), the results screen and the Add questions, Export, Organize and New exam dialogs for colour contrast and other axe rules, tap targets of 40px or more, no sideways scroll, focus returning to the button that opened a dialog, and focus staying in a field while typing. It found and fixed small question-row controls (select box, Bookmark, Actions). A deliberately broken focus-return was caught. Not covered: other dialogs and flows (Practice session screen, flashcards, glossary, settings), scroll-position preservation across screens, Firefox and Safari, a low-end Android check (Needs you: use the app on the slowest phone you have and tell me what feels slow).

## Phase 10: Operations [P1]

32. Observability — Partial (2026-11-21). Failures of sync (a refused offline change, unreadable saved changes) and backup (creating one, a restore that stopped) are now reported to monitoring with no student text; a live-site check workflow runs every 6 hours and after each deploy and turns red on a problem. Needs you: set a Sentry DSN to receive crash and failure reports; allow GitHub Actions emails. Not monitored: sync duration, waiting-change counts, database load.
33. CI/CD — Partial. CI runs format, lint, audit, typecheck, SQL checks, tests, build, smoke. Done 2026-11-21: `pnpm envcheck` in CI (headers, one database project, no secrets in the build), rollback procedure written (docs/OPERATIONS.md section 7). Todo: branch protection (Needs you, GitHub settings), a staging environment, automatic rollback.
34. Documentation — Partial. README, STRUCTURE, ROADMAP, AUDIT exist. Done 2026-11-20: docs/OPERATIONS.md holds the backup and restore runbook, offline and sync behaviour, security summary, failure guide and release checklist. Todo: an architecture decision log, a restore drill record, an on-call style incident checklist.

## Working order

1. Phase 1 backup V3 gaps (version history, pending changes)
2. Phase 1 and 2: safe sign-out, conflict screen, queue integrity
3. Phase 3: session expiry, security tests
4. Phase 5 error boundaries, then Phase 7 tests
5. P1 performance and AI, then P2

## Exam paper (PDF) design

- The printable paper has a cover band (title, question/marks/time chips), name/roll/date boxes, instructions, a marks table, section banners with directions, question cards with OMR-style bubbles, a rough-work box, and a page footer with the title and page numbers.
- The answer key is on its own page (a grid, grouped by section); explanations are on a further page. Without a key, the file holds no answers at all.
- On screen the page is interactive: tap options, jump to a section, "Check my answers", "Clear".
- `pnpm paper` renders it in Chromium, tests the taps, and prints a real PDF to prove the key starts on a page after the last question. Checked by breaking the page break on purpose: it fails.
- Not verified: how it looks in Android Chrome's "Save as PDF". Page numbers use CSS page margin boxes, which Firefox ignores.

## Data safety (2026-11-22)

- Runtime row checks now also cover collections and question version history (old snapshots missing later columns still show, with blanks). Tests: `supabaseRepo.test.ts`.
- `docs/MIGRATIONS.md`: what each migration added and the SQL to undo it, plus rules for new ones.
- Question version history already existed (editor > versions). The data-export reader already validates through its own checks.

## Offline organising (2026-11-22)

- Subjects, tags and collections: add, rename, colour, merge, delete now queue offline (`OrganizeOp` in `edits.ts`), apply to the device copy at once, and replay in order. New items get a device id; `pack.ts` swaps it for the real id (saved in the store so a dropped connection or restart cannot lose the link) and re-checks by name before adding, so a repeated send never makes a duplicate.
- A change the account refuses (for example, a subject deleted elsewhere) is listed under refused changes and the rest carry on.
- Tested with a broken id-swap and a missing id-save: both make a test fail.
- Still online-only: notes, bookmarks, flashcards, glossary and revision (workspace data).

## Sync retry and per-change status (2026-11-22)

- After a failed send, waiting changes are retried by `retry.ts` with growing pauses (2, 4, 8 ... capped at 5 minutes), reset when the connection returns or the app is opened. No polling while offline.
- The Saved dialog lists every waiting change ("Add tag: later"), says when the next try is, and has Try now.
- Not verified on a real phone with a flaky connection; the timing is tested with a hand-moved clock.

## Offline workspace (2026-11-22)

- Notes, bookmarks, revision cards, flashcards, glossary, daily goal, exam date and Home layout now work offline (`src/platform/offline/workspace.ts`). Lists are copied to the device when opened online; changes are shown at once, kept in order, and sent when back online. Last change to the same thing wins (no merge of two versions of a note).
- New notes, flashcards and terms get an id made on the device (`newId`), and the database creates them with that id, so a resend never makes a copy.
- Signing out or clearing data sends waiting changes first and asks before discarding them; deleting data clears the copy.
- The Saved dialog counts and lists these changes with the question changes.
- Not verified on a real phone. A list never opened online cannot be read offline (it says so).

## Phase F (2026-11-22): failures that explain themselves

- A crash inside any dialog shows a message with a Close button instead of blanking the app (`Dialog` wraps its content in an inline `ErrorBoundary`).
- The Organize tabs say why a list did not load and offer **Try again**.
- AI connection: a failed test now says what to do next for each kind of failure (key, credit, limit, model, network, blocked). A counter on this device shows requests today and in total, and tokens when the provider reports them (`src/modules/ai/usage.ts`). It only counts what this device sent; the provider's site is the real bill. The key already stays in browser storage only, and the dialog says so.

### Backup with changes waiting on the device

Backup reads what the server holds. Before it saves, it now sends any waiting offline changes (questions, organising, notes, flashcards). If some still cannot be sent it lists them and offers **Save without them**, so a backup never silently misses work (`src/account/backup/unsent.ts`).

### Backup size (measured 2026-11-22)

A bank of 20,000 questions makes a 16 MB file and takes about 1.2 seconds to build in tests. The file is built in memory and checked with SHA-256, so streaming is not needed at this size. If a bank ever passes about 100,000 questions, revisit this.

### Retry timing

A failed send of waiting changes is retried after 2 s, then 4, 8, 16 s and so on, never more than 5 minutes between tries (`src/platform/offline/retry.ts`). While there is no connection it waits for the browser's online signal instead of polling, and it tries at once when the connection returns or the student taps **Try now**. AI requests retry twice (3 s, 9 s) on a busy provider or rate limit, and honour the provider's Retry-After up to 30 s.

## Roadmap build, 2026-11-22 (R1 to R4)

- **Fonts:** Latin letters only, copied into `src/ui-kit/themes/fonts/` (5 files, 180 KB instead of 23 files, 564 KB). The five `@fontsource-variable` packages were removed. Bangla and other scripts use the phone's own font.
- **Bangla in the PDF:** the paper stack now lists Bengali-capable fonts before the generic one, and `pnpm paper` prints a Bangla question and checks the words are in the PDF. CI installs a Bengali-capable font if the runner has none.
- **Smart mix preview:** the button says what today's mix holds ("0 revision due, 0 weak, 3 new") from the same function that builds the mix (`smartPreview` in `start.ts`).
- **Offline:** every list is opened once after sign-in and when the connection returns (`OfflineWorkspace.prefetch`), so a list never opened online is not empty offline.
- **Offline notes edited on two devices:** the edit remembers the version it started from. If the account has a newer one when it is sent, the student is told that their version replaced it. Refused changes of the offline workspace were never shown anywhere before; they now appear in the sync panel under "need your attention" until dismissed, and survive a restart.
- **Coverage:** `pnpm coverage` runs in CI with a floor (lines 78, statements 75, functions 70, branches 68). Measured today: lines 81.4, statements 78.8, functions 74.5, branches 72.6.
- **Already existed, so not rebuilt:** Smart mix, mistake groups by reason and confidence, missed questions added to revision automatically, exam pace and week plan, keyboard shortcuts in the player, paste import.

### Introduction page (2026-11-22)

`src/landing` (a new layer: may import core, motion, ui-kit) holds the page signed-out visitors see first. It is loaded only for them (its own chunk, so the signed-in app does not download it). Colours and fonts come from the theme, so it follows all three themes in light and dark. Contents: an answerable sample question that saves nothing, a pace calculator, an explorer for the four kinds of answer (the same names the app uses), a printed-paper preview, the trust facts, and a theme switcher. No pictures are used. The accessibility check (axe, 40 px tap targets, no sideways scroll at 360 px) runs on it in all five theme and mode combinations, with the sample question open as well.
