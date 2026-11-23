# Learivo

Learivo is a private, cloud-synced question bank and exam app. Each student owns a private bank of questions, practises from it, sits timed exams built from it, and sees what to revise next. It works offline and installs on a phone.

Live: https://learivo.pages.dev

## What it does

Write or import questions (including with an AI prompt maker), practise and sit exams, revise with spaced repetition, keep notes, flashcards and a glossary, and see insights on weak areas. Backup and restore, three themes, and an introduction page for new visitors. The full list is in `docs/FEATURES.md`.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4 on design tokens, installable PWA
- Database and sign-in: Postgres and Auth on Supabase, with row-level security on every table. The browser talks to Supabase directly; there is no separate server
- Hosting: Cloudflare Pages. CI and a weekly database backup: GitHub Actions

## Run it

```bash
pnpm install
pnpm dev            # the app (Supabase address and publishable key go in .env.local, see below)
pnpm test           # unit and component tests
pnpm typecheck && pnpm lint && pnpm build
```

Checks that use a real browser: `pnpm e2e` (end-to-end flows), `pnpm a11y` (axe scan), `pnpm design` (screens and dialogs in every theme at 360 px), `pnpm paper` (exam PDF, including Bangla). `pnpm envcheck` checks the built site's headers and that no secret is in it; `pnpm coverage` enforces the coverage floor.

Environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public values), optional `VITE_SENTRY_DSN`. No secret belongs in the repository.

Brand images are built from code, not edited by hand: `node scripts/brand.mjs` (social preview, app icons, logo files) and `node scripts/pwa-shots.mjs` (install screenshots from the real app).

## Docs

| File                    | What it covers                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `docs/STATUS.md`        | What is done, what has been proven, what is open, decisions on record                |
| `docs/FEATURES.md`      | How each part works and the rules behind it                                          |
| `docs/STRUCTURE.md`     | Where files live and what to edit for a given change                                 |
| `docs/DESIGN_SYSTEM.md` | Themes, tokens, slots, brand and accessibility rules                                 |
| `docs/OPERATIONS.md`    | Backup and restore, sign-in setup, offline behaviour, security, release and rollback |
| `docs/RUNBOOK.md`       | Backup job secrets, restore steps, drill and load-test results                       |
| `docs/MIGRATIONS.md`    | Every database migration and how to undo it                                          |
| `docs/reports/`         | The visual asset audit and production blueprint (PDF and Markdown)                   |
