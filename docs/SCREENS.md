# MVP screen and interaction specifications

Status: Phase 2 specification. These screens are designed, not yet built. Each is built in the phase noted.

Navigation: five primary destinations (Home, Questions, Practice, Review, Insights) as a bottom bar on phones and a collapsible sidebar on desktop. The avatar menu holds Settings, Import and Export, Notifications, Help and Sign out. Practice and exam players hide navigation to protect concentration.

Global rules: every list has loading, empty and error states; destructive actions use a confirmation dialog; every action gives feedback within 100ms; all screens work at 360px width.

## Public and account (Phase 3)

| Screen | Content | Key interactions |
| --- | --- | --- |
| Landing | Value statement, three feature highlights, theme preview, sign-up button | Theme preview switches live |
| Sign up, sign in, reset password | Email and password, Google button, inline validation | Show or hide password; clear error text; confirmation email notice |

## Home (Phase 4 shell, Phase 6 widgets)

- Greeting, today's focus card (next best action), due revision count, daily goal ring, streak, recent sessions, weak topics.
- Empty state for a new student: "Add your first questions" with Add and Import buttons.

## Questions (Phase 4)

| Screen | Specification |
| --- | --- |
| Question list | Search box, filter button (opens bottom sheet on phones, side panel on desktop), sort, count, virtualized rows (50 per page, cursor loading). Row: stem preview, type badge, subject and topic, difficulty, tags. Long-press or select mode enables bulk actions: categorize, tag, move to collection, archive, delete. |
| Filter sheet | Subject, chapter, topic tree; type; difficulty; tags; status; source; exam year; date range. Active filters shown as removable chips. Save a filter later. |
| Question editor | Phones: full screen. Desktop: right drawer. Fields in order: type, statement, options or answer, explanation, classification (subject, chapter, topic, subtopic), difficulty, tags, source, institution, exam name and year, custom fields. Only type and statement are required. Live preview tab. Autosaved drafts. Duplicate warning appears under the statement. Version history tab with restore. |
| Collections and tags | List with counts, create, rename, reorder by drag, delete (questions stay). |
| Taxonomy manager | Tree view, drag to reorder or reparent, inline rename, merge nodes. |
| Archive | Archived questions with Restore and Delete forever (typed confirmation). |

## Import and Export (Phase 4)

Import is a full-page five-step wizard with a progress header:

1. Choose file (JSON or CSV), with size and row limits stated.
2. Validate and detect format; show file summary.
3. Map fields (CSV): column to field table with auto-suggestions and a sample row.
4. Preview and problems: first 20 rows rendered as questions, error list with row numbers, duplicate list with Skip, Keep both or Replace per item.
5. Confirm and import: progress bar, then a summary (added, skipped, replaced, failed) with a downloadable error report.

Export is a dialog: scope (all, selected, filtered, collection, subject or chapter), format (Learivo JSON or CSV), include history toggle, Download.

## Practice (Phase 5)

| Screen | Specification |
| --- | --- |
| Setup sheet | Source (all, subject, chapter, topic, collection), filters (unattempted, incorrect, bookmarked, weak areas, random), number of questions, timed or untimed, instant feedback on or off. Start button shows the resulting question count. |
| Player | One question per screen. Top bar: progress, timer, palette button. Options as large tap targets. Actions: Submit, Mark for review, Bookmark, Note. After submit: correct or incorrect state, explanation panel. Bottom bar: Previous, Next. Palette sheet: numbered grid coloured by status (unanswered, answered, flagged, correct, incorrect). Exit asks to save and resume. |
| Session summary | Score ring, accuracy, time, breakdown by subject and topic, list of questions with status, buttons: Retry incorrect, Review all, New session. |

## Exams (Phase 5)

| Screen | Specification |
| --- | --- |
| Exam builder | Title; sources and rules (number of questions per subject or topic, difficulty mix); time limit; randomize questions and options; marks per question; negative marking; instructions. Shows a live "available questions" check and warns when a rule cannot be met. Save as template. |
| Instructions | Rules summary, number of questions, duration, marking scheme, Start button. |
| Exam player | Same layout as practice without instant feedback. Countdown timer that turns to a warning state in the final 10 percent. Palette with answered, unanswered and flagged states. Autosave indicator. Submit opens a confirmation dialog listing unanswered and flagged counts. Time expiry auto-submits and tells the student. |
| Results | Score, correct, incorrect, unanswered, accuracy, time spent, subject, topic and difficulty breakdown charts, comparison with previous attempts. |
| Answer review | Each question with the student's answer, the correct answer and the explanation; filter by incorrect, unanswered or flagged; Reattempt incorrect. |

## Review (Phase 6)

Tabs: Due now (spaced-repetition cards, grade Again, Hard, Good, Easy), Mistakes (incorrect and repeatedly missed questions), Bookmarks, Notes. Notes open in a drawer from any question.

## Insights (Phase 6)

Tabs: Overview (totals, accuracy trend line), Subjects and topics (strong and weak areas, sorted bar chart), Exams (history with scores over time), Study time (per day). All charts use the theme chart colours and have a table view for accessibility.

## Settings (Phase 3 basics, grows later)

Sections: Profile, Appearance (theme cards with live preview, mode, Low effects toggle), Study preferences, Data and storage (offline packs, backups, full export), Security (password, sessions), Delete account (typed confirmation).

## Sync and offline states (Phase 3 to 7)

A sync indicator in the header shows Saved, Syncing, Offline or Needs attention. A conflict opens a review screen that shows both versions side by side with Keep mine, Keep cloud or Keep both.
