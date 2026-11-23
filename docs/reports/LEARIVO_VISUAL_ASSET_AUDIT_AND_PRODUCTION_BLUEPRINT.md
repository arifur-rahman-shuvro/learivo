# LEARIVO: Visual Asset Audit and Production Blueprint

Audit and planning document. Nothing in this document has been built, generated or committed as an asset. Repository: github.com/arifur-rahman-shuvro/learivo, branch main, commit feac177 plus this report. Date of audit: 22 November 2026.

**How to read this document.** Statements marked _Verified_ come from reading the repository or looking at real rendered screens. Statements marked _Recommendation_ are proposals. Nothing is claimed to exist unless it is in the repository.

## Contents

1. Executive Summary
2. Full Application Audit Findings
3. Existing Visual System Analysis
4. Visual Problems and Opportunities
5. Complete Required Asset Inventory
6. Individual Asset Specifications
7. All Image Generation Prompts
8. All SVG Creation Specifications
9. All Video Generation Prompts
10. Animation Requirements
11. GitHub Asset Directory Architecture
12. Exact Filenames and Upload Locations
13. Master Asset Manifest
14. Technical Specifications
15. Implementation Mapping
16. Prioritized Implementation Roadmap
17. Performance and Optimization Guidelines
18. Final Recommendations

## 1. Executive Summary

Learivo is a private, cloud-synced question bank and exam app (React 19, TypeScript, Vite, Supabase, Cloudflare Pages). Its visual system is already coherent: a token-driven theme engine (three themes, light and dark), one type family per theme, a single stroke-icon style and a small set of purpose-built SVG slots. **The repository contains zero raster images inside the app** (no `<img>`, no `.png`, `.jpg` or `.webp` referenced from `src/`); everything on screen is SVG, CSS or font.

That is a strength, and it shapes the recommendation: **Learivo needs very few assets, not many.** After inspecting every screen state that exists, this blueprint recommends **20 assets**: 1 P0, 3 P1, 15 P2 and 1 P3. 10 are SVG and 10 are PNG. No video, no Lottie, no 3D and no photography are recommended, and the reasons are given in sections 9 and 10.

The four findings that matter most:

1. **Shared links have no preview.** `index.html` has no description, Open Graph or Twitter tags, and no social image exists (LV-001, P0).
2. **First-run and success moments are visually flat.** The first thing a new student sees on Questions is a small icon in a grey circle; "You are all caught up" and error screens have no art (LV-002, LV-003, LV-004, P1).
3. **The install icons are heavy.** Three icon PNGs (329 KB) are in the service-worker precache and the maskable icon adds 244 KB, for a flat two-colour tile that should be about 60 KB in total (LV-005 to LV-008, P2).
4. **A hidden trap in the folder plan.** `public/_headers` serves `/assets/*` as immutable for one year, and Vite writes its hashed build files to `/assets/`. A hand-named file placed in `public/assets/` would be cached for a year and could never be updated. This blueprint therefore does not use `public/assets/` (section 11).

**Most of the work needs no image-generation model.** Icons, logos and screenshots are exported or captured deterministically from the real app; the empty-state SVGs can be authored in code. Generation prompts are supplied for all of them as requested, but the only file where a generative model adds value is the social preview background (LV-001), and even there the text must be added in code.

**What to do first:** see section 18 for the exact order. In short: LV-001, then LV-002, LV-003, LV-004.

**Limits of this audit (honest).** Phone-width screenshots were captured for every main screen with data and empty. Desktop screenshots were captured for the empty screens, Questions with data, Practice with data, the player and the Add hub; desktop Home, Review, Insights and Results with data were not captured because the capture script stopped on an ambiguous button. The signed-out landing page and the sign-in screen were audited from code and from the owner's phone test, not from a screenshot taken by me. Dark, Forest and Space themes were audited from their token files and slot code, not screenshotted in this pass (the existing design audit script checks them for contrast).

## 2. Full Application Audit Findings

### 2.1 Architecture and routes (Verified)

- Single-page app, hash routing. Five primary modules registered in `src/shell/navigation/registry.ts`: Home `#/home`, Questions `#/questions`, Practice `#/practice`, Review `#/review`, Insights `#/insights`.
- Signed-out entry points: Landing (`src/landing/Landing.tsx`, lazy-loaded), sign-in and create-account (`src/auth/AuthScreen.tsx`), password reset (`src/auth/SetNewPassword.tsx`), static `public/privacy.html` and `public/terms.html`.
- Layer rules (ESLint): core, motion < ui-kit, auth, help, landing < modules < platform, account < shell.
- Offline: a service worker (`public/sw.js`) precaches the build listed in `asset-manifest.json`, which `vite.config.ts` writes from the bundle plus exactly seven public files (`/`, manifest, favicon, theme-init, icon-192, icon-512, apple-touch-icon).

### 2.2 Screens and states inspected

