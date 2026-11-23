# Status, verification and open items

Last updated 2026-11-23 (exam subjects). This is the one place that says what is done, what has been proven, and what is still open. Behaviour is in `FEATURES.md`; running and recovery in `OPERATIONS.md` and `RUNBOOK.md`.

## Where the project stands

Learivo is built and live at https://learivo.pages.dev (Cloudflare Pages, Supabase project `vmtbqoqyplsfmxyjcoiy`). The browser talks to Supabase directly under row-level security; there is no separate server. (An early plan for a Go service was dropped: nothing in the repository uses it.) CI runs on every push (jobs `frontend` and `database`), the live site is checked every 6 hours, and a weekly database backup runs from GitHub.

Built and in use: the question bank, practice and exams, review (revision, mistakes, bookmarks, notes, flashcards, glossary), insights, Home with customization, offline use and sync, backup and restore, three themes, the AI prompt maker and optional own-key AI, the introduction page, privacy and terms pages, and the brand assets (social preview, app icons, empty-state and error scenes, install screenshots; see `reports/`).

## How things were checked

- **Run by the assistant, every push:** format, lint, typecheck, unit and component tests (639), build, environment/header check, end-to-end flows in a real browser against in-memory data, accessibility scan (axe, WCAG 2.1 AA) of the landing, sign-in and five signed-in screens in five theme/mode combinations at 360 px, a design audit of screens and dialogs, the exam PDF check (including Bangla text), SQL checks for row-level security and answer rules, and a coverage floor.
- **Reported passed by the owner, not run by the assistant** (no logs or screenshots supplied): offline editing and sync on a real phone, deleting a throwaway account, two accounts that cannot see each other's data, a real AI call with the owner's key, Firefox and Safari, Supabase Site URL and redirect, password-reset email, change email, Google sign-in, Gmail sender, install and offline use on the phone, exam PDF on the phone, a restore drill with the app's backup file, and the introduction page on a phone.
- **Not verified by anyone:** the AI-decides plan with a real AI (the flow is tested with a fake AI only: plan reading, batching, retry, prompts); a timed restore of the full database from the weekly backup on a computer; many students on one database; 100,000 questions on a low-end phone; two real devices editing offline at the same time; the live site's headers seen from outside GitHub's runner; link previews in WhatsApp or Facebook; the install dialog with screenshots; screen-reader use; a penetration test.
- **Local measurements** (not the real project): 50,000 questions and 200,000 answers for one student, list and search under 25 ms, a dump and restore of 250,000 rows matching exactly. Details in `RUNBOOK.md`.

## Decisions on record

- The AI prompts never add tags: only the tags the student enters are used; problems are reported in a NOTE line.
- Leaked-password protection stays off: it needs the Supabase Pro plan. Sign-up still needs 8 or more characters.
- Branch protection on `main` is deliberately off so the assistant can push after CI is green. If turned on, the check names are `frontend` and `database`.
- Gmail sends the auth emails (Supabase warns it is meant for personal mail); move to Brevo or Resend if students report missing emails.
- No image features: questions are text only.
- Question types matching, structured and case-study are parked.

## Open items

- Owner: GitHub Settings > General > Social preview, upload `docs/brand/github-social-preview.png`; optionally set the Google consent-screen logo to `public/brand/brand-logo-240.png`; check the new empty-state scenes and the install icon on a phone.
- A staging Supabase project (the free plan allows two projects).
- Crash reports: Sentry is wired but off until `VITE_SENTRY_DSN` is set; otherwise an own error log is needed.
- A CI run against a local Supabase (today CI uses plain Postgres for the SQL checks).
- An architecture decision log and a recorded restore drill on the real project.
- Offline edits of tags, collections and subjects clash silently (last change wins); only questions have the clash screen.
