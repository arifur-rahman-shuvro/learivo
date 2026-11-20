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
   Todo: a live test with two real accounts against production (needs two throwaway accounts: Needs you); migration rollback notes.

9. Application security — Partial (2026-11-20). Done: tests that fail the build if source code uses innerHTML, dangerouslySetInnerHTML, eval, document.write, javascript: links or string timers, or builds a link from student content; hostile text (script tags, event handlers, javascript: links, iframes) rendered through the text formatter creates no elements; the header file is tested (script-src only our own, no eval, no object/frame embedding, https-only named connections, nosniff, frame deny, HSTS, no inline script in the page). Dependency audit runs in CI. AI keys stay on the device.
   Todo: the live site's headers have not been fetched from here (the sandbox cannot reach it): check on securityheaders.com (Needs you); independent penetration test (Needs a third party); file-import fuzzing.

10. Go backend — Not used by the app today. Decision: keep or remove `backend/`.

## Phase 4: AI [P1]

11. Provider reliability — Partial. Done: timeout, cancel, retry with limits for 429 and 5xx, network recovery. Todo: real-provider tests (Needs your keys on your device), token-limit and partial-answer handling.
12. AI question quality — Partial. Schema validation and duplicate detection exist through import. Todo: answer-key and option checks, negation and ambiguity warnings, hallucination-risk notes, human review step, quality summary.
13. AI connection — Partial. Done: per-provider settings, key clearing. Todo: key validation call, connection diagnostics, usage visibility, privacy text.

## Phase 5: Frontend architecture [P1]

14. Architecture — Partial. Done: layer rules enforced by lint, dead-code sweep, stores. Done 2026-11-20: `pnpm cycles` (madge, type-only imports ignored since they vanish at build) runs in CI and fails on any real import loop; checked that a deliberately made loop is caught. Today: no loops in 252 files.
15. TypeScript — Partial. Strict mode on. Audit 2026-11-20: no ts-ignore, ts-nocheck or `any` in app code. About 150 `as` casts remain, mostly database rows typed after the query (RLS-protected, written only by this app). Todo: runtime validation of database rows (Not verified: a row written by hand could differ from its type).
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
24. End-to-end — Partial (2026-11-20). A real-browser run signs in against a stand-in account service and walks the five main screens. Todo: add/edit/practice/exam flows in a browser, real-database run, offline flow in a browser.
25. Automated QA — Partial (done 2026-11-20). CI runs `pnpm a11y`: a real Chromium at 360 px opens the sign-in screen and, with a stand-in account service returning an empty account, Home, Questions, Practice, Review and Insights, in 5 theme/mode combinations. It runs axe (including colour contrast), a tap-target check (40px, label-wrapped checkboxes count by their label) and a no-sideways-scroll check. It found and fixed: Practice buttons whose spoken name did not match the visible text, and tabs and small buttons under 40px. Todo: screens with real data (only empty state is checked in a browser), dialogs, cross-browser (only Chromium), visual regression, a manual screen-reader pass. Not a full WCAG audit.

## Phase 8: Learning engine [P2]

26 to 28 — Partial. Insights, confidence calibration, mistake reasons, revision forecast and a daily focus exist. Todo: study allocation, readiness estimate, explanations for recommendations.

## Phase 9: Design system [P2]

29 to 31 — Partial. Tokens, themes, motion and a component kit exist. Todo: contrast verification per theme, touch-target audit, focus restoration and scroll preservation checks, low-end Android check (Needs you).

## Phase 10: Operations [P1]

32. Observability — Partial (error monitoring hook exists). Todo: sync and backup monitoring, alerts.
33. CI/CD — Partial. CI runs format, lint, audit, typecheck, SQL checks, tests, build, smoke. Todo: branch protection (Needs you, GitHub settings), rollback procedure, environment checks.
34. Documentation — Partial. README, STRUCTURE, ROADMAP, AUDIT exist. Done 2026-11-20: docs/OPERATIONS.md holds the backup and restore runbook, offline and sync behaviour, security summary, failure guide and release checklist. Todo: an architecture decision log, a restore drill record, an on-call style incident checklist.

## Working order

1. Phase 1 backup V3 gaps (version history, pending changes)
2. Phase 1 and 2: safe sign-out, conflict screen, queue integrity
3. Phase 3: session expiry, security tests
4. Phase 5 error boundaries, then Phase 7 tests
5. P1 performance and AI, then P2
