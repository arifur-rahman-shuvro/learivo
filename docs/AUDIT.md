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

## Not verified

Real AI provider calls, real account deletion, behaviour on a real phone and real offline mode on a device.
