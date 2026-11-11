# Learivo

Learivo is a private, cloud-synced academic workspace. Every student owns a private question bank, practises from it, sits exams built from it, and sees what to revise next.

## Status

Phase 0-1 (discovery and architecture) complete. No application code yet. The product and engineering blueprint is kept as the "Learivo Product and Engineering Blueprint" document and will be mirrored into `docs/`.

## Chosen stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4 on design tokens (PWA)
- Backend: Go API service (chi, pgx, sqlc)
- Database and sign-in: Postgres and Auth hosted on Supabase, with row-level security
- Hosting: Cloudflare for the frontend; Fly.io or Google Cloud Run for the Go service (to be confirmed)

## Roadmap

See `docs/ROADMAP.md`.
