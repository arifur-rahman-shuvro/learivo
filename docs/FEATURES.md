# How Learivo works

What each part does and the rules behind it, written from the code. For where files live see `STRUCTURE.md`; for running and recovering the live app see `OPERATIONS.md` and `RUNBOOK.md`.

## Questions

- **Types:** single best answer (sba), single choice, multiple select, true/false (a lead-in plus statements, each with its own True/False key) and fill in the blank. Matching, structured and case-study types are **not built** (parked by the owner: they need a new answer format and a change to the questions table).
- **Options:** choice questions have 2 to 5 options (new ones start with 5 blank rows). Answers are stored as validated JSON (`answer_spec`), checked by a database function.
- **Text:** plain text, with safe rich text (bold, italic, code, bullet lists) in notes and explanations. Learivo stores no images; a question that had a picture is described in words and starts with `[Picture:`.
- **Organise:** subjects, chapters, topics and subtopics (with subject colours), tags, collections, difficulty, source, institution, exam name and year. Search uses a generated full-text column that handles Bengali. Near-duplicate statements are flagged; import duplicate policies are Skip, Import anyway and Replace.
- **Bulk actions, archive, delete (typed DELETE), version history** per question.
- **Import and export:** JSON and CSV, parsed in the browser and inserted in batches of 500.

## Making questions with AI

- **Import > Make a prompt** builds a ready-to-paste prompt (subject, chapter, topic, exam, institution, year, source, tags, level, types, difficulty, count, options per question, explanation length, languages, extra wishes). The student's details are written onto every question. The form is remembered on this device only.
- **Question style:** _Exam simulation_ (default) tells the AI to work out the real exam's mix and level from the exam name, level and subject: UKMLA, PLAB 1, USMLE and MRCP are almost all clinical vignettes (single best answer only); Bangladesh MBBS basic-science papers are mostly direct with some short application and few cases; final professional, NEET-PG, INI-CET and FCPS part 1 are mixed. Mixed difficulty means most questions at the exam's normal level, some easier, about a fifth clearly harder, never obscure trivia. _Direct questions_ and _Mostly cases_ override it.
- **Batch rules:** every reply holds at most 25 questions, the AI must check each question before including it, never let quality fall, never repeat, and stop. For more than 25 it labels each batch (`NOTE: Batch done, questions A to B of N`) and writes only the next batch when told "continue".
- **AI decides the number:** "How many questions" can be **I choose** or **AI decides**. A fixed number can miss parts of a topic or pad it, so for whole chapters and topics the AI works out what the topic needs. The student picks a depth: _Key points_ (what exams test again and again, usually 10 to 25), _Standard_ (everything a student is expected to know, 25 to 60) or _Complete_ (every testable point, 50 to 120); the ranges are a guide, with a hard limit of 120. In the chat prompt the AI first writes a PLAN (each point of the topic with the questions it deserves, weighted by exam importance, with a TOTAL), then writes the questions in batches of at most 25 following the plan, and ends with a COVERAGE list that says which points were written and which were left out. With the connected AI, the app does this itself: one request for the plan (read and capped at 5 per point and 120 in total; one retry; a clear message if it cannot be read), then one request per batch with the exact points to cover, then the usual preview.
- **Convert mode** copies existing questions from photos, PDF pages or text, keeping the wording; a missing key is solved and option counts are fixed, and the AI lists those question numbers in a NOTE line. The AI never adds tags: only the tags you enter are used.
- **Review step:** "Add to every question" fills missing subject, chapter, tags, exam, institution, year and source. For failing questions, "Copy a fix request for the AI" asks for corrected JSON for only those.
- **Connect your own AI** (optional): keys stay on the device and are removed at sign-out. Requests time out after 90 seconds. A usage counter and per-error advice are shown.

## Practice and exams

