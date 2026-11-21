# Audit, 2026-11-19

Method: read the service worker, offline store and pack, sync, AI provider and key code, backup/restore, security headers and CSP; ran `pnpm audit`, the Supabase security and performance advisors, and the full test/lint/build suite. Nothing here was seen on a real phone.

## Findings and plan

| #   | Area     | Finding                                                                                                  | Severity         | Plan                                                                                     |
| --- | -------- | -------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| 1   | AI       | `askAi` has no overall time limit: a request that never answers hangs until the student presses Stop.    | Medium           | Fix: 90 s limit, with a clear message.                                                   |
| 2   | Security | CSP allows `learivo-api.onrender.com`, which the app never calls.                                        | Low              | Fix: remove it; add `upgrade-insecure-requests`.                                         |
| 3   | Security | `pnpm audit`: moderate `minimatch` issue (dev tool only, via eslint). CI does not audit.                 | Low              | Fix: dependency override, CI audit step at high level.                                   |
| 4   | Offline  | `platform/sync/outbox.ts` is an unused "sync skeleton" that suggests offline editing exists.             | Low              | Fix: delete it and its test.                                                             |
| 5   | Backup   | Backup file is plain JSON; a lost phone or shared Downloads folder exposes questions, notes and history. | Medium           | Fix: optional passphrase encryption (AES-GCM, PBKDF2) on download; restore asks for it.  |
| 6   | Backup   | Restore is additive and idempotent, so a failure part-way can be re-run safely.                          | Info             | No change; documented.                                                                   |
| 7   | Offline  | Question bank edits are refused offline (practice works, with sessions synced later).                    | Design limit     | Not changed: queued offline edits need conflict handling; a wrong merge could lose data. |
| 8   | Security | Supabase "leaked password protection" off; `delete_my_account` callable by signed-in users.              | Owner / intended | Owner toggles the first in the dashboard; the second is intentional.                     |
| 9   | Database | 10 unused foreign-key indexes (INFO).                                                                    | Info             | Keep: tables are small now, and they protect deletes and joins as data grows.            |
| 10  | AI       | Keys sit in browser storage on this device only; cleared on sign-out and clear-device-data.              | Info             | Acceptable with the CSP (`script-src 'self'`).                                           |

## Done in this pass

Findings 1 to 5 are fixed and tested (448 tests, build and phone-width smoke test pass). Findings 6, 9 and 10 need no change. Finding 7 is a deliberate limit; 8 is the owner's dashboard toggle.

## Offline editing (added after the audit)

- Offline you can add, edit, archive, restore-from-queue, delete, classify, tag and add to collections. Changing subjects, tags and collections themselves (rename, delete, merge, add) still needs a connection.
- Needs the copy of the bank on the device (Download copy). Without it an offline add or edit is refused with that reason.
- Changes apply to the copy at once and wait in a list on the device (kept if the app is closed). They are sent in order when you are online. New questions get their id on the device, so a repeated send never duplicates one.
- Several edits to one question count as one. If the question was changed somewhere else meanwhile, your edit wins and the other version stays in that question's history. An edit to a question deleted elsewhere is dropped.
- A change the database refuses is listed under Offline and sync with the reason; the rest carry on.
- A request that fails on a connection that says "online" is kept the same way.
- Limits: a new question's subject or tags that do not exist yet show on the question but are linked only after sending; signing out while offline with unsent changes discards them (the copy is wiped for privacy); a second device edited offline at the same time follows the rule above.

## Not verified

Status as of 2026-11-21. These were not run by the assistant (it has no phone, no second account and no AI key). The owner reports having run them and that they passed:

- Network loss on a real phone (offline editing and sync on a real device)
- Deleting a throwaway account
- Two accounts that cannot see each other's data
- A real AI call with the owner's own key (BYOK)
- Firefox and Safari

"Reported passed by the owner" is the evidence; no logs, screenshots or timings were supplied. Still not verified by anyone: a timed restore from Supabase's own database backup, many students on one database, a real reset email arriving, and 100k questions on a low-end phone.
