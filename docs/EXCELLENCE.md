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
5. Conflict resolution — Partial. Version check on edit; the replaced version stays in history; deleted-elsewhere is dropped and counted. Todo: keep-mine / keep-cloud / manual merge screen, three-way comparison, conflict history, notification.
6. Sync engine — Partial. Ordered replay, stops on connection trouble, retry on reconnect and when the app becomes visible. Todo: exponential backoff, per-change status screen, diagnostics, multi-device and large-queue stress tests.

## Phase 3: Security and backend [P0/P1]

7. Authentication — Partial. Todo: expired-session screen, token-refresh recovery test, concurrent sessions, password reset and account deletion verified end to end on a throwaway account (Needs you), re-authentication for sensitive actions (delete account already re-checks the password). Leaked-password protection is a dashboard switch (Needs you).
8. Database security — Partial. Done: owner-only RLS on every table; advisors reviewed; delete_my_account is intentional. Todo: cross-user isolation test against a real second account, search_path hardening review of every function, migration rollback notes.
9. Application security — Partial. Done: CSP trimmed, security headers, dependency audit in CI, AI keys device-only and cleared on sign-out, import size limits. Todo: XSS regression tests, header verification test against the live site, independent penetration test (Needs a third party).
10. Go backend — Not used by the app today. Decision: keep or remove `backend/`.

## Phase 4: AI [P1]

11. Provider reliability — Partial. Done: timeout, cancel, retry with limits for 429 and 5xx, network recovery. Todo: real-provider tests (Needs your keys on your device), token-limit and partial-answer handling.
12. AI question quality — Partial. Schema validation and duplicate detection exist through import. Todo: answer-key and option checks, negation and ambiguity warnings, hallucination-risk notes, human review step, quality summary.
13. AI connection — Partial. Done: per-provider settings, key clearing. Todo: key validation call, connection diagnostics, usage visibility, privacy text.

## Phase 5: Frontend architecture [P1]

14. Architecture — Partial. Done: layer rules enforced by lint, dead-code sweep, stores. Todo: circular-dependency check in CI.
15. TypeScript — Partial. Strict mode on. Todo: audit casts and assertions, runtime validation of database rows.
16. Error management — Partial. Todo: global and per-screen error boundaries, unhandled-rejection reporting, error classification (network, session) with recovery buttons.
17. Maintainability — Partial. Todo: split the largest files where it helps, document decisions.

## Phase 6: Performance [P1]

18 to 21 — Todo. Needs a large-data test bed (10k, 50k, 100k questions) and a low-end Android phone (Needs you). Virtualised lists and bundle budgets are not built.

## Phase 7: Testing [P0/P1]

22. Unit — Partial (462 tests; scoring, scheduling, confidence, backup, offline queue covered).
23. Integration — Partial (SQL checks for RLS, delete account, confidence run in CI). Todo: auth lifecycle, repository tests against a real test database.
24. End-to-end — Todo (no browser end-to-end suite yet; a phone-width smoke test runs in CI).
25. Automated QA — Partial (360/390/430 px smoke). Todo: cross-browser, visual regression, accessibility checks in CI, WCAG audit.

## Phase 8: Learning engine [P2]

26 to 28 — Partial. Insights, confidence calibration, mistake reasons, revision forecast and a daily focus exist. Todo: study allocation, readiness estimate, explanations for recommendations.

## Phase 9: Design system [P2]

29 to 31 — Partial. Tokens, themes, motion and a component kit exist. Todo: contrast verification per theme, touch-target audit, focus restoration and scroll preservation checks, low-end Android check (Needs you).

## Phase 10: Operations [P1]

32. Observability — Partial (error monitoring hook exists). Todo: sync and backup monitoring, alerts.
33. CI/CD — Partial. CI runs format, lint, audit, typecheck, SQL checks, tests, build, smoke. Todo: branch protection (Needs you, GitHub settings), rollback procedure, environment checks.
34. Documentation — Partial. README, STRUCTURE, ROADMAP, AUDIT exist. Todo: backup and restore runbook, offline sync document, security document, release checklist.

## Working order

1. Phase 1 backup V3 gaps (version history, pending changes)
2. Phase 1 and 2: safe sign-out, conflict screen, queue integrity
3. Phase 3: session expiry, security tests
4. Phase 5 error boundaries, then Phase 7 tests
5. P1 performance and AI, then P2
