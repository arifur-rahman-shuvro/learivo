# Launch readiness

Audit of 2026-11-24. What was checked, what was found, what is still the owner's to do. Behaviour is in `FEATURES.md`, status in `STATUS.md`, running and recovery in `OPERATIONS.md` and `RUNBOOK.md`.

## Checked and passing

| Area                            | Result                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests                           | 653 unit and component tests; coverage gate in CI                                                                                                                                  |
| Real-browser checks             | `pnpm e2e` (14 flows including offline edit and sync), `pnpm a11y` (axe, landing tour and 5 signed-in screens, 5 theme and mode combinations, 360 px), `pnpm design`, `pnpm paper` |
| Database                        | Row-level-security check scripts for every table run in CI against a clean Postgres; Supabase security advisor shows only the two items below                                      |
| Dependencies                    | `pnpm audit`: no known vulnerabilities                                                                                                                                             |
| Secrets                         | Source scan finds no secret keys; `pnpm envcheck` checks the built bundle for secret-looking keys and that only our own Supabase project is referenced                             |
| Headers                         | CSP without `unsafe-inline` scripts, HSTS, nosniff, frame-ancestors none, Permissions-Policy; checked by `pnpm envcheck`                                                           |
| Lighthouse (mobile, built site) | Performance 99, Accessibility 100, Best practices 100, SEO 100 after this audit (SEO was 91: robots.txt was missing and is now added)                                              |
| Installable app                 | Manifest, maskable icon, screenshots, service worker with explicit precache                                                                                                        |
| Visitor pages                   | Landing, Privacy, Terms, robots.txt, sitemap.xml, canonical link, no-JavaScript message                                                                                            |

## Known and accepted

- Supabase advisor "Signed-in users can execute SECURITY DEFINER function" for `delete_my_account()`: intended. It deletes only the caller's own account, and `anon` is revoked.
- Supabase advisor "unused index" (4 small indexes): kept. The tables are small and the indexes back search and foreign-key lookups.
- Leaked-password protection is off because it needs the Supabase Pro plan. Passwords must be 8 or more characters.
- Crash reporting is off until a Sentry DSN is set (see below). Without it, nobody is told when the app breaks for a user.
- Nothing has been seen on a real phone by Claude, and the live site cannot be reached from the build machine. Owner checks below are unverified until you do them.

## Owner actions before telling people

Done on 2026-11-24 or 25: the support email `learivo.official@gmail.com` is in Privacy, Terms, the landing footer, the sign-in page and Settings; the licence is decided (see below); the real-phone pass was done and reported by the owner (not seen by Claude).

1. **Crash reporting (free, 10 minutes, still open):** make a free account at https://sentry.io, create a Browser JavaScript project, copy its DSN, then in Cloudflare Pages open Settings, Environment variables and add `VITE_SENTRY_DSN` with that value for Production, and redeploy. A DSN is not a secret. Reports have names, emails and question text stripped. Until then, problems reach us only through the Report a problem email.
2. **Social preview:** GitHub, Settings, General, Social preview, upload `docs/brand/github-social-preview.png`.
3. **Google sign-in screen:** in Google Cloud, OAuth consent screen, set the app name Learivo, add the Privacy and Terms links (`https://learivo.pages.dev/privacy.html` and `/terms.html`), the support email, and the logo `public/brand/brand-logo-240.png`. Move the app from Testing to In production, otherwise only listed test users can sign in.
4. **Custom domain (optional):** add it in Cloudflare Pages, Custom domains, then tell Claude so the canonical link, sitemap, social tags and Supabase redirect URLs are changed.

## Licence

`LICENSE` says all rights reserved: the code is public to read, not to copy or reuse. This was chosen because Learivo is a product, not a library. To open it up later, replace the file with MIT or similar.

## Road to 9.5

Scores are Claude's own engineering ratings (see `STATUS.md`). A 9.5 needs evidence from real people, which no amount of code can supply, so the list is split by who can move the score.

| Area                 | Was       | Now       | To reach 9.5                                                                                                                            | Who                |
| -------------------- | --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Code quality         | 9         | 9         | Hold the line: every change keeps tests, lint, layer rules and docs green                                                               | Claude             |
| Security and privacy | 8.5       | 9         | Sentry on (step 1). Leaked-password protection needs Supabase Pro, worth it once real users sign up                                     | Owner              |
| Speed                | 9.5       | 9.5       | Already 99 on Lighthouse mobile                                                                                                         | none               |
| Accessibility        | 9         | 9         | Test with TalkBack (Android screen reader) for 15 minutes: open Home, practise one question, open Settings. Report what is read wrongly | Owner              |
| Features             | 8.5       | 9         | Sample questions for a new student (done). Next: only what real students ask for                                                        | Both               |
| Design and UX        | 8         | 8.5       | Real-phone pass done by owner. Next: watch two students use it without help and fix where they stop                                     | Owner, then Claude |
| Reliability and data | 8.5       | 9         | Problem reports now carry technical details (done). Keep a weekly backup habit; use Backup before big imports                           | Owner              |
| Launch readiness     | 7         | 9         | Support email, licence, privacy, robots and sitemap done. Left: Sentry, Google In production                                            | Owner              |
| Market proof         | not rated | not rated | 5 real students use it for a week and send feedback through Send feedback in Settings. Their top three complaints become the next phase | Owner              |

What changed in this phase: support email everywhere, Report a problem and Send feedback (Settings and the error screen, with browser details and the last eight error names, never question text), a LICENSE file, 12 original sample questions a new student can add in one tap (tagged `sample`, easy to delete), and a check that the Bangla exam paper prints correctly.