| Screen / state                | Evidence                                                                             | Visual treatment today (Verified)                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Home, first run               | m-empty-home.png, d-empty-home.png                                                   | Text hero, static example question card, stat tiles, Get started checklist, Daily goal ring. No illustration.                         |
| Home, with data               | m-data-home.png                                                                      | Revision card with a 7-day bar forecast, four stat tiles, All features grid of 21 line icons.                                         |
| Questions, empty              | m-empty-questions.png, d-fail.png                                                    | EmptyState with a 36 px icon in an 80 px grey circle.                                                                                 |
| Questions, with data          | m-data-questions.png, d-data-questions.png                                           | List rows, filters; no imagery.                                                                                                       |
| Add hub and Import            | m-dlg-addhub.png, m-dlg-import.png, d-dlg-addhub.png                                 | Dialog with small icon tiles.                                                                                                         |
| Practice, empty and with data | m-empty-practice.png, m-data-practice.png, d-empty-practice.png, d-data-practice.png | Mode cards; 'No exams yet' uses a small icon.                                                                                         |
| Player                        | m-player.png, d-player.png                                                           | Question card, option radios, Flag / Save / Note actions; no imagery (intentional, and the owner has ruled out image-based features). |
| Results                       | m-results.png                                                                        | Progress ring, stat grid, By subject list. No celebration or reward graphic.                                                          |
| Review, empty                 | m-empty-review.png                                                                   | 'You are all caught up' with a check icon in a grey circle.                                                                           |
| Insights, empty               | m-empty-insights.png                                                                 | Three-bar icon in a grey circle.                                                                                                      |
| Loading                       | src/ui-kit/feedback/Skeletons.tsx, Spinner.tsx                                       | Pulsing grey skeleton blocks (disabled under reduced motion) and a themed spinner slot.                                               |
| Error                         | src/ui-kit/feedback/ErrorBoundary.tsx                                                | Text and a Try again button. No art.                                                                                                  |
| Landing                       | src/landing/*.tsx, landing.css                                                       | Headline plus interactive code demos (TryQuestion, ConfidenceMatrix, PaceDemo, PaperPreview). No image or illustration.               |
| Sign in / create account      | src/auth/AuthScreen.tsx                                                              | Wordmark, theme background, a small inline Google glyph. No hero art.                                                                 |
| Onboarding                    | src/modules/workspace/ui/HomeWelcome.tsx                                             | A three-step 'Get started' checklist card. There is no multi-screen onboarding flow, so none is proposed.                             |

### 2.3 Asset loading facts (Verified)

| Fact                                                                                                                                                                                              | Source                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Raster images referenced from src/: none                                                                                                                                                          | grep of src for img, png, jpg, webp, svg references returned nothing |
| Files in public/: favicon.svg 0.5 KB, icon-192 39.5 KB, icon-512 254.7 KB, icon-maskable-512 244.2 KB, apple-touch-icon 35 KB, manifest, sw.js, privacy.html, terms.html, theme-init.js, _headers | ls -la public                                                        |
| Build output is 2.3 MB; 24 files in dist/assets; icons in public total 568 KB in dist                                                                                                             | du on dist                                                           |
| Five Latin-only variable fonts, 184 KB total (Inter, Fraunces, Nunito Sans, Space Grotesk, JetBrains Mono)                                                                                        | src/ui-kit/themes/fonts                                              |
| Content-Security-Policy img-src is 'self' data: blob:, so images must be self-hosted                                                                                                              | public/_headers                                                      |
| /assets/* is cached immutable for one year; /sw.js, /manifest.webmanifest and /asset-manifest.json are no-cache                                                                                   | public/_headers                                                      |
| index.html has no meta description, Open Graph or Twitter tags; only charset, viewport, theme-color, icon, manifest and apple-touch-icon                                                          | index.html                                                           |
| manifest.webmanifest has three icons, theme_color #4f46e5, background_color #f7f7fb, and no screenshots                                                                                           | public/manifest.webmanifest                                          |

### 2.4 Inconsistencies found (Verified)

- Three icon sources coexist: ten named icons in `src/ui-kit/icons/icons.tsx`, twenty-one feature icons in `src/help/FeatureIcon.tsx`, and inline `<svg>` blocks in 13 component files. All use the same 1.75 px round stroke, so they look consistent, but they are not one library.
- Empty states: of 13 `<EmptyState>` uses, 8 pass a small icon (grey circle) and 5 fall back to the per-theme `EmptyArt`. The themed art is therefore seen only on Flashcards, Glossary and two internal states; the most common empty screens do not show it.
- The in-app logo mark follows the theme accent (`var(--lv-accent)`), while the favicon and app icons are fixed indigo-to-teal. They match in the default theme (accent #4F46E5, chart-2 #0E7490) and are intentionally fixed for the home-screen icon.
- The default theme has no `Background` slot (it uses a CSS gradient), Forest and Space draw SVG scenery. This is deliberate, not a defect.

## 3. Existing Visual System Analysis

| Aspect                 | What exists (Verified)                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colour (Default light) | bg #F8F9FC, surface-1 #FFFFFF, surface-2 #F1F3F9, surface-3 #E6E9F3, text #12142B, muted #4B5173, accent #4F46E5, border #D5D9EA, strong border #7A81A6, success #15803D, warning #B45309, danger #B91C1C, chart-2 #0E7490.                                                                      |
| Backgrounds            | Default: two soft radial glows (indigo top-left, sky top-right) from `pageBackground`. Forest: grain texture plus SVG hills and drifting leaves. Space: dark with stars and a planet.                                                                                                            |
| Typography             | Default: Inter Variable for heading and body, JetBrains Mono for numbers. Forest: Fraunces and Nunito Sans. Space: Space Grotesk. All self-hosted, Latin only.                                                                                                                                   |
| Radius and depth       | Card radius 16 px, control radius 10 px, pill 999 px, 1 px borders, two-layer soft shadows (rgb(18 20 43 / 6 %)).                                                                                                                                                                                |
| Component language     | White cards on a tinted page, bold sentence-case titles, indigo filled primary buttons, outlined secondary buttons, rounded segmented tabs, floating pill bottom navigation on phones and a left sidebar on desktop.                                                                             |
| Illustration style     | Flat shapes with 1.5 to 3 px round-cap strokes; one accent shape; no gradients; theme motifs (sprout in Forest, planet in Space). 120 x 96 box for empty art.                                                                                                                                    |
| Icon style             | 24 px grid, 1.75 px stroke, round caps and joins, `currentColor`.                                                                                                                                                                                                                                |
| Animation language     | Short, functional. Keyframes in `src/motion/motion.css`: lv-spin 0.9 s, lv-sway, lv-orbit, lv-drift 22 s, lv-fade-in, lv-rise-in, lv-grow-y, lv-pop, toast-in/out, item-in, menu-in. Easing cubic-bezier(0.2, 0.7, 0.2, 1); 120 ms fast, 220 ms base. All disabled under prefers-reduced-motion. |
| Brand mark             | A bookmark-ribbon upright with a notched end, forming an L with a foot, and a path node: three shapes in a 64 x 64 box.                                                                                                                                                                          |

**Conclusion.** The identity is calm, premium and editorial. Every proposed asset follows one art direction:

> Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.

## 4. Visual Problems and Opportunities

| #   | Type                         | Finding                                                                                        | Fix                                                                     | Asset            |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------- |
| 1   | Problem (Verified)           | Shared Learivo links show a bare URL; no social preview exists.                                | Social image and meta tags                                              | LV-001           |
| 2   | Problem (Verified)           | First empty screen is a grey circle plus a tiny icon.                                          | Scene illustration                                                      | LV-002           |
| 3   | Opportunity (Verified)       | Nothing-due success state has no reward.                                                       | Scene illustration                                                      | LV-003           |
| 4   | Problem (Verified)           | Error boundary is text only.                                                                   | Calm error illustration                                                 | LV-004           |
| 5   | Problem (Verified)           | Icons 568 KB; icon-512 is 11 % of the build for a flat tile.                                   | Re-export and compress                                                  | LV-005 to LV-008 |
| 6   | Gap (Verified)               | Manifest has no screenshots; install dialog is minimal.                                        | Captured screenshots                                                    | LV-014 to LV-016 |
| 7   | Gap (Verified)               | Mark exists only as React code; no standalone logo files for README, email or consent screens. | Export brand files                                                      | LV-017 to LV-019 |
| 8   | Opportunity (Verified)       | Results screen shows numbers and a ring only.                                                  | **Code, not an asset**: a short CSS reward on a high score (section 10) | none             |
| 9   | Opportunity (Recommendation) | Five card-based empties share generic art.                                                     | Four more scenes                                                        | LV-009 to LV-013 |
| 10  | Not a problem                | Landing page has no imagery but has four interactive demos.                                    | Keep as is: demos explain the product better than pictures              | none             |
| 11  | Not a problem                | Player and question screens have no imagery.                                                   | Keep as is; the owner ruled out image-based features                    | none             |

**Deliberately not recommended:** a hero photo or illustration for the landing page, onboarding carousels (there is no such flow), a 404 page (unknown routes fall back to Home), splash screens (Android builds one from the icon and background colour), dark-mode duplicates of any file (SVGs recolour through tokens), team or student photos, medical imagery.

## 5. Complete Required Asset Inventory

Total **20** assets in six categories. Categories with no asset are listed so that it is clear they were considered.

| Category                                 | Assets                       | Decision                                                              |
| ---------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| Social and brand rasters                 | LV-001, LV-019, LV-020       | Needed (sharing, third-party screens, repo)                           |
| PWA icons (existing files, re-exported)  | LV-005 to LV-008             | Replace for size, no redesign                                         |
| PWA screenshots                          | LV-014 to LV-016             | Captured from the real app                                            |
| Brand SVG masters                        | LV-017, LV-018               | Needed outside React                                                  |
| Illustrations (SVG, theme-coloured)      | LV-002, 003, 004, 009 to 013 | Needed for empty and error states                                     |
| Photography, textures, patterns, 3D      | none                         | Not needed; would add weight and break the flat identity              |
| Video, Lottie, animated WebP/GIF         | none                         | Not needed (sections 9 and 10)                                        |
| Fonts                                    | none                         | Already self-hosted, Latin only                                       |
| Icons                                    | none new                     | 21 feature icons and 10 nav icons exist; consolidation is a code task |
| Onboarding, dashboard and feature images | none                         | No such flows or surfaces exist; the dashboard is data, not imagery   |

### Essentials versus optional

**Essential (P0 and P1):** LV-001 og-default.png, LV-002 empty-questions.svg, LV-003 empty-caught-up.svg, LV-004 error-boundary.svg.

**Optional (P2 and P3):** the other 16 assets. Nothing in the app breaks without them.

## 6. Individual Asset Specifications

### LV-001: og-default.png

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-001                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Asset Name               | og-default.png                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Asset Type               | Raster image (social preview)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Priority                 | P0 Essential                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Application Location     | Not shown inside the app. Shown by WhatsApp, Facebook, Telegram, X and search engines when the Learivo link is shared.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Current Problem          | Verified: index.html has no description, og:title, og:image or twitter:card tags (0 matches), and the repo has no such image, so a shared link shows a bare URL.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Purpose                  | Give every shared link of the landing page a recognisable, trustworthy preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Visual Description       | Left two-thirds: soft off-white field with the Learivo mark on the indigo-to-teal app tile and the line 'Practise the way the exam asks.' set large in Inter bold (text added in code, not by the image model). Right third: a simplified, flat, token-coloured question card with four option rows, one highlighted in indigo.                                                                                                                                                                                                                                                 |
| Composition              | Subject: brand tile + headline + simplified question card. Background: #F8F9FC with the same two soft radial glows as the app (indigo top-left at 14 %, sky top-right at 10 %). Perspective: flat, straight on. Positioning: text block left-aligned at x=80, vertically centred; card right, 440 px wide, rotated 0 degrees. Lighting: none; card uses the app's card shadow (0 4 14 rgba(18,20,43,.06)). Colours: #4F46E5, #0E7490, #12142B, #4B5173, #FFFFFF. Hierarchy: headline first, card second, tile third. Negative space: 80 px safe margin all round. Ratio 1.91:1. |
| Technical Specifications | 1200 x 630 px, PNG, 8-bit palette (quantised) or optimised truecolour, no transparency, solid #F8F9FC base, max 250 KB (WhatsApp ignores images over about 300 KB). One variant only (no mobile or dark version: previews are cropped by the platforms).                                                                                                                                                                                                                                                                                                                        |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-001                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Upload Instructions      | File: og-default.png. Directory: public/social/ (new directory). Relative path: public/social/og-default.png (served at /social/og-default.png). Replaces existing: no. Must NOT go in public/assets/ (see section 11).                                                                                                                                                                                                                                                                                                                                                         |
| Implementation Mapping   | index.html (head: og:image, og:title, og:description, twitter:card, meta description, absolute URL https://learivo.pages.dev/social/og-default.png). Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                         |
| Expected Impact          | Every shared link gets a preview instead of a bare URL; most visible gain for the landing page. Fixes the only metadata gap found.                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Generation Prompt (production-ready):**

```text
Flat editorial brand card, 1200x630, for a private study question-bank app called Learivo. Off-white background #F8F9FC with two very soft radial glows (indigo top-left, sky-blue top-right). Left side: leave a clean empty text area 640 px wide (the headline is added later in code, do not render any text). Right side: a flat rounded-rectangle question card, white, 440x330, thin #D5D9EA outline, soft shadow, containing a short grey line (the question) and four rounded option rows with a small circle at the left of each; the second row is highlighted with an indigo #4F46E5 outline and a filled indigo circle. Top-left corner area reserved for the app icon (add later). Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Calm, premium, editorial. Composition balanced left-heavy, generous negative space.
```

### LV-002: empty-questions.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-002                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Asset Name               | empty-questions.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Priority                 | P1 High value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Application Location     | Questions screen (src/modules/question-bank/ui/QuestionsScreen.tsx line 308), No-questions state in src/App.tsx line 122, and the first-run card on Home.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Current Problem          | Verified in screenshots: the first empty state a new user sees is a 20 x 20 grey circle with a small icon; there is no illustration (EmptyState draws the themed art only when no icon is passed).                                                                                                                                                                                                                                                                                                                                                                                                               |
| Purpose                  | Make the very first empty screen feel designed and say what will live here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Visual Description       | A stack of three white-on-grey question cards fanned slightly, with a small indigo '+' badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Composition              | Subject: a short stack of three rounded question cards, the top one showing two grey text lines and a small accent circle with a plus sign at its upper-right corner. Centred in the box with 12 px clear margin. Flat view, no perspective. Lighting: none (flat). Colours: fills var(--lv-surface-2) and var(--lv-surface-3), lines var(--lv-border-strong), one accent shape var(--lv-accent), at most one small var(--lv-chart-2) detail. Hierarchy: the accent shape is the only saturated element and sits upper-right, like the existing EmptyArt. Negative space: at least 25 % empty. Aspect ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).                                                                                                                                                                                                       |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-002                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Upload Instructions      | File: empty-questions.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. After upload it is converted to an inline component (the master stays here); no change to any file now.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Implementation Mapping   | QuestionsScreen.tsx (EmptyState at line 308, icon prop), src/App.tsx (line 122), src/ui-kit/feedback/EmptyState.tsx, src/ui-kit/themes/slots.tsx. Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Expected Impact          | First-run is the first impression after sign-up; replaces a grey circle with a scene that says 'cards go here'.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a short stack of three rounded question cards, the top one showing two grey text lines and a small accent circle with a plus sign at its upper-right corner. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

### LV-003: empty-caught-up.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-003                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Asset Name               | empty-caught-up.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Priority                 | P1 High value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Application Location     | Review screen 'You are all caught up' (src/modules/workspace/ui/ReviewParts.tsx line 72) and 'No mistakes to review' (ReviewScreen.tsx line 244).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Current Problem          | Verified in m-empty-review.png: a grey circle with a check; the success moment has no visual reward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Purpose                  | Reward finishing the revision queue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Visual Description       | A clipboard card with a large indigo check and three tiny confetti dots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Composition              | Subject: a rounded clipboard card with a large accent check mark and two short grey lines, with three small dots above it like a quiet celebration. Centred in the box with 12 px clear margin. Flat view, no perspective. Lighting: none (flat). Colours: fills var(--lv-surface-2) and var(--lv-surface-3), lines var(--lv-border-strong), one accent shape var(--lv-accent), at most one small var(--lv-chart-2) detail. Hierarchy: the accent shape is the only saturated element and sits upper-right, like the existing EmptyArt. Negative space: at least 25 % empty. Aspect ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).                                                                                                                                                                                     |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-003                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Upload Instructions      | File: empty-caught-up.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. After upload it is converted to an inline component (the master stays here); no change to any file now.                                                                                                                                                                                                                                                                                                                                                                                |
| Implementation Mapping   | ReviewParts.tsx (line 72), ReviewScreen.tsx (line 244), EmptyState.tsx. Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Expected Impact          | A positive moment (nothing due) currently looks the same as an error-free blank; a small reward reinforces the habit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a rounded clipboard card with a large accent check mark and two short grey lines, with three small dots above it like a quiet celebration. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

### LV-004: error-boundary.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-004                                                                                                                                                                                                                                                                                                        |
| Asset Name               | error-boundary.svg                                                                                                                                                                                                                                                                                            |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                     |
| Priority                 | P1 High value                                                                                                                                                                                                                                                                                                 |
| Application Location     | Screen that appears when a part of the app crashes (error boundary with a 'Try again' button).                                                                                                                                                                                                                |
| Current Problem          | Verified: src/ui-kit/feedback/ErrorBoundary.tsx renders text and a button only; a crash shows a plain text card with no visual cue.                                                                                                                                                                           |
| Purpose                  | Make a crash look intentional and calm, so a student is not alarmed and knows to press Try again.                                                                                                                                                                                                             |
| Visual Description       | A rounded card whose top-right corner is gently folded, with a small circular arrow in accent indigo and two short grey lines. Uses the danger colour for one 6 px dot only.                                                                                                                                  |
| Composition              | Subject: a card with a folded corner and a refresh arrow. Centred, 12 px margin. Flat view. No lighting. Colours: var(--lv-surface-2), var(--lv-border-strong), var(--lv-accent) for the arrow, var(--lv-danger) for a single small dot. Hierarchy: the arrow leads. Negative space at least 30 %. Ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, transparent, inline SVG, max 2 KB, one variant, no animation.                                                                                                                                                                                                                             |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-004                                                                                                                                                                                                                                                             |
| Upload Instructions      | File: error-boundary.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. Converted to an inline component after upload.                                                                                                                                                         |
| Implementation Mapping   | src/ui-kit/feedback/ErrorBoundary.tsx. Do not modify now.                                                                                                                                                                                                                                                     |
| Expected Impact          | A crash is the worst moment of the app; calm art plus the existing 'Try again' lowers panic.                                                                                                                                                                                                                  |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an app error screen. Scene: a rounded document card with a softly folded top-right corner, two short grey text lines, and a circular refresh arrow in the accent colour overlapping the lower-right edge; one tiny 6 px dot in var(--lv-danger). Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-danger). Stroke 1.75, round caps and joins. aria-hidden="true". Output only the SVG markup.
```

### LV-005: icon-192.png

| Field                    | Specification                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-005                                                                                                                                                               |
| Asset Name               | icon-192.png                                                                                                                                                         |
| Asset Type               | Raster image (PWA icon, re-export)                                                                                                                                   |
| Priority                 | P2 Useful                                                                                                                                                            |
| Application Location     | Android home screen, install prompt, app switcher. Also cached by the service worker at install.                                                                     |
| Current Problem          | Verified: public/icon-192.png is 39.5 KB for a flat two-colour tile. It is listed in dist/asset-manifest.json, so it is downloaded and cached at install.            |
| Purpose                  | Same picture, far fewer bytes.                                                                                                                                       |
| Visual Description       | Unchanged: the current Learivo tile (white ribbon-L and node on the indigo-to-teal gradient, rounded square).                                                        |
| Composition              | Identical to the current file. Rounded-square tile radius 25 % (16/64), gradient #4F46E5 to #0E7490 at 135 degrees, white mark. Ratio 1:1. Do not change the design. |
| Technical Specifications | 192 x 192, PNG, RGBA with transparent corners, quantised palette or oxipng-optimised, target 8 KB or less. One variant.                                              |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-005                                                                                                                    |
| Upload Instructions      | File: icon-192.png. Directory: public/. Relative path: public/icon-192.png. Replaces existing: yes (same name, same dimensions).                                     |
| Implementation Mapping   | public/manifest.webmanifest (already references it). Do not modify now.                                                                                              |
| Expected Impact          | Saves about 30 KB at install; no visual change.                                                                                                                      |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Re-export deterministically: render src/ui-kit/brand/Logo.tsx LogoMark(tile) at 192 px with a headless browser or sharp from public/favicon.svg, then run oxipng or pngquant. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

### LV-006: icon-512.png

| Field                    | Specification                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-006                                                                                                                                       |
| Asset Name               | icon-512.png                                                                                                                                 |
| Asset Type               | Raster image (PWA icon, re-export)                                                                                                           |
| Priority                 | P2 Useful                                                                                                                                    |
| Application Location     | Install splash, store-style listings, home screen on high-density phones. Cached at install.                                                 |
| Current Problem          | Verified: public/icon-512.png is 254.7 KB, the largest single file in public/ and about 11 % of the whole 2.3 MB build, and it is precached. |
| Purpose                  | Same picture, about a tenth of the bytes.                                                                                                    |
| Visual Description       | Unchanged tile (viewed: white ribbon-L, node, indigo-to-teal gradient, rounded corners).                                                     |
| Composition              | Identical to the current file. Do not change the design.                                                                                     |
| Technical Specifications | 512 x 512, PNG, RGBA, transparent corners, quantised, target 25 KB or less. One variant.                                                     |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-006                                                                                            |
| Upload Instructions      | File: icon-512.png. Directory: public/. Relative path: public/icon-512.png. Replaces existing: yes.                                          |
| Implementation Mapping   | public/manifest.webmanifest. Do not modify now.                                                                                              |
| Expected Impact          | Saves about 230 KB of the install download (about 10 % of the build).                                                                        |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Re-export from public/favicon.svg at 512 px, then oxipng or pngquant (256 colours is enough for a two-stop gradient). Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

### LV-007: icon-maskable-512.png

| Field                    | Specification                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-007                                                                                                                                                                                              |
| Asset Name               | icon-maskable-512.png                                                                                                                                                                               |
| Asset Type               | Raster image (PWA maskable icon, re-export)                                                                                                                                                         |
| Priority                 | P2 Useful                                                                                                                                                                                           |
| Application Location     | Android adaptive icon (circle, squircle or teardrop masks).                                                                                                                                         |
| Current Problem          | Verified: public/icon-maskable-512.png is 244.2 KB, opaque RGB. It is not in the precache list, but it is fetched on install by Android.                                                            |
| Purpose                  | Same picture, smaller; keep the mark inside the maskable safe zone.                                                                                                                                 |
| Visual Description       | Full-bleed indigo-to-teal gradient square with the white ribbon-L and node centred inside the central 80 % circle.                                                                                  |
| Composition              | Full-bleed square, no transparent corners. Mark scaled so its bounding box sits inside a circle of 410 px diameter (80 % safe zone) centred at 256,256. Gradient #4F46E5 to #0E7490 at 135 degrees. |
| Technical Specifications | 512 x 512, PNG, no transparency (RGB), quantised, target 20 KB or less. One variant.                                                                                                                |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-007                                                                                                                                                   |
| Upload Instructions      | File: icon-maskable-512.png. Directory: public/. Relative path: public/icon-maskable-512.png. Replaces existing: yes.                                                                               |
| Implementation Mapping   | public/manifest.webmanifest. Do not modify now.                                                                                                                                                     |
| Expected Impact          | Saves about 220 KB for Android installs; no visual change.                                                                                                                                          |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Export from the SVG mark with the mark scaled to the 80 % safe zone on a full-bleed gradient square, then oxipng. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

### LV-008: apple-touch-icon.png

| Field                    | Specification                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-008                                                                                                              |
| Asset Name               | apple-touch-icon.png                                                                                                |
| Asset Type               | Raster image (iOS home-screen icon, re-export)                                                                      |
| Priority                 | P2 Useful                                                                                                           |
| Application Location     | iPhone and iPad 'Add to Home Screen'. Cached at install.                                                            |
| Current Problem          | Verified: 35 KB, RGBA; iOS ignores transparency and fills it with black.                                            |
| Purpose                  | Same picture, smaller, and opaque so iOS never draws black corners.                                                 |
| Visual Description       | Full-bleed indigo-to-teal square (iOS rounds it) with the white mark centred at 70 % of the width.                  |
| Composition              | Full-bleed square, no transparency, mark centred, gradient #4F46E5 to #0E7490 at 135 degrees.                       |
| Technical Specifications | 180 x 180, PNG, opaque RGB, target 8 KB or less. One variant.                                                       |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-008                                                                   |
| Upload Instructions      | File: apple-touch-icon.png. Directory: public/. Relative path: public/apple-touch-icon.png. Replaces existing: yes. |
| Implementation Mapping   | index.html (link rel=apple-touch-icon). Do not modify now.                                                          |
| Expected Impact          | Saves about 27 KB; removes the risk of black corners on iOS.                                                        |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Export from the SVG mark at 180 px on a full-bleed gradient square, then oxipng. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

### LV-009: empty-insights.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-009                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Asset Name               | empty-insights.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Priority                 | P2 Useful                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Application Location     | Insights screen empty state (src/modules/workspace/ui/InsightsScreen.tsx line 129).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Current Problem          | Verified in m-empty-insights.png: a grey circle with three tiny bars.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Purpose                  | Preview the shape of the finished screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Visual Description       | A chart card with three bars, the middle one in indigo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Composition              | Subject: a rounded chart card with three short vertical bars (the middle one highlighted in the accent) and a dashed baseline. Centred in the box with 12 px clear margin. Flat view, no perspective. Lighting: none (flat). Colours: fills var(--lv-surface-2) and var(--lv-surface-3), lines var(--lv-border-strong), one accent shape var(--lv-accent), at most one small var(--lv-chart-2) detail. Hierarchy: the accent shape is the only saturated element and sits upper-right, like the existing EmptyArt. Negative space: at least 25 % empty. Aspect ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).                                                                                                                                                                |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-009                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Upload Instructions      | File: empty-insights.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. After upload it is converted to an inline component (the master stays here); no change to any file now.                                                                                                                                                                                                                                                                                                                                                            |
| Implementation Mapping   | InsightsScreen.tsx (line 129), EmptyState.tsx. Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Expected Impact          | Shows what Insights will look like once data exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a rounded chart card with three short vertical bars (the middle one highlighted in the accent) and a dashed baseline. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

### LV-010: empty-search.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-010                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Asset Name               | empty-search.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Priority                 | P2 Useful                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Application Location     | 'No questions match' (QuestionsScreen.tsx line 332).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Current Problem          | Verified in code: the filtered-empty state reuses a small search icon in a circle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Purpose                  | Tell the student their filter found nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Visual Description       | A magnifier over an empty dashed card.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Composition              | Subject: a large rounded magnifying glass with an empty rounded card behind it and a small dashed outline where a result would be. Centred in the box with 12 px clear margin. Flat view, no perspective. Lighting: none (flat). Colours: fills var(--lv-surface-2) and var(--lv-surface-3), lines var(--lv-border-strong), one accent shape var(--lv-accent), at most one small var(--lv-chart-2) detail. Hierarchy: the accent shape is the only saturated element and sits upper-right, like the existing EmptyArt. Negative space: at least 25 % empty. Aspect ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).                                                                                                                                                                    |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-010                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Upload Instructions      | File: empty-search.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. After upload it is converted to an inline component (the master stays here); no change to any file now.                                                                                                                                                                                                                                                                                                                                                                  |
| Implementation Mapping   | QuestionsScreen.tsx (line 332), EmptyState.tsx. Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Expected Impact          | Clarifies that the filters, not the bank, are empty.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a large rounded magnifying glass with an empty rounded card behind it and a small dashed outline where a result would be. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

### LV-011: empty-saved.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-011                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Asset Name               | empty-saved.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Priority                 | P2 Useful                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Application Location     | 'No bookmarks yet' (ReviewScreen.tsx line 295) and 'No notes yet' (ReviewScreen.tsx line 339).                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Current Problem          | Verified in code: both use a small icon in a grey circle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Purpose                  | Explain what bookmarks and notes are for, in one picture, with the brand ribbon.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Visual Description       | A notched bookmark ribbon beside a small note card.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Composition              | Subject: a bookmark ribbon (the same notched ribbon as the Learivo mark) standing beside a small note card with two grey lines. Centred in the box with 12 px clear margin. Flat view, no perspective. Lighting: none (flat). Colours: fills var(--lv-surface-2) and var(--lv-surface-3), lines var(--lv-border-strong), one accent shape var(--lv-accent), at most one small var(--lv-chart-2) detail. Hierarchy: the accent shape is the only saturated element and sits upper-right, like the existing EmptyArt. Negative space: at least 25 % empty. Aspect ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).                                                                                                                                                                 |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-011                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Upload Instructions      | File: empty-saved.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. After upload it is converted to an inline component (the master stays here); no change to any file now.                                                                                                                                                                                                                                                                                                                                                                |
| Implementation Mapping   | ReviewScreen.tsx (lines 295 and 339), EmptyState.tsx. Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Expected Impact          | Two different empty states share the same grey icon style.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a bookmark ribbon (the same notched ribbon as the Learivo mark) standing beside a small note card with two grey lines. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

### LV-012: empty-exams.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-012                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Asset Name               | empty-exams.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Priority                 | P2 Useful                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Application Location     | 'No exams yet' on Practice (src/modules/practice/ui/PracticeHome.tsx line 389).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Current Problem          | Verified in code: a small play icon in a grey circle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Purpose                  | Hint at timed exams.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Visual Description       | A paper with a clock badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Composition              | Subject: a rounded exam paper with three grey lines and a small round clock face in the accent colour overlapping its top-right corner. Centred in the box with 12 px clear margin. Flat view, no perspective. Lighting: none (flat). Colours: fills var(--lv-surface-2) and var(--lv-surface-3), lines var(--lv-border-strong), one accent shape var(--lv-accent), at most one small var(--lv-chart-2) detail. Hierarchy: the accent shape is the only saturated element and sits upper-right, like the existing EmptyArt. Negative space: at least 25 % empty. Aspect ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).                                                                                                                                                                         |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-012                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Upload Instructions      | File: empty-exams.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. After upload it is converted to an inline component (the master stays here); no change to any file now.                                                                                                                                                                                                                                                                                                                                                                        |
| Implementation Mapping   | PracticeHome.tsx (line 389), EmptyState.tsx. Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Expected Impact          | Ties the empty state to the timed-exam feature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a rounded exam paper with three grey lines and a small round clock face in the accent colour overlapping its top-right corner. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

### LV-013: empty-flashcards.svg

| Field                    | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-013                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Asset Name               | empty-flashcards.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Asset Type               | SVG illustration (inline, theme-coloured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Priority                 | P2 Useful                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Application Location     | Flashcards ('No flashcards yet', FlashcardsPanel.tsx line 75; 'No cards due', line 84) and Glossary ('Your glossary is empty', GlossaryPanel.tsx line 57).                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Current Problem          | Verified in code: no icon prop on these three EmptyState calls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Purpose                  | Make the card-based features recognisable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Visual Description       | Two stacked cards, the front with a question-mark shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Composition              | Subject: two overlapping rounded cards, the front one showing a short grey line and a small accent question mark shape made from a curve and a dot. Centred in the box with 12 px clear margin. Flat view, no perspective. Lighting: none (flat). Colours: fills var(--lv-surface-2) and var(--lv-surface-3), lines var(--lv-border-strong), one accent shape var(--lv-accent), at most one small var(--lv-chart-2) detail. Hierarchy: the accent shape is the only saturated element and sits upper-right, like the existing EmptyArt. Negative space: at least 25 % empty. Aspect ratio 5:4. |
| Technical Specifications | viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).                                                                                                                                                                                     |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-013                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Upload Instructions      | File: empty-flashcards.svg. Directory: src/assets/illustrations/ (new directory). Replaces existing: no. After upload it is converted to an inline component (the master stays here); no change to any file now.                                                                                                                                                                                                                                                                                                                                                                               |
| Implementation Mapping   | FlashcardsPanel.tsx (lines 75 and 84), GlossaryPanel.tsx (line 57), EmptyState.tsx. Do not modify now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Expected Impact          | These three states have no icon, so they fall back to the generic themed art, which does not say 'cards'.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Generation Prompt (production-ready):**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: two overlapping rounded cards, the front one showing a short grey line and a small accent question mark shape made from a curve and a dot. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

### LV-014: pwa-home-narrow.png

| Field                    | Specification                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-014                                                                                                                                   |
| Asset Name               | pwa-home-narrow.png                                                                                                                      |
| Asset Type               | Raster image (screenshot, captured)                                                                                                      |
| Priority                 | P2 Useful                                                                                                                                |
| Application Location     | Android install sheet ('richer install UI') once added to the manifest.                                                                  |
| Current Problem          | Verified: public/manifest.webmanifest has no screenshots array, so Chrome shows the minimal install prompt.                              |
| Purpose                  | Show what the app looks like before installing.                                                                                          |
| Visual Description       | The real Home screen with data (Today card, stats, All features) on a phone, light mode, default theme.                                  |
| Composition              | Captured, not designed: real UI, seeded sample data in English, default theme, light mode, status area cropped. No device frame.         |
| Technical Specifications | 1080 x 1920, PNG, quantised, max 200 KB. Same aspect ratio for all narrow shots. One variant.                                            |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-014                                                                                        |
| Upload Instructions      | File: pwa-home-narrow.png. Directory: public/pwa/ (new directory). Relative path: public/pwa/pwa-home-narrow.png. Replaces existing: no. |
| Implementation Mapping   | public/manifest.webmanifest (new 'screenshots' entries). Do not modify now.                                                              |
| Expected Impact          | Richer Android install dialog; small conversion gain on a private tool.                                                                  |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Capture with Playwright at viewport 360x640, deviceScaleFactor 3, against the e2e harness with seeded questions (scripts/design.mjs seeds the same data), then pngquant. Never use fabricated or AI-generated screens.
```

### LV-015: pwa-practice-narrow.png

| Field                    | Specification                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-015                                                                                                                           |
| Asset Name               | pwa-practice-narrow.png                                                                                                          |
| Asset Type               | Raster image (screenshot, captured)                                                                                              |
| Priority                 | P2 Useful                                                                                                                        |
| Application Location     | Android install sheet.                                                                                                           |
| Current Problem          | Same as LV-014: no manifest screenshots.                                                                                         |
| Purpose                  | Show the practice player, the core experience.                                                                                   |
| Visual Description       | The real practice player with one question and four options on a phone, light mode, default theme.                               |
| Composition              | Captured, not designed: real UI, English sample question, default theme, light mode.                                             |
| Technical Specifications | 1080 x 1920, PNG, quantised, max 200 KB. One variant.                                                                            |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-015                                                                                |
| Upload Instructions      | File: pwa-practice-narrow.png. Directory: public/pwa/. Relative path: public/pwa/pwa-practice-narrow.png. Replaces existing: no. |
| Implementation Mapping   | public/manifest.webmanifest. Do not modify now.                                                                                  |
| Expected Impact          | Same as LV-014.                                                                                                                  |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Capture the Player screen with Playwright at 360x640 @3x with a non-medical-sensitive sample question, then pngquant.
```

### LV-016: pwa-home-wide.png

| Field                    | Specification                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-016                                                                                                               |
| Asset Name               | pwa-home-wide.png                                                                                                    |
| Asset Type               | Raster image (screenshot, captured)                                                                                  |
| Priority                 | P2 Useful                                                                                                            |
| Application Location     | Desktop Chrome install dialog.                                                                                       |
| Current Problem          | Same as LV-014.                                                                                                      |
| Purpose                  | Show the desktop layout (sidebar + dashboard).                                                                       |
| Visual Description       | The real desktop Home with data, light mode, default theme.                                                          |
| Composition              | Captured: 1280x720 viewport at deviceScaleFactor 1.5.                                                                |
| Technical Specifications | 1920 x 1080, PNG, quantised, max 260 KB. One variant.                                                                |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-016                                                                    |
| Upload Instructions      | File: pwa-home-wide.png. Directory: public/pwa/. Relative path: public/pwa/pwa-home-wide.png. Replaces existing: no. |
| Implementation Mapping   | public/manifest.webmanifest. Do not modify now.                                                                      |
| Expected Impact          | Richer desktop install dialog.                                                                                       |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Capture the desktop Home with Playwright, then pngquant.
```

### LV-017: logo-mark.svg

| Field                    | Specification                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asset ID                 | LV-017                                                                                                                                                                         |
| Asset Name               | logo-mark.svg                                                                                                                                                                  |
| Asset Type               | SVG (brand master)                                                                                                                                                             |
| Priority                 | P2 Useful                                                                                                                                                                      |
| Application Location     | README, press and email use; any place outside React that needs the mark.                                                                                                      |
| Current Problem          | Verified: the mark exists only as React code (src/ui-kit/brand/Logo.tsx) and as public/favicon.svg with a gradient tile; there is no standalone, tile-less file in one colour. |
| Purpose                  | A single canonical mark file for non-React uses.                                                                                                                               |
| Visual Description       | The ribbon-L with notch and the path node, in a single flat indigo #4F46E5, no tile.                                                                                           |
| Composition              | Exact paths from Logo.tsx: M17 10h10v30l-5-5-5 5z; M17 44h30a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z; circle cx47 cy22 r6. Fill #4F46E5. Transparent.                  |
| Technical Specifications | viewBox 0 0 64 64, SVG, transparent, max 0.5 KB, one variant.                                                                                                                  |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-017                                                                                                                              |
| Upload Instructions      | File: logo-mark.svg. Directory: public/brand/ (new directory). Relative path: public/brand/logo-mark.svg. Replaces existing: no.                                               |
| Implementation Mapping   | No component uses it; Logo.tsx stays the in-app source. Do not modify now.                                                                                                     |
| Expected Impact          | One source of truth for external uses.                                                                                                                                         |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Copy the three shapes from src/ui-kit/brand/Logo.tsx into a standalone SVG with fill #4F46E5. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

### LV-018: logo-lockup.svg

| Field                    | Specification                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-018                                                                                                                                             |
| Asset Name               | logo-lockup.svg                                                                                                                                    |
| Asset Type               | SVG (brand master)                                                                                                                                 |
| Priority                 | P2 Useful                                                                                                                                          |
| Application Location     | README header, email header, documents.                                                                                                            |
| Current Problem          | Verified: the wordmark exists only as React markup (LogoWordmark in Logo.tsx: mark + 'learivo' in the heading font, bold, letter-spacing -0.02em). |
| Purpose                  | A horizontal lockup file for non-React uses.                                                                                                       |
| Visual Description       | Mark at left, lowercase 'learivo' in Inter bold to its right, both ink #12142B and indigo #4F46E5 as in the app.                                   |
| Composition              | Mark 36 px at x=0; wordmark baseline-aligned, font-size 26 px, converted to outlines so the file does not depend on a font.                        |
| Technical Specifications | viewBox 0 0 140 48, SVG, text converted to paths, transparent, max 10 KB, one variant.                                                             |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-018                                                                                                  |
| Upload Instructions      | File: logo-lockup.svg. Directory: public/brand/. Relative path: public/brand/logo-lockup.svg. Replaces existing: no.                               |
| Implementation Mapping   | None in the app. Do not modify now.                                                                                                                |
| Expected Impact          | Consistent brand in README and emails.                                                                                                             |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Compose from LV-017 plus the word 'learivo' set in Inter Bold (the font already in src/ui-kit/themes/fonts) converted to outlines. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

### LV-019: brand-logo-240.png

| Field                    | Specification                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-019                                                                                                                                                                                            |
| Asset Name               | brand-logo-240.png                                                                                                                                                                                |
| Asset Type               | Raster image (brand logo for third-party screens)                                                                                                                                                 |
| Priority                 | P2 Useful                                                                                                                                                                                         |
| Application Location     | Places outside the app that ask for a logo: the Google sign-in consent screen branding page and (if the owner customises them) Supabase email templates.                                          |
| Current Problem          | The owner completed Google branding earlier; what logo was uploaded is not recorded in the repo, so this is unverified. Email templates are not in the repo either.                               |
| Purpose                  | A correct, small square logo for those third-party screens.                                                                                                                                       |
| Visual Description       | The Learivo tile (indigo-to-teal gradient, white mark), rounded corners.                                                                                                                          |
| Composition              | Same tile as icon-192, exported at 240 px.                                                                                                                                                        |
| Technical Specifications | 240 x 240, PNG, RGBA, max 15 KB (Google accepts up to 1 MB and wants 120 x 120 minimum, square). One variant.                                                                                     |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-019                                                                                                                                                 |
| Upload Instructions      | File: brand-logo-240.png. Directory: public/brand/. Relative path: public/brand/brand-logo-240.png (served at /brand/brand-logo-240.png, usable as an image URL in email). Replaces existing: no. |
| Implementation Mapping   | None in the app; used in Google Cloud and Supabase dashboards. Do not modify now.                                                                                                                 |
| Expected Impact          | Consistent branding on screens users see before signing in.                                                                                                                                       |

**Generation Prompt (production-ready):**

```text
Not an image-model job. Export from public/favicon.svg at 240 px, then oxipng.
```

### LV-020: github-social-preview.png

| Field                    | Specification                                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID                 | LV-020                                                                                                                                                                                                                                    |
| Asset Name               | github-social-preview.png                                                                                                                                                                                                                 |
| Asset Type               | Raster image (repository social card)                                                                                                                                                                                                     |
| Priority                 | P3 Optional                                                                                                                                                                                                                               |
| Application Location     | GitHub repository settings, Social preview (the repo is public).                                                                                                                                                                          |
| Current Problem          | The public repo shows GitHub's default card when linked.                                                                                                                                                                                  |
| Purpose                  | Professional repo link preview.                                                                                                                                                                                                           |
| Visual Description       | Same composition as LV-001 at 2:1, with the Learivo lockup and no headline.                                                                                                                                                               |
| Composition              | Background #F8F9FC, lockup centred, small question card right. Ratio 2:1.                                                                                                                                                                 |
| Technical Specifications | 1280 x 640, PNG, max 250 KB (GitHub limit 1 MB), no transparency, 1 variant.                                                                                                                                                              |
| Generation Prompt        | See section 7 (images) or section 8 (SVG): LV-020                                                                                                                                                                                         |
| Upload Instructions      | File: github-social-preview.png. Directory: docs/brand/ (new directory, not served by the app). Relative path: docs/brand/github-social-preview.png. Replaces existing: no. Then upload it in GitHub repository Settings, Social preview. |
| Implementation Mapping   | None in the app. Do not modify now.                                                                                                                                                                                                       |
| Expected Impact          | Cosmetic; only for people who open the repo.                                                                                                                                                                                              |

**Generation Prompt (production-ready):**

```text
Flat brand card 1280x640 for a study app called Learivo: off-white #F8F9FC background with soft indigo and sky radial glows, empty centre-left area for the logo lockup (added later, no text rendered), flat question card at right. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

## 7. All Image Generation Prompts

Shared art direction for every prompt:

```text
Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

Only LV-001 and LV-020 genuinely need an image-generation model. The icons, logos and screenshots below are exported or captured from the real app: using a generative model for them would change the brand mark, so they carry the instruction "Not an image-model job". Text is never rendered by the model; it is added in code.

#### ASSET: LV-001 og-default.png

**FORMAT:** PNG

**RESOLUTION:** 1200 x 630 (1.91:1)

**GENERATION PROMPT:**

```text
Flat editorial brand card, 1200x630, for a private study question-bank app called Learivo. Off-white background #F8F9FC with two very soft radial glows (indigo top-left, sky-blue top-right). Left side: leave a clean empty text area 640 px wide (the headline is added later in code, do not render any text). Right side: a flat rounded-rectangle question card, white, 440x330, thin #D5D9EA outline, soft shadow, containing a short grey line (the question) and four rounded option rows with a small circle at the left of each; the second row is highlighted with an indigo #4F46E5 outline and a filled indigo circle. Top-left corner area reserved for the app icon (add later). Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Calm, premium, editorial. Composition balanced left-heavy, generous negative space.
```

**NEGATIVE PROMPT:**

```text
no text or letters rendered by the model, no people, no faces, no stock-photo look, no 3D render, no glossy or neon effects, no purple-to-pink gradients, no watermarks, no logos other than the supplied Learivo mark, no clutter, no medical imagery, no text on the card, no lorem ipsum, no hands, no laptop or phone mock-up
```

**OUTPUT REQUIREMENTS:** 1200 x 630 px, PNG, 8-bit palette (quantised) or optimised truecolour, no transparency, solid #F8F9FC base, max 250 KB (WhatsApp ignores images over about 300 KB). One variant only (no mobile or dark version: previews are cropped by the platforms).

#### ASSET: LV-005 icon-192.png

**FORMAT:** PNG

**RESOLUTION:** 192 x 192

**GENERATION PROMPT:**

```text
Not an image-model job. Re-export deterministically: render src/ui-kit/brand/Logo.tsx LogoMark(tile) at 192 px with a headless browser or sharp from public/favicon.svg, then run oxipng or pngquant. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

**NEGATIVE PROMPT:**

```text
Do not redraw or restyle the mark, do not add padding or a shadow, do not use an image model for this file.
```

**OUTPUT REQUIREMENTS:** 192 x 192, PNG, RGBA with transparent corners, quantised palette or oxipng-optimised, target 8 KB or less. One variant.

#### ASSET: LV-006 icon-512.png

**FORMAT:** PNG

**RESOLUTION:** 512 x 512

**GENERATION PROMPT:**

```text
Not an image-model job. Re-export from public/favicon.svg at 512 px, then oxipng or pngquant (256 colours is enough for a two-stop gradient). Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

**NEGATIVE PROMPT:**

```text
Do not redraw the mark, do not add noise or texture, do not use an image model.
```

**OUTPUT REQUIREMENTS:** 512 x 512, PNG, RGBA, transparent corners, quantised, target 25 KB or less. One variant.

#### ASSET: LV-007 icon-maskable-512.png

**FORMAT:** PNG

**RESOLUTION:** 512 x 512

**GENERATION PROMPT:**

```text
Not an image-model job. Export from the SVG mark with the mark scaled to the 80 % safe zone on a full-bleed gradient square, then oxipng. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

**NEGATIVE PROMPT:**

```text
Do not round the corners, do not let the mark touch the safe-zone edge, do not use an image model.
```

**OUTPUT REQUIREMENTS:** 512 x 512, PNG, no transparency (RGB), quantised, target 20 KB or less. One variant.

#### ASSET: LV-008 apple-touch-icon.png

**FORMAT:** PNG

**RESOLUTION:** 180 x 180

**GENERATION PROMPT:**

```text
Not an image-model job. Export from the SVG mark at 180 px on a full-bleed gradient square, then oxipng. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

**NEGATIVE PROMPT:**

```text
Do not add rounded corners or transparency, do not use an image model.
```

**OUTPUT REQUIREMENTS:** 180 x 180, PNG, opaque RGB, target 8 KB or less. One variant.

#### ASSET: LV-014 pwa-home-narrow.png

**FORMAT:** PNG

**RESOLUTION:** 1080 x 1920 (9:16)

**GENERATION PROMPT:**

```text
Not an image-model job. Capture with Playwright at viewport 360x640, deviceScaleFactor 3, against the e2e harness with seeded questions (scripts/design.mjs seeds the same data), then pngquant. Never use fabricated or AI-generated screens.
```

**NEGATIVE PROMPT:**

```text
No device frame, no real student data, no fake UI, no AI-generated screens.
```

**OUTPUT REQUIREMENTS:** 1080 x 1920, PNG, quantised, max 200 KB. Same aspect ratio for all narrow shots. One variant.

#### ASSET: LV-015 pwa-practice-narrow.png

**FORMAT:** PNG

**RESOLUTION:** 1080 x 1920 (9:16)

**GENERATION PROMPT:**

```text
Not an image-model job. Capture the Player screen with Playwright at 360x640 @3x with a non-medical-sensitive sample question, then pngquant.
```

**NEGATIVE PROMPT:**

```text
No device frame, no real data, no AI-generated screens.
```

**OUTPUT REQUIREMENTS:** 1080 x 1920, PNG, quantised, max 200 KB. One variant.

#### ASSET: LV-016 pwa-home-wide.png

**FORMAT:** PNG

**RESOLUTION:** 1920 x 1080 (16:9)

**GENERATION PROMPT:**

```text
Not an image-model job. Capture the desktop Home with Playwright, then pngquant.
```

**NEGATIVE PROMPT:**

```text
No browser chrome, no real data, no AI-generated screens.
```

**OUTPUT REQUIREMENTS:** 1920 x 1080, PNG, quantised, max 260 KB. One variant.

#### ASSET: LV-019 brand-logo-240.png

**FORMAT:** PNG

**RESOLUTION:** 240 x 240 (1:1)

**GENERATION PROMPT:**

```text
Not an image-model job. Export from public/favicon.svg at 240 px, then oxipng.
```

**NEGATIVE PROMPT:**

```text
Do not redraw the mark, do not add text.
```

**OUTPUT REQUIREMENTS:** 240 x 240, PNG, RGBA, max 15 KB (Google accepts up to 1 MB and wants 120 x 120 minimum, square). One variant.

#### ASSET: LV-020 github-social-preview.png

**FORMAT:** PNG

**RESOLUTION:** 1280 x 640 (2:1)

**GENERATION PROMPT:**

```text
Flat brand card 1280x640 for a study app called Learivo: off-white #F8F9FC background with soft indigo and sky radial glows, empty centre-left area for the logo lockup (added later, no text rendered), flat question card at right. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

**NEGATIVE PROMPT:**

```text
no text or letters rendered by the model, no people, no faces, no stock-photo look, no 3D render, no glossy or neon effects, no purple-to-pink gradients, no watermarks, no logos other than the supplied Learivo mark, no clutter, no medical imagery
```

**OUTPUT REQUIREMENTS:** 1280 x 640, PNG, max 250 KB (GitHub limit 1 MB), no transparency, 1 variant.

## 8. All SVG Creation Specifications

SVG illustrations use theme variables, so each file works in light, dark, Forest and Space without variants. They must be delivered as plain SVG markup using only the listed `var(--lv-*)` values; they will be converted to inline components at implementation time (an `<img>` tag cannot read CSS variables).

Common rules: `viewBox="0 0 120 96"`, no width or height attributes beyond the viewBox, `aria-hidden="true"`, stroke 1.75, `stroke-linecap="round"`, `stroke-linejoin="round"`, no `<style>`, no `<defs>` gradients, max 40 shapes, max 2.5 KB.

#### ASSET: LV-002 empty-questions.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a short stack of three rounded question cards, the top one showing two grey text lines and a small accent circle with a plus sign at its upper-right corner. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).

#### ASSET: LV-003 empty-caught-up.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a rounded clipboard card with a large accent check mark and two short grey lines, with three small dots above it like a quiet celebration. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).

#### ASSET: LV-004 error-boundary.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an app error screen. Scene: a rounded document card with a softly folded top-right corner, two short grey text lines, and a circular refresh arrow in the accent colour overlapping the lower-right edge; one tiny 6 px dot in var(--lv-danger). Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-danger). Stroke 1.75, round caps and joins. aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px, no warning triangles, no exclamation marks, no broken-glass or red alarm imagery
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, transparent, inline SVG, max 2 KB, one variant, no animation.

#### ASSET: LV-009 empty-insights.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a rounded chart card with three short vertical bars (the middle one highlighted in the accent) and a dashed baseline. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).

#### ASSET: LV-010 empty-search.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a large rounded magnifying glass with an empty rounded card behind it and a small dashed outline where a result would be. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).

#### ASSET: LV-011 empty-saved.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a bookmark ribbon (the same notched ribbon as the Learivo mark) standing beside a small note card with two grey lines. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).

#### ASSET: LV-012 empty-exams.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: a rounded exam paper with three grey lines and a small round clock face in the accent colour overlapping its top-right corner. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).

#### ASSET: LV-013 empty-flashcards.svg

**FORMAT:** SVG, 120 x 96 viewBox (5:4)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Create a single flat SVG illustration, viewBox 0 0 120 96, transparent background, for an empty state in a study app. Scene: two overlapping rounded cards, the front one showing a short grey line and a small accent question mark shape made from a curve and a dot. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork. Use only these paint values: var(--lv-surface-2), var(--lv-surface-3), var(--lv-border-strong), var(--lv-accent), var(--lv-chart-2). Stroke 1.75, stroke-linecap round, stroke-linejoin round. Mark the SVG aria-hidden="true". Output only the SVG markup.
```

**NEGATIVE PROMPT:**

```text
no text or letters, no gradients, no shadows, no filters, no blur, no raster images embedded, no people, no faces, no anatomy, no hard-coded colours (use var(--lv-*) only), no clip-paths or masks, no more than 40 path/shape elements, no stroke wider than 2.5 px
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 120 96, width 120, height 96 (drop-in size of the current EmptyArt). Transparent background. Inline SVG so CSS variables recolour it for light, dark, Forest and Space. Max 2.5 KB minified. One variant only (scales to 90 % on screens under 360 px by CSS, no second file). No animation (an optional 220 ms rise-in uses the existing lv-rise-in keyframe, disabled under reduced motion).

#### ASSET: LV-017 logo-mark.svg

**FORMAT:** SVG, 64 x 64 viewBox (1:1)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Not an image-model job. Copy the three shapes from src/ui-kit/brand/Logo.tsx into a standalone SVG with fill #4F46E5. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

**NEGATIVE PROMPT:**

```text
Do not redraw, simplify or restyle the mark.
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 64 64, SVG, transparent, max 0.5 KB, one variant.

#### ASSET: LV-018 logo-lockup.svg

**FORMAT:** SVG, 140 x 48 viewBox (2.9:1)

**RESOLUTION:** vector; displays at 120 x 96 CSS px (90 % under 360 px width)

**GENERATION PROMPT:**

```text
Not an image-model job. Compose from LV-017 plus the word 'learivo' set in Inter Bold (the font already in src/ui-kit/themes/fonts) converted to outlines. Learivo art direction: calm, premium, editorial. Flat geometric shapes with 1.75 px round-cap, round-join line work (the same stroke as the app's icons), soft rounded rectangles (radius 12-16), one accent (indigo #4F46E5) with one secondary (teal #0E7490), neutral surfaces (#F1F3F9, #E6E9F3, line #D5D9EA, strong line #7A81A6), ink #12142B. No gradients except the app-icon tile gradient (indigo to teal), no drop shadows, no 3D, no photos, no people or faces, no anatomy or clinical imagery, no text inside artwork.
```

**NEGATIVE PROMPT:**

```text
Do not use another typeface, do not add a tagline, do not add effects.
```

**OUTPUT REQUIREMENTS:** viewBox 0 0 140 48, SVG, text converted to paths, transparent, max 10 KB, one variant.

## 9. All Video Generation Prompts

**No video is recommended.** Reasons (Verified or computed from the repo):

1. The landing page already teaches the product with four interactive demos built in code (`src/landing/demos.tsx`); a video would explain less and could not be tried.
2. Learivo is an offline-first PWA. A hero video would either be missing offline or enlarge the install download, and the 2.3 MB build has no room for a multi-megabyte file.
3. Student phones in the target market often run on limited mobile data; autoplay video is the most expensive asset type for the least learning value.
4. Motion needed by the product (revision forecast bars, progress ring, toasts) is already CSS and respects reduced motion.

There are therefore no video generation prompts. If a future marketing need appears (for example a store listing), record the real app with the screen recorder on a phone; do not generate synthetic UI.

## 10. Animation Requirements

**No animated asset files** (Lottie, GIF, animated WebP, APNG) are recommended. All motion stays in CSS, using the existing keyframes and tokens (`--lv-motion-fast` 120 ms, `--lv-motion-base` 220 ms, `--lv-ease`).

| Moment                               | Recommendation (code, not an asset)                                        | Duration              | Reduced motion   |
| ------------------------------------ | -------------------------------------------------------------------------- | --------------------- | ---------------- |
| Empty-state scene appears            | Reuse lv-rise-in on the new SVGs                                           | 220 ms, once          | No animation     |
| High score on Results (80 % or more) | A short one-time accent pulse on the ring plus three dots rising, pure CSS | 600 ms, once, no loop | Static ring only |
| Review caught-up                     | Check mark draws with a stroke-dashoffset transition                       | 400 ms, once          | Static           |
| Loader                               | Keep current spinners and skeletons                                        | existing              | existing         |

None of these is implemented in this task.

## 11. GitHub Asset Directory Architecture

The example structure in the brief (brand, dashboard, onboarding, illustrations, empty-states, features, backgrounds, animations, videos, icons) is **not** adopted as written, because most of those folders would stay empty and one name collides with the build. Only four directories are created:

```text
public/
  social/    og-default.png                    link previews (fixed URL)
  brand/     logo-mark.svg, logo-lockup.svg    README, email (fixed URL)
             brand-logo-240.png                Google consent, email
  pwa/       pwa-home-narrow.png, pwa-practice-narrow.png,
             pwa-home-wide.png                 manifest screenshots
  (root)     icon-192.png, icon-512.png,       existing, replaced
             icon-maskable-512.png,            in place
             apple-touch-icon.png
src/assets/
  illustrations/  empty-*.svg, error-boundary.svg   masters
docs/brand/       github-social-preview.png         not served
```

### Why not `public/assets/`

Vite writes hashed build files into `/assets/`, and `public/_headers` marks `/assets/*` as `Cache-Control: public, max-age=31536000, immutable`. A fixed-name file there would be cached for a year by browsers and the CDN and could not be updated. Fixed-name files go in `public/social`, `public/brand` and `public/pwa`; anything imported by code goes in `src/assets/` and receives a content hash.

### Rules

| Topic                | Rule                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Naming               | lowercase kebab-case, `<role>-<subject>[-<size or variant>].<ext>`, e.g. `empty-questions.svg`, `pwa-home-narrow.png`. No spaces, no capitals, no version numbers in the name.                                                 |
| Duplicate prevention | One file per ID in the manifest (section 13). The ID is recorded in the file's metadata (SVG `<title>` is avoided because of accessibility; use a comment `<!-- LV-002 -->`). Before upload, search the repo for the filename. |
| Versioning           | Git history is the version history. Replace a file under the same name; for fixed-URL files add `?v=` only if a platform caches an old preview (WhatsApp and Facebook can cache OG images for days).                           |
| Optimisation         | SVG through SVGO (remove metadata, keep viewBox, precision 2). PNG through pngquant then oxipng. Never commit an unoptimised export.                                                                                           |
| Repo size            | Budget for all new binary files: under 1.2 MB in total. The largest single file is 260 KB.                                                                                                                                     |
| Git LFS              | Not needed. LFS applies to single binaries above about 5 MB or large video, none of which are planned. Do not enable LFS: Cloudflare Pages builds would then need extra configuration.                                         |
| Never commit         | Uncompressed originals (PSD, AI, Figma exports, 4K PNGs), AI-generation scratch outputs, video, screenshots containing real student data, anything over 300 KB without a written reason.                                       |
| Service worker       | Files in `public/social`, `public/brand` and `public/pwa` are NOT added to the offline cache list in `vite.config.ts`; only the three icons are. Keep it that way (they are not needed offline).                               |

## 12. Exact Filenames and Upload Locations

| ID     | Exact filename            | GitHub directory          | Relative path                                 | New directory? | Replaces existing? |
| ------ | ------------------------- | ------------------------- | --------------------------------------------- | -------------- | ------------------ |
| LV-001 | og-default.png            | public/social/            | public/social/og-default.png                  | yes            | no                 |
| LV-002 | empty-questions.svg       | src/assets/illustrations/ | src/assets/illustrations/empty-questions.svg  | yes (once)     | no                 |
| LV-003 | empty-caught-up.svg       | src/assets/illustrations/ | src/assets/illustrations/empty-caught-up.svg  | no             | no                 |
| LV-004 | error-boundary.svg        | src/assets/illustrations/ | src/assets/illustrations/error-boundary.svg   | no             | no                 |
| LV-005 | icon-192.png              | public/                   | public/icon-192.png                           | no             | yes                |
| LV-006 | icon-512.png              | public/                   | public/icon-512.png                           | no             | yes                |
| LV-007 | icon-maskable-512.png     | public/                   | public/icon-maskable-512.png                  | no             | yes                |
| LV-008 | apple-touch-icon.png      | public/                   | public/apple-touch-icon.png                   | no             | yes                |
| LV-009 | empty-insights.svg        | src/assets/illustrations/ | src/assets/illustrations/empty-insights.svg   | no             | no                 |
| LV-010 | empty-search.svg          | src/assets/illustrations/ | src/assets/illustrations/empty-search.svg     | no             | no                 |
| LV-011 | empty-saved.svg           | src/assets/illustrations/ | src/assets/illustrations/empty-saved.svg      | no             | no                 |
| LV-012 | empty-exams.svg           | src/assets/illustrations/ | src/assets/illustrations/empty-exams.svg      | no             | no                 |
| LV-013 | empty-flashcards.svg      | src/assets/illustrations/ | src/assets/illustrations/empty-flashcards.svg | no             | no                 |
| LV-014 | pwa-home-narrow.png       | public/pwa/               | public/pwa/pwa-home-narrow.png                | yes            | no                 |
| LV-015 | pwa-practice-narrow.png   | public/pwa/               | public/pwa/pwa-practice-narrow.png            | no             | no                 |
| LV-016 | pwa-home-wide.png         | public/pwa/               | public/pwa/pwa-home-wide.png                  | no             | no                 |
| LV-017 | logo-mark.svg             | public/brand/             | public/brand/logo-mark.svg                    | yes            | no                 |
| LV-018 | logo-lockup.svg           | public/brand/             | public/brand/logo-lockup.svg                  | no             | no                 |
| LV-019 | brand-logo-240.png        | public/brand/             | public/brand/brand-logo-240.png               | no             | no                 |
| LV-020 | github-social-preview.png | docs/brand/               | docs/brand/github-social-preview.png          | yes            | no                 |

How to upload from a phone: GitHub app or github.com, repository, the directory, **Add file**, **Upload files**, choose the file, **Commit changes**. Create a new directory by typing `folder-name/` in the file-name box when adding a file. Alternatively hand the files to Claude in chat and Claude will commit them.

## 13. Master Asset Manifest

| ID     | Asset Name                | Type | Priority | Feature         | Dimensions               | Upload Path                                   | Generation Required                    |
| ------ | ------------------------- | ---- | -------- | --------------- | ------------------------ | --------------------------------------------- | -------------------------------------- |
| LV-001 | og-default.png            | PNG  | P0       | Brand / sharing | 1200 x 630 (1.91:1)      | public/social/og-default.png                  | Yes                                    |
| LV-002 | empty-questions.svg       | SVG  | P1       | Empty states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/empty-questions.svg  | Optional (can be authored in code)     |
| LV-003 | empty-caught-up.svg       | SVG  | P1       | Empty states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/empty-caught-up.svg  | Optional (can be authored in code)     |
| LV-004 | error-boundary.svg        | SVG  | P1       | Error states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/error-boundary.svg   | Optional (can be authored in code)     |
| LV-005 | icon-192.png              | PNG  | P2       | PWA / install   | 192 x 192                | public/icon-192.png                           | No (export from the existing mark)     |
| LV-006 | icon-512.png              | PNG  | P2       | PWA / install   | 512 x 512                | public/icon-512.png                           | No (export from the existing mark)     |
| LV-007 | icon-maskable-512.png     | PNG  | P2       | PWA / install   | 512 x 512                | public/icon-maskable-512.png                  | No (export from the existing mark)     |
| LV-008 | apple-touch-icon.png      | PNG  | P2       | PWA / install   | 180 x 180                | public/apple-touch-icon.png                   | No (export from the existing mark)     |
| LV-009 | empty-insights.svg        | SVG  | P2       | Empty states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/empty-insights.svg   | Optional (can be authored in code)     |
| LV-010 | empty-search.svg          | SVG  | P2       | Empty states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/empty-search.svg     | Optional (can be authored in code)     |
| LV-011 | empty-saved.svg           | SVG  | P2       | Empty states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/empty-saved.svg      | Optional (can be authored in code)     |
| LV-012 | empty-exams.svg           | SVG  | P2       | Empty states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/empty-exams.svg      | Optional (can be authored in code)     |
| LV-013 | empty-flashcards.svg      | SVG  | P2       | Empty states    | 120 x 96 viewBox (5:4)   | src/assets/illustrations/empty-flashcards.svg | Optional (can be authored in code)     |
| LV-014 | pwa-home-narrow.png       | PNG  | P2       | PWA / install   | 1080 x 1920 (9:16)       | public/pwa/pwa-home-narrow.png                | No (captured from the real app)        |
| LV-015 | pwa-practice-narrow.png   | PNG  | P2       | PWA / install   | 1080 x 1920 (9:16)       | public/pwa/pwa-practice-narrow.png            | No (captured from the real app)        |
| LV-016 | pwa-home-wide.png         | PNG  | P2       | PWA / install   | 1920 x 1080 (16:9)       | public/pwa/pwa-home-wide.png                  | No (captured from the real app)        |
| LV-017 | logo-mark.svg             | SVG  | P2       | Brand           | 64 x 64 viewBox (1:1)    | public/brand/logo-mark.svg                    | No (extract from existing code)        |
| LV-018 | logo-lockup.svg           | SVG  | P2       | Brand           | 140 x 48 viewBox (2.9:1) | public/brand/logo-lockup.svg                  | No (compose from existing mark + font) |
| LV-019 | brand-logo-240.png        | PNG  | P2       | Brand           | 240 x 240 (1:1)          | public/brand/brand-logo-240.png               | No (export from the existing mark)     |
| LV-020 | github-social-preview.png | PNG  | P3       | Brand           | 1280 x 640 (2:1)         | docs/brand/github-social-preview.png          | Yes (can reuse LV-001 layout)          |

### Totals

| Measure                                       | Value                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Total assets                                  | 20                                                                                                                                           |
| By format                                     | SVG 10, PNG 10, JPEG 0, WebP 0, video 0, animation 0                                                                                         |
| By priority                                   | P0 1, P1 3, P2 15, P3 1                                                                                                                      |
| By feature                                    | Brand: 4 ; Brand / sharing: 1 ; Empty states: 7 ; Error states: 1 ; PWA / install: 7                                                         |
| Desktop / mobile variants                     | None needed for 17 assets (scalable or fixed-size). The only device-specific set is the three PWA screenshots (2 narrow + 1 wide).           |
| Replace existing files                        | 4 (the icons); all others are new                                                                                                            |
| Needs an image-generation model               | 2 (LV-001, LV-020); the rest are exported, captured or authored in code                                                                      |
| Estimated new storage shipped by the app      | about 0.95 MB: og 250 KB, three screenshots up to 660 KB, brand files about 19 KB, ten SVGs about 25 KB; plus docs/brand 250 KB (not served) |
| Estimated storage saved by re-exporting icons | about 500 KB (568 KB down to about 60 KB), of which about 300 KB is in the install cache                                                     |

**Essentials (P0 + P1): 4 assets.** Optional (P2 + P3): 16 assets.

## 14. Technical Specifications

| ID     | Dimensions               | Ratio  | Format | Transparency | Background | Max size | Variants | Animation |
| ------ | ------------------------ | ------ | ------ | ------------ | ---------- | -------- | -------- | --------- |
| LV-001 | 1200 x 630 (1.91:1)      | 1.91:1 | PNG    | no           | solid      | 250 KB   | 1        | none      |
| LV-002 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-003 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-004 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-005 | 192 x 192                | -      | PNG    | yes          | none       | 8 KB     | 1        | none      |
| LV-006 | 512 x 512                | -      | PNG    | yes          | none       | 25 KB    | 1        | none      |
| LV-007 | 512 x 512                | -      | PNG    | no           | solid      | 20 KB    | 1        | none      |
| LV-008 | 180 x 180                | -      | PNG    | no           | solid      | 8 KB     | 1        | none      |
| LV-009 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-010 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-011 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-012 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-013 | 120 x 96 viewBox (5:4)   | 5:4    | SVG    | yes          | none       | 2.5 KB   | 1        | none      |
| LV-014 | 1080 x 1920 (9:16)       | 9:16   | PNG    | no           | solid      | 200 KB   | 1        | none      |
| LV-015 | 1080 x 1920 (9:16)       | 9:16   | PNG    | no           | solid      | 200 KB   | 1        | none      |
| LV-016 | 1920 x 1080 (16:9)       | 16:9   | PNG    | no           | solid      | 260 KB   | 1        | none      |
| LV-017 | 64 x 64 viewBox (1:1)    | 1:1    | SVG    | yes          | none       | 0.5 KB   | 1        | none      |
| LV-018 | 140 x 48 viewBox (2.9:1) | 2.9:1  | SVG    | yes          | none       | 3 KB     | 1        | none      |
| LV-019 | 240 x 240 (1:1)          | 1:1    | PNG    | yes          | none       | 15 KB    | 1        | none      |
| LV-020 | 1280 x 640 (2:1)         | 2:1    | PNG    | no           | solid      | 250 KB   | 1        | none      |

Colour: sRGB. PNG bit depth: 8. SVG: no embedded raster, no external references, no scripts. All SVG paint comes from `var(--lv-*)` except the brand masters (LV-017, LV-018), which use fixed #4F46E5 and #12142B.

## 15. Implementation Mapping

Files that will change **later** to use the assets. None is modified in this task.

| Asset(s)                | File(s) to change at implementation                                                                                                                                                                                                                  | Change                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| LV-001                  | index.html                                                                                                                                                                                                                                           | Add description, og:*, twitter:card meta with the absolute image URL                |
| LV-002, 003, 009 to 013 | src/ui-kit/feedback/EmptyState.tsx, src/ui-kit/themes/slots.tsx, and the screens listed in section 6 (QuestionsScreen.tsx, ReviewParts.tsx, ReviewScreen.tsx, InsightsScreen.tsx, PracticeHome.tsx, FlashcardsPanel.tsx, GlossaryPanel.tsx, App.tsx) | Add an `art` prop to EmptyState and pass the matching scene; keep the icon fallback |
| LV-004                  | src/ui-kit/feedback/ErrorBoundary.tsx                                                                                                                                                                                                                | Render the SVG above the message                                                    |
| LV-005 to LV-008        | (none) replace files in public/                                                                                                                                                                                                                      | Same names, no code change                                                          |
| LV-014 to LV-016        | public/manifest.webmanifest                                                                                                                                                                                                                          | Add a screenshots array                                                             |
| LV-017 to LV-020        | (none in the app)                                                                                                                                                                                                                                    | README header, Google and Supabase dashboards, GitHub settings                      |

Tests to add at implementation: a unit test that every EmptyState scene renders `aria-hidden`, an e2e/a11y run for all five theme/mode combinations (existing `pnpm design`), and a size check that fails CI if a file under public/ exceeds 300 KB.

## 16. Prioritized Implementation Roadmap

| Stage             | Assets                             | Upload locations                          | Dependencies                                      | Components touched                                                                   | Order                               | Outcome                                                             |
| ----------------- | ---------------------------------- | ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------- |
| 1 Essential       | LV-001, LV-002, LV-003, LV-004     | public/social/, src/assets/illustrations/ | None                                              | index.html, EmptyState, ErrorBoundary, QuestionsScreen, ReviewParts                  | LV-001, then LV-002, LV-003, LV-004 | Shared links preview; first-run, success and error moments gain art |
| 2 High-impact     | LV-005 to LV-008                   | public/                                   | None (deterministic export)                       | none                                                                                 | after Stage 1                       | Install download about 300 KB lighter                               |
| 3 Secondary       | LV-009 to LV-013, LV-014 to LV-016 | src/assets/illustrations/, public/pwa/    | EmptyState `art` prop from Stage 1; manifest edit | InsightsScreen, ReviewScreen, PracticeHome, FlashcardsPanel, GlossaryPanel, manifest | scenes first, then screenshots      | All empty states consistent; richer install dialog                  |
| 4 Optional polish | LV-017, LV-018, LV-019, LV-020     | public/brand/, docs/brand/                | none                                              | none                                                                                 | any time                            | Consistent brand outside the app                                    |

## 17. Performance and Optimization Guidelines

- SVG first. Every illustration is inline SVG under 2.5 KB; ten of them add about 25 KB before gzip, far less after.
- Raster only where a platform requires it (link preview, install icons, install screenshots).
- Pipelines: SVGO for SVG; pngquant (256 colours) then oxipng for PNG; target the byte budgets in section 14.
- Do not add images to the offline precache list in `vite.config.ts`; only the three icons are listed today.
- Use `loading="lazy"` and explicit width/height on any future `<img>`; none exists today.
- Respect `prefers-reduced-motion` for any new animation (existing pattern in motion.css).
- Add a CI check that fails when a file in public/ is larger than 300 KB.
- Contrast: SVG scenes use tokens that already pass the design audit in all five theme/mode combinations; re-run `pnpm design` after adding them.
- Accessibility: illustrations are decorative (`aria-hidden`); the heading and description beside them carry the meaning.
- Bangla note: no asset contains text, so no font or translation work is created.

## 18. Final Recommendations

1. **Do the small thing well.** Learivo already has a clean identity and almost no raster weight. Resist adding hero photography, video or decoration; they would raise the install size and dilute the brand.
2. **First action for the owner: LV-001 (social preview).** Either generate the background with the prompt in section 7 and send it to Claude, or simply ask Claude to build it in code (recommended, because the headline text must be exact).
3. **Second: LV-002, LV-003, LV-004 (three SVG scenes).** Claude can author these directly from the specs in section 8; if the owner prefers an AI SVG tool, use the prompts and send the files.
4. **Then** the deterministic exports (LV-005 to LV-008), which need no owner action at all.
5. **Everything else** is optional and can wait.
6. **Preserve** the rules: no image-based features, no text inside artwork, token colours only, one art direction.

### Exactly which assets to generate and upload first

| Order | ID     | File                | Priority | Who produces it                                                           | Upload to                                 |
| ----- | ------ | ------------------- | -------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| 1     | LV-001 | og-default.png      | P0       | Owner may generate with the section 7 prompt, or Claude builds it in code | public/social/ (new directory)            |
| 2     | LV-002 | empty-questions.svg | P1       | Claude authors from section 8 (or owner with an AI SVG tool)              | src/assets/illustrations/ (new directory) |
| 3     | LV-003 | empty-caught-up.svg | P1       | Claude authors from section 8 (or owner with an AI SVG tool)              | src/assets/illustrations/ (new directory) |
| 4     | LV-004 | error-boundary.svg  | P1       | Claude authors from section 8 (or owner with an AI SVG tool)              | src/assets/illustrations/ (new directory) |

### Implementation status (updated 23 November 2026)

All 20 assets have since been produced and committed: Stage 1 (LV-001 to LV-004), Stage 2 (LV-005 to LV-008), Stage 3 (LV-009 to LV-016) and Stage 4 (LV-017 to LV-020). Differences from this blueprint: the ten illustrations live as inline components in `src/ui-kit/illustrations/Scenes.tsx` (no separate .svg masters, to avoid duplicates); the lockup is 140 x 48 and about 9 KB; PNG sizes are far below the budgets. Everything except the SVG scenes is rebuilt by `node scripts/brand.mjs` and `node scripts/pwa-shots.mjs`. The audit sections above describe the state before this work.