- Practice sessions (Quick 10, by subject or topic, from bookmarks, Smart mix with a preview line) and timed exams built from the bank, with an exam player and results (accuracy, by subject, time).
- Marking happens in the browser on submit; each question is stored as a frozen snapshot in the attempt, so results stay correct if the question is later edited or deleted.
- Marking rules: multiple answer with k correct gives 1/k per correct pick and a wrong pick cancels one correct pick; true/false gives 1/n per statement marked correctly; fill in the blank ignores case, spacing and trailing punctuation; negative marking uses the same units and never takes a score below zero.
- Untimed practice counts time only while the screen is open; timed sessions use the wall clock.
- A confidence mark per answer and a mistake reason are stored. "Partly correct" counts as not fully correct in Insights and revision.
- Options can be chosen with the 1 to 9 keys.

## Review and Insights

- **Due now:** spaced-repetition cards (Again, Hard, Good, Easy). The scheduler follows the published FSRS-4.5 memory model with default parameters, not tuned to the student. After Again a card returns in 10 minutes. Questions answered wrong join the queue by themselves.
- **Mistakes** (grouped by reason), **Bookmarks**, **Notes** (one per question plus free notes, searchable), **Flashcards** (own front/back cards, same scheduler) and **Glossary** (own terms; matching words are underlined in explanations, notes and cards).
- **Insights:** overview with a 30-day accuracy trend, accuracy by subject or chapter (weakest first, tap to practise), exam scores, study time, and 11 achievements. Every chart has a table view. Figures use the latest 5000 answers and 200 finished sessions.
- **Home:** today's focus, due cards, daily goal (1 to 500), streak, weak areas (under 70 percent after 5 or more answers), recent sessions, exam countdown with a daily pace and a study calendar for the days left (the student ticks the subjects the exam covers, or leaves All subjects; the pace, progress and calendar count only those, and a deleted subject is ignored; the day before the exam is revision only). While the exam date is today or later, Smart mix and any practice with no subject, tag or collection chosen draw about half of their questions from the exam's subjects and the rest from the others (a subject the student picks is never overridden; the Smart mix line says so), an All features shelf, and Customize (show, hide and order sections, saved to the account). A student with no questions sees the starter page, which keeps the All features shelf and Customize.

## Offline and installed app

- Installable (PWA). A service worker keeps the app files, so after one online visit the app opens with no connection; a banner offers a new version.
- The whole active question bank is copied to the device (IndexedDB) after sign-in. Offline you can read, search, practise, sit exams and edit; changes wait in a list on the device and are sent in order when online (details, clashes and limits in `OPERATIONS.md` section 2).
- Sessions done offline are stored first and sent later with their original times; a retry never creates one twice.
- Command palette (Ctrl or Cmd + K, or the Search button): go to a screen, add or import, start practice or revision, search every question.

## Account

- Email and password, Google sign-in (shown only when Supabase has the provider on), forgot password, change email, change password, add a password to a Google account, profile (name and avatar colour), delete account.
- **Backup** (version 3 file with record counts and a SHA-256, optional passphrase) and **restore** (additive, safe to run twice). Pending offline changes are sent before a backup, and the rest are listed.
- Themes: Default, Forest and Space, light and dark (Space is dark only); the choice is kept in the browser.

## Pages for visitors

- A signed-out visitor sees the introduction page first (`src/landing`): a question to answer, a daily-pace slider, an explorer of the four kinds of answer, an exam paper preview and a theme switcher. Someone who has signed in on the device goes straight to sign-in.
- `/privacy.html` and `/terms.html` are written for the Google consent screen.
- Link previews use `public/social/og-default.png` and the tags in `index.html`.

## Limits that are by design

- No images in questions, and no image features.
- Offline edits are last-change-wins, with a clash screen for questions and a notice for notes.
- Signing out while offline with unsent changes asks what to do; the device copy is wiped at sign-out for privacy.
- AI helpers use the student's own key; there is no Learivo-run AI and no sharing between students.
