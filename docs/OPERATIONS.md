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

## 1b. Forgot password

Sign in screen > **Forgot password?** > email > **Send reset link**. The screen says "If <email> has an account, we sent a link" for any address, so it never reveals who has an account. The emailed link opens the app on a **Choose a new password** screen (8+ characters, typed twice); nothing else is shown until a new password is saved. **Cancel** signs out. An expired or already-used link shows a notice on the sign-in screen asking for a new one.

Needs in Supabase (Dashboard > Authentication > URL Configuration): Site URL `https://learivo.pages.dev`, and the same address in Redirect URLs, or the link will not bring the student back to the app. Supabase's built-in email sender is limited to a few emails an hour; for many students set up your own sender (Authentication > SMTP Settings). **Not verified:** a real email being delivered and the link opened on a phone (needs the owner's real email); the screens and the link handling are covered by tests, the email itself is not.

## 1c. Google sign-in and sending email from your own Gmail

**Google sign-in.** The sign-in and create-account screens show **Continue with Google** only when Supabase says the Google provider is on (the app asks `/auth/v1/settings`), so nothing breaks before it is set up and nothing needs rebuilding after. An email account and a Google account with the same verified email become one account in Supabase. An account made with Google has no password: Account > **Add a password** lets it add one, and deleting it asks for the email address instead of a password.

Set up (owner, once): Google Cloud Console > create a project > APIs & Services > OAuth consent screen (External, app name Learivo, your support email) > Credentials > Create credentials > OAuth client ID > Web application > Authorized redirect URI `https://vmtbqoqyplsfmxyjcoiy.supabase.co/auth/v1/callback`. Then Supabase > Authentication > Sign In / Providers > Google > paste the client ID and secret there (never in chat) > Save. Publish the consent screen ("In production") or only listed test users can sign in.

**Email from your own Gmail (instead of Supabase's sender).** Dashboard only, no code change: Supabase > Authentication > Emails > SMTP Settings > enable custom SMTP: host `smtp.gmail.com`, port 465, username the Gmail address, password a Google **App Password** (Google Account > Security > 2-Step Verification on > App passwords), sender email the same Gmail address, sender name Learivo. Limits: Gmail allows roughly 500 messages a day and may mark mass mail as spam; Google may refuse the sender address if it differs from the login. For a real launch a sender on your own domain (Resend, Brevo) is more reliable. The app code does not change either way.

**Not verified:** a real Google sign-in round trip and a real email from Gmail (needs the owner's Google project and Gmail). Covered by tests: the button appears only when Google is on, signing in, the Google-only account rules, the screens in all themes.

## 2. Offline use and sync

**Needs** the copy of the bank on the device (it downloads when online; status under Saved).

**Works offline.** Reading, searching, practice and exams; adding, editing, archiving, deleting, moving, tagging and collecting questions. Practice sessions are stored and sent later.

**Needs a connection.** Creating, renaming, merging or deleting subjects, tags and collections; backup restore; account changes.

**How changes travel.** Each offline change is applied to the copy at once and added to a short list saved on the device. When online, the list is sent in order. A new question gets its id on the device, so a repeated send never duplicates it. Several edits to one question count as one. If a request fails on a poor connection, the change is kept and retried.

**Clashes.** Before sending an edit the app compares the question with the version the edit started from and the one in the account now. Parts changed on one side only are combined. Parts changed on both sides wait on the Saved screen for a choice (mine, the account's, or field by field). A question deleted elsewhere asks whether to add it back. The last 20 decisions are kept and can be undone.

**Refused changes.** If the database refuses a change (for example a value too long), it is listed with the reason on the Saved screen and the rest carry on.

**Signing out.** Waiting changes are sent first. If some cannot be sent (offline), the student can save them as a file, stay signed in, or discard them. The copy on the device is wiped at sign-out for privacy.

**Limits.** A new question's subject or tags that do not exist yet are linked only after sending. The owner reports network loss on a real phone passed (2026-11-21, not run by the assistant). **Not verified:** two real devices editing at once, and very long offline periods.

## 3. Security summary

- Every table has row-level security; every policy is for signed-in students and their own rows only; signed-out visitors have no table access. A CI check (supabase/tests/schema_audit_check.sql) fails the build if that changes.
- Functions pin their search path. Only `delete_my_account` runs with owner rights and is callable by a student (it re-checks the password in the app first).
- Page headers: scripts only from this site, no eval, no embedding, HTTPS-only named connections, HSTS, no sniffing. A test checks the header file; the live site's headers were **not verified from the sandbox**.
- Student text is never rendered as HTML; tests fail the build if code that could do so is added.
- AI keys stay on the device only and are removed at sign-out. The owner reports a real call with their own key passed (2026-11-21, not run by the assistant); other providers are untested.
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

## 6. Monitoring and alerts

- **Build check** (`pnpm envcheck`, in CI): the built site has the headers file with the CSP, HSTS and nosniff rules, mentions only our own database project, and contains no secret key, token, connection string or AI key. A planted fake key and a wrong project were both caught when tried.
- **Live site check** (`.github/workflows/live-check.yml`, `scripts/livecheck.mjs`): every 6 hours, and after each successful CI run, GitHub's runner opens the real site and checks it answers, has the security headers, serves the service worker uncached, and that the database sign-in service is up and refuses a signed-out reader. A red run means something is wrong; GitHub emails the repository owner (Settings > Notifications must allow Actions emails).
- **Weekly database backup** (`backup.yml`): red until the owner adds the two secrets described in RUNBOOK.md.
- **Crash and failure reports:** go to Sentry only when a DSN is set at build time (it is not set yet). Reported: unexpected screen crashes, unhandled failures, a refused offline change (only its kind), unreadable saved changes, a backup that could not be created, a restore that stopped part way. Never reported: question text, notes, the database's message, the student's identity.
- **Not monitored:** how long syncs take, how many students have waiting changes (nothing is collected from devices), database size and load (see the Supabase dashboard), email alerts from Sentry (needs a DSN and an alert rule).

## 7. Rollback in detail

1. Site: Cloudflare Pages > the learivo project > Deployments > pick the last deployment that worked > Rollback. Takes about a minute. Students get the older version after their next reload (the service worker checks for updates).
2. Code: `git revert <commit>` and push; CI deploys the revert.
3. Database: migrations are not undone automatically. Write a new migration that reverses the change, apply it, and run the SQL checks and advisors. Take a backup before any risky migration.
4. Data lost by a mistake: restore a student's backup file (section 1), or the Supabase database backup (plan dependent, drill not yet done).
