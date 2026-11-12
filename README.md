# Learivo

Learivo is a private, cloud-synced academic workspace. Every student owns a private question bank, practises from it, sits exams built from it, and sees what to revise next.

## Status

Phase 2 (design system) complete. Phase 3 (foundation) in progress: lint and CI, Go service skeleton, database foundation migration, module registry, app shell, sync skeleton. Accounts, deployment and sign-in are not set up yet.

## Chosen stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4 on design tokens (PWA)
- Backend: Go API service (chi, pgx, sqlc)
- Database and sign-in: Postgres and Auth hosted on Supabase, with row-level security
- Hosting: Cloudflare for the frontend; Fly.io or Google Cloud Run for the Go service (to be confirmed)

## Roadmap

See `docs/ROADMAP.md`.

## Run it

```bash
pnpm install
pnpm dev        # open the Design Lab
pnpm test       # unit and accessibility-contrast tests
pnpm typecheck
pnpm build
```

Docs: `docs/DESIGN_SYSTEM.md` (themes and tokens), `docs/SCREENS.md` (MVP screen specs), `docs/ROADMAP.md`.
