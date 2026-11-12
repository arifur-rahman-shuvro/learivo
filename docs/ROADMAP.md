# Learivo roadmap

Each phase ends with a written report and owner approval before the next begins.

| Phase | Goal                                                                                                                                                         | Size   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 0-1   | Discovery and architecture (blueprint)                                                                                                                       | M      |
| 2     | Design system and UX: tokens, theme registry (Default, Forest, Space), brand SVGs, component library, screen specs                                           | L      |
| 3     | Foundation: repo, CI, staging and production projects, auth, profiles, row-level-security base, deploy pipeline, app shell, module registry, sync skeleton   | L      |
| 4     | Core Question Bank: six question types, taxonomy, editor, search and filters, bulk actions, history, duplicates, collections, JSON and CSV import and export | XL     |
| 5     | Practice and Exams: practice sessions, exam builder and player, scoring, results; matching, structured and case-study types                                  | XL     |
| 6     | Personal workspace: notebook, bookmarks, revision (FSRS), analytics, planner basics                                                                          | L      |
| 7     | Advanced experience: offline packs, command palette, global search, dashboard customization, Forest and Space decorative layers, performance                 | L      |
| 8     | QA and production: full tests, security review, accessibility, load test, backup and restore drill                                                           | L      |
| 9     | Expansion: optional AI helpers, flashcards, glossary, achievements, sharing if justified                                                                     | varies |

## Rules

- Nothing is called done unless it was actually run and verified.
- No production database change without the exact SQL being shown and approved first.
- Secrets live only in GitHub, Cloudflare, Supabase and host settings, never in the repository.

## Status and deviations (updated 2026-11-12)

| Phase | Status                                                                                    |
| ----- | ----------------------------------------------------------------------------------------- |
| 0-1   | Done (blueprint)                                                                          |
| 2     | Done, and the app shell and Home screen were redesigned afterwards at the owner's request |
| 3     | Done, except the items below. Go service live on Render free (owner-checked 2026-11-12)   |
| 4     | Built and tested; waiting for the owner's phone test and approval (see below)             |
| 5-9   | Not started; each phase waits for the owner's approval                                    |

Phase 3 items not done, with reasons:

- **Go service database connection (pgx).** The service is deployed at learivo-api on Render (free plan). The owner confirmed `/healthz` returns ok and `/v1/me` returns `missing_token` without a token. No route needs the database yet, and the Go package registry is blocked in the build session, so the connection is added with the first database route in Phase 4. Moving to an always-on host is a launch task.
- **Staging Supabase project.** The free plan allows two projects and ShuvroMed uses one. Until launch, migrations are additive, tested locally and in CI, then verified right after applying.
- **Error tracking (Sentry).** Needs an account; add it together with the Go deployment.

Deviations from the blueprint: hash routing instead of TanStack Router, no Radix, Zustand or Dexie yet (each is added when its phase needs it), and the Go service replaces Supabase Edge Functions (sections 3, 4 and 8 of the blueprint still say Edge Functions).

Phase 4 deviations from the blueprint:

- Question create, edit, search and bulk actions go from the browser to Supabase under row-level security, not through the Go service. The Go database connection stays deferred.
- Answers are stored as validated JSON (`answer_spec`) instead of a separate options table.
- Statements and explanations are plain text; rich text comes later.
- Import files are parsed in the browser and inserted in batches of 500. The duplicate policies are Skip and Import anyway; Replace is not built.
- Search uses a generated full-text column (simple dictionary), which handles Bengali.
- Not checked in a real browser session against production: the owner must try the screens at https://learivo.pages.dev.
