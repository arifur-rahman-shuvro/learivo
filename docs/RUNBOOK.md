# Learivo runbook

Plain steps for keeping Learivo safe. Written in Phase 8.

## What protects the data

- Each student's rows are protected by row-level security in the database. Another signed-in student and signed-out visitors can read nothing (checked by the SQL files in `supabase/tests`, run on every push).
- The browser holds only the public project address and the publishable key. No secret is in the repository (scanned in Phase 8).
- A copy of the question bank is kept on the phone for offline use and removed on sign-out.

## Backups

Supabase's own backups depend on the plan, and the plan could not be read from here. As far as I know, the Free plan has no downloadable backups, so check **Supabase dashboard > Database > Backups** and note what it says.

Learivo adds its own weekly encrypted backup, which only starts after you add two secrets:

1. Open https://github.com/arifur-rahman-shuvro/learivo/settings/secrets/actions in your browser and tap **New repository secret**.
2. Name `BACKUP_PASSPHRASE`. Value: a long phrase only you know (12 or more random words). Save it in a password manager; without it a backup cannot be opened.
3. In the Supabase dashboard open **Connect** and copy the **Session pooler** connection string, then replace `[YOUR-PASSWORD]` with the database password (Project settings > Database > Reset database password if you do not have it).
4. Add a second secret named `BACKUP_DB_URL` with that full string.
5. Open https://github.com/arifur-rahman-shuvro/learivo/actions/workflows/backup.yml, tap **Run workflow**, then **Run workflow** again. After about a minute a green run appears with an artifact named `learivo-backup`.

Never paste either secret into a chat.

The file holds private data (including sign-in records), so it is encrypted. Backups are kept for 30 days.

Question content can also be saved at any time from **Questions > Export**. That covers questions only, not practice history.

## Restore (drill passed locally on 2026-11-14; see below)

You need a computer with PostgreSQL 17 tools. Restoring replaces data, so do it into a new, empty Supabase project, check it, and only then point the app at it.

1. Decrypt: `gpg --output learivo.dump --decrypt learivo-DATE.dump.gpg`
2. In the new project's SQL editor run the migration files in `supabase/migrations` in order (they create the tables and protections).
3. Restore the data only: `pg_restore --no-owner --data-only --disable-triggers -d "NEW_CONNECTION_STRING" learivo.dump`
4. Run the checks in `supabase/tests` (`rls_*.sql`) against it, then sign in and look at Questions.
5. Update the two `VITE_SUPABASE_*` values in Cloudflare Pages and redeploy.

## Drill result (local, not on the real project)

A database with 50,000 questions, 8,000 sessions and 200,000 answers was dumped (0.8 s, 14 MB) and restored into an empty database (4.6 s). Row counts matched exactly, all 15 tables kept forced row-level security, all 53 policies, 43 indexes, 10 triggers and 6 functions came back, a signed-out visitor still could not read, and one student still could not see another's rows. The real backup job and a restore from a real Supabase backup have **not** been run.

## Load test (local Postgres, one student with 50,000 questions and 200,000 answers)

| What                          | Before             | After                      |
| ----------------------------- | ------------------ | -------------------------- |
| Question list, filter, search | under 25 ms        | unchanged                  |
| Latest answers for Insights   | 170 ms per page    | 3 ms per page (new index)  |
| Which questions were answered | about 200 requests | one database function (M6) |

In the browser, with 20,000 questions the list opens in about 1.5 s and shows 50 at a time. These numbers are from a local database on this machine; real Supabase adds network time.
