# Operations guide

Written from what is built, not from plans. Anything not yet proven is marked **Not verified**.

## 1. Backup and restore

**Make a backup (student).** Menu > Back up and restore > Download backup. Optionally type a passphrase (8+ characters) to lock the file. A forgotten passphrase cannot be recovered. Keep the file somewhere other than this phone.

**What a backup holds (version 3).** Questions, notes, bookmarks, flashcards, glossary, revision (spaced repetition) state, saved exams, every finished practice and exam session with confidence and mistake reasons, collections with their questions, the Home layout, the exam target and daily goal, and a manifest (record counts and a SHA-256 of the data).

**What it does not hold.** Question version history, saved views and theme choice (kept in the browser, not the account), changes still waiting from offline use, AI keys (never exported).

**Restore.** Menu > Back up and restore > Choose backup file. A locked file asks for its passphrase. The screen shows what would be added and says "Checked" when the file is complete and unchanged. A file that was edited or cut short is refused with the reason, and nothing is restored. Restoring adds what is missing and never overwrites or duplicates, so it is safe to run twice, and safe to run again after an interruption.

**Restore into another account.** Sign in to the other account and restore the same file. Questions are matched by content, so nothing is doubled.

**If the account itself is damaged.** Supabase keeps its own database backups, depending on the plan: check Dashboard > Database > Backups. **Not verified:** a timed restore drill from those backups, and the recovery time.

**Reminder.** The app reminds the student when the last backup is old.

## 2. Offline use and sync

**Needs** the copy of the bank on the device (it downloads when online; status under Saved).

**Works offline.** Reading, searching, practice and exams; adding, editing, archiving, deleting, moving, tagging and collecting questions. Practice sessions are stored and sent later.

**Needs a connection.** Creating, renaming, merging or deleting subjects, tags and collections; backup restore; account changes.

**How changes travel.** Each offline change is applied to the copy at once and added to a short list saved on the device. When online, the list is sent in order. A new question gets its id on the device, so a repeated send never duplicates it. Several edits to one question count as one. If a request fails on a poor connection, the change is kept and retried.

**Clashes.** Before sending an edit the app compares the question with the version the edit started from and the one in the account now. Parts changed on one side only are combined. Parts changed on both sides wait on the Saved screen for a choice (mine, the account's, or field by field). A question deleted elsewhere asks whether to add it back. The last 20 decisions are kept and can be undone.

**Refused changes.** If the database refuses a change (for example a value too long), it is listed with the reason on the Saved screen and the rest carry on.

**Signing out.** Waiting changes are sent first. If some cannot be sent (offline), the student can save them as a file, stay signed in, or discard them. The copy on the device is wiped at sign-out for privacy.

**Limits.** A new question's subject or tags that do not exist yet are linked only after sending. **Not verified:** behaviour with two real devices editing at once, and very long offline periods.

## 3. Security summary

- Every table has row-level security; every policy is for signed-in students and their own rows only; signed-out visitors have no table access. A CI check (supabase/tests/schema_audit_check.sql) fails the build if that changes.
- Functions pin their search path. Only `delete_my_account` runs with owner rights and is callable by a student (it re-checks the password in the app first).
- Page headers: scripts only from this site, no eval, no embedding, HTTPS-only named connections, HSTS, no sniffing. A test checks the header file; the live site's headers were **not verified from the sandbox**.
- Student text is never rendered as HTML; tests fail the build if code that could do so is added.
- AI keys stay on the device only and are removed at sign-out. **Not verified** with real providers.
- Dependencies are audited in CI.
- **Owner switches (Supabase dashboard):** Authentication > leaked-password protection.

## 4. Failure guide

| What the student sees                    | Meaning                                | What to do                                       |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| The connection dropped                   | Network trouble                        | Check internet; changes on the device are safe   |
| Your session has ended                   | Login expired or revoked               | Sign in again; waiting changes are kept          |
| Something went wrong on this screen      | A bug in that screen                   | Try again, then reload; saved data is unaffected |
| N to decide (Saved)                      | Offline edits clash with other changes | Open Saved and choose                            |
| These offline changes could not be saved | The database refused them              | Read the reason, fix and re-enter                |

## 5. Release checklist

1. `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm smoke` all pass locally.
2. Push; wait for CI (format, lint, audit, typecheck, SQL checks including the schema audit, tests, build, smoke) to be green.
3. New migration: add it to the CI list and to `docs/`, apply to production (Supabase), then run the security and performance advisors and read any new warning.
4. Open https://learivo.pages.dev on a phone after Cloudflare finishes; sign in; check Home, Questions, Practice, Saved.
5. Download a backup and open it with "Choose backup file" (look for "Checked").
6. If something is wrong: in Cloudflare Pages > Deployments choose the last good deployment and Rollback. Database changes are not rolled back automatically: write a reverse migration.
