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

1. **Give a support email.** The Privacy page currently points to the GitHub issues page and "the person who invited you". Send the address you want shown (a new address made just for Learivo is best) and it goes into Privacy and Terms.
2. **Decide a licence for the GitHub repository.** The repo is public and has no licence file, so by default others may read it but not reuse it. Say "all rights reserved" (keep as is) or pick one (MIT is the common open choice).
3. **Turn on crash reporting (optional, free):** make a free account at https://sentry.io, create a Browser JavaScript project, copy its DSN, then in Cloudflare Pages open Settings, Environment variables and add `VITE_SENTRY_DSN` with that value for Production, and redeploy. A DSN is not a secret. Reports have names, emails and question text stripped.
4. **Upload the social preview:** GitHub, Settings, General, Social preview, upload `docs/brand/github-social-preview.png`.
5. **Google sign-in screen:** in Google Cloud, OAuth consent screen, set the app name Learivo, add the Privacy and Terms links (`https://learivo.pages.dev/privacy.html` and `/terms.html`), and the logo `public/brand/brand-logo-240.png`. Move the app from Testing to In production, otherwise only listed test users can sign in.
6. **Custom domain (optional):** if you buy one, add it in Cloudflare Pages, Custom domains, then tell Claude so the canonical link, sitemap, social tags and Supabase redirect URLs are changed.
7. **Real-phone pass (15 minutes):** on your Android phone, open the live site signed out, sign up, add 3 questions, practise, install to the home screen, turn on aeroplane mode and practise again, then turn it off and check it syncs.
