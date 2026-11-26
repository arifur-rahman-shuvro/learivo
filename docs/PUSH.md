# Push notifications: the Learivo Coach

Written first as the plan, then kept up to date as the phases were built. Anything not proven on a real phone is marked **Not verified**.

## 1. Idea

A push notification is a short message from a coach who knows your real numbers. It is only sent when it is true and useful: your streak, your revision queue, your exam date, your weakest subject. It can be funny, warm or firm, and the student picks the voice. It never invents urgency ("only 2 minutes left!"), never shames, and never sends when the student is asleep.

"Persuasive" here means good timing, good wording and a very small next step (5 questions, one tap), not tricks. Tricks get the app muted, and Android hides channels that are muted a lot.

## 2. What the student sees

| Message kind        | Sent when                                                  | Example (Funny voice)                                                     |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Daily nudge         | At the student's study time, if the daily goal is not done | "Your questions miss you. 20 today? Fast ones first."                     |
| Streak guard        | Evening, streak of 2+ days, nothing done today             | "Day 6 streak is wobbling. One question saves it."                        |
| Revision due        | Cards are due, once a day at most                          | "9 cards are due. They are getting old and grumpy."                       |
| Exam countdown      | 30, 14, 7, 3, 1 days before the exam date                  | "7 days to the exam. Weakest spot: Renal physiology (54%). 10 questions?" |
| Weak-spot challenge | A subject is under 60% with 10+ answers                    | "Pharmacology sits at 48%. Beat it with 8 questions."                     |
| Comeback            | 3 and 7 days of silence, then stops                        | "Three days quiet. Even one question breaks the spell."                   |
| Weekly summary      | Sunday evening                                             | "This week: 84 questions, 71% right. Up 6 points."                        |

Voices: **Mix** (a bit of everything, default), **Motivating**, **Funny**, **Firm** (direct, no jokes). Each kind has several variants per voice so it never repeats the same line twice in a row.

Interactive parts:

- Tapping opens the exact place: practice with the right filter already chosen (weak subject, revision, quick 5).
- Buttons on the notification: the main action (for example **Start 5**, **Revise now**, **Practise it**) and **Later** (snooze 1 hour, without opening the app). The server also supports "quiet for today"; it has no button yet because phones show at most two.
- **Send me a test** in Settings shows the notification in a few seconds.
- A gentle first ask: the app asks for permission only after the first finished session, with a plain explanation, never on load.

Controls (Settings > Notifications): on/off, voice, study time, quiet hours (default 22:00 to 07:00), which kinds, at most 1 to 3 a day, snooze. Turning it off removes the device subscription at once.

Self-protecting behaviour:

- Hard cap per day, quiet hours in the student's own time zone, one message per kind per day.
- If 5 messages in a row are ignored, the coach halves its rate; after 10 it pauses until the student opens the app.
- Dead subscriptions (the browser says gone) are deleted.

## 3. Architecture

- **Standard Web Push** (VAPID, RFC 8030/8291/8292). No third-party service, no cost, works on Android Chrome and installed PWAs. iPhone needs the app added to the Home Screen (iOS 16.4+).
- **Database** (RLS on, own rows only): `push_subscriptions`, `push_settings`, `push_log`. A service-only function `push_facts()` gathers each student's numbers (streak, today's answers, due cards, exam date, weakest subject, days away).
- **One Edge Function `push`** with four routes: `tick` (called by a schedule every 10 minutes), `test` (student's own test, checked with their sign-in), `act` (snooze and mute buttons, signed per notification), `key` (the public key).
- **The VAPID private key is made by the function itself on first use** and stored in a table that no browser can read. It is never shown, never in chat, never in the repo. The schedule secret is generated inside the database (Vault).
- **Decision logic is plain TypeScript** (`supabase/functions/push/coach.ts`, `messages.ts`) so the same files are unit tested here and deployed unchanged. Web Push encryption (`webpush.ts`) is tested against the official RFC 8291 test vector.
- **Service worker** shows the notification, handles clicks and buttons, and tells the open app to navigate.

```
cron (10 min) -> push/tick -> push_facts() -> coach decides -> encrypt -> browser push service -> phone
phone tap -> service worker -> app (deep link) -> mark clicked
```

## 4. Roadmap

1. **Roadmap and design** (this file).
2. **P1 Database.** Tables, RLS, `push_facts()`, tests in CI. Live-only part: VAPID key table, Vault secret, cron schedule.
3. **P2 Sender.** `webpush.ts` with the RFC vector test, `coach.ts` decisions, `messages.ts` bank (4 voices), `index.ts` routes, deploy.
4. **P3 App.** Service worker push and click handlers, subscribe and unsubscribe, Settings > Notifications, first-ask prompt, deep links.
5. **P4 Verify and ship.** Full test set with mutation checks, deploy, docs, CI, owner phone test.
6. **Later ideas.** Bangla and Banglish voices, "study buddy" shared streaks, per-subject reminders, smarter timing from the student's real study hours (the first version already learns the usual hour), badge count on the app icon.

## 4b. Status

Built and live: database (with CI checks), sender, schedule, app screens, service worker. Verified here: encryption against the RFC 8291 test vector, every decision rule, the settings screen, the live function (key route, wrong secret refused, bad link refused, a tick with no subscribers answers 200). **Not verified:** a notification arriving on a real phone.

## 5. Limits (honest)

- The sandbox cannot reach phone push services, so delivery to a real phone is **Not verified** until the owner presses **Send me a test** on his phone.
- Browsers may delay or drop pushes (battery saver, data saver, "app not used" restrictions). Nothing in the app can force delivery.
- iPhone only works for an installed Home Screen app.
