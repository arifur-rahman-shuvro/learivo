/**
 * The words of the Coach. Every message is written to be true (it only uses the student's real
 * numbers) and kind: it can joke, cheer or be direct, but it never invents urgency, never shames
 * and never compares the student with other people. The tests enforce that.
 */

export type Kind =
  "daily" | "streak" | "revision" | "exam" | "weak" | "comeback" | "weekly" | "test";
export type Voice = "motivating" | "funny" | "firm";
export type Tone = "mix" | Voice;

export interface Words {
  title: string;
  body: string;
}

/** Template tokens, filled from the student's numbers by `fill`. */
export interface Tokens {
  name: string; // first name, or "there"
  left: string; // "12 questions"
  goal: string; // "20 questions"
  streak: string; // "6-day"
  streakN: string; // "6"
  due: string; // "9 cards"
  days: string; // "7 days" or "tomorrow"
  exam: string; // exam title or "your exam"
  subject: string;
  pct: string; // "54%"
  wkN: string; // "84 questions"
  wkPct: string; // "71%"
  trend: string; // "up 6 points" | "down 3 points" | "steady"
  away: string; // "3 days"
}

type Bank = Record<Kind, Record<Voice, Words[]>>;

export const BANK: Bank = {
  daily: {
    motivating: [
      {
        title: "Today's {left} are waiting",
        body: "Hi {name}. A small start counts. Open one question and the rest follow.",
      },
      {
        title: "Ready when you are",
        body: "{goal} is today's goal. Even 5 questions moves you forward.",
      },
      {
        title: "Your future self says thanks",
        body: "{left} to hit today's goal. You have done harder things.",
      },
    ],
    funny: [
      {
        title: "Your questions miss you",
        body: "They have been sitting there all day. {left} to go, fast ones first.",
      },
      {
        title: "Plot twist: you study today",
        body: "{name}, the goal is {goal}. The sofa will still be there after.",
      },
      { title: "Brain, assemble!", body: "{left} left today. Think of it as a snack, not a meal." },
    ],
    firm: [
      { title: "Study time", body: "{left} left to reach today's goal. Start now." },
      {
        title: "Today's goal: {goal}",
        body: "Open Practice and do the first 5. Momentum does the rest.",
      },
      { title: "Time to practise", body: "You planned this hour. {left} to go." },
    ],
  },
  streak: {
    motivating: [
      {
        title: "Keep your {streak} streak alive",
        body: "One question today and day {streakN} is safe. You built this.",
      },
      {
        title: "{streakN} days in a row",
        body: "Don't stop now. A single question keeps the chain going.",
      },
      {
        title: "Your streak is worth protecting",
        body: "{streakN} days of effort. Two minutes keeps it.",
      },
    ],
    funny: [
      {
        title: "Your {streak} streak is wobbling",
        body: "It needs one question to feel safe. Be a good friend to your streak.",
      },
      {
        title: "Day {streakN} says hello",
        body: "It is bedtime-ish and your streak is still waiting. One question, then sleep.",
      },
      {
        title: "Streak on life support",
        body: "{streakN} days alive. One question is the whole medicine.",
      },
    ],
    firm: [
      {
        title: "No answers yet today",
        body: "Your {streak} streak ends tonight without one. Do one question.",
      },
      {
        title: "Streak check",
        body: "Day {streakN} is still open. Answer one question to keep it.",
      },
      {
        title: "One question keeps day {streakN}",
        body: "Open Practice and finish a quick set before bed.",
      },
    ],
  },
  revision: {
    motivating: [
      {
        title: "{due} ready to revise",
        body: "Spaced revision is how facts stay. A quick round now saves hours later.",
      },
      {
        title: "Revision is paying off",
        body: "{due} are due today. Ten minutes and you are done.",
      },
      {
        title: "Lock it in",
        body: "{due} are due. Reviewing at the right time is the strongest study trick there is.",
      },
    ],
    funny: [
      {
        title: "{due} are getting grumpy",
        body: "They were fresh yesterday. Revise them before they forget who you are.",
      },
      { title: "Your flashcards want attention", body: "{due} due. They promise not to bite." },
      {
        title: "Memory maintenance time",
        body: "{due} due. Think of it as brushing your brain's teeth.",
      },
    ],
    firm: [
      { title: "{due} due now", body: "Revise them today. Late reviews are forgotten reviews." },
      {
        title: "Revision queue",
        body: "{due} are waiting. Clear them first, then study new things.",
      },
      { title: "Do your revision", body: "{due} due. It takes about 10 minutes." },
    ],
  },
  exam: {
    motivating: [
      {
        title: "{days} to {exam}",
        body: "Your weakest area is {subject} ({pct}). 10 questions there is the best use of today.",
      },
      {
        title: "{exam} is {days} away",
        body: "You are closer than you feel. Today's focus: {subject}.",
      },
      {
        title: "{days} left. You've got this",
        body: "A little every day beats a lot at the end. Start with {subject}.",
      },
    ],
    funny: [
      {
        title: "{exam} in {days}. No pressure.",
        body: "(A little pressure.) {subject} at {pct} would like a word with you.",
      },
      {
        title: "The exam is not going to move",
        body: "{days} to {exam}. {subject} is the one to befriend today.",
      },
      {
        title: "Countdown: {days}",
        body: "{exam} is coming. Beat {subject} before it beats you. Friendly rivalry only.",
      },
    ],
    firm: [
      {
        title: "{days} to {exam}",
        body: "Weakest subject: {subject} at {pct}. Practise it today.",
      },
      { title: "{exam}: {days} left", body: "Spend today on {subject}. 10 questions minimum." },
      { title: "Exam plan check", body: "{days} to go. {subject} ({pct}) needs the most work." },
    ],
  },
  weak: {
    motivating: [
      {
        title: "{subject} can be your next win",
        body: "You are at {pct} there. 8 focused questions will move it.",
      },
      {
        title: "Small steps in {subject}",
        body: "{pct} right so far. Weak spots improve fastest with short, regular practice.",
      },
      {
        title: "Turn {subject} around",
        body: "Today's challenge: 8 questions, read every explanation.",
      },
    ],
    funny: [
      {
        title: "{subject} is plotting against you",
        body: "It holds a {pct} lead. Take it back with 8 questions.",
      },
      { title: "A challenger appears: {subject}", body: "{pct} right so far. Round two?" },
      { title: "{subject} thinks you forgot it", body: "Prove it wrong. 8 questions, tops." },
    ],
    firm: [
      {
        title: "Weakest subject: {subject}",
        body: "{pct} right. Practise 8 questions on it today.",
      },
      { title: "Fix {subject}", body: "At {pct} it is your lowest. Start a focused set now." },
      {
        title: "{subject} needs work",
        body: "{pct} right. Read each explanation and redo the misses.",
      },
    ],
  },
  comeback: {
    motivating: [
      {
        title: "Welcome back whenever you are ready",
        body: "{away} away. One question is enough to start again, {name}.",
      },
      {
        title: "Restart with 5 questions",
        body: "{away} since your last session. No catching up needed, just begin.",
      },
      {
        title: "Your progress is still here",
        body: "Everything you learned is saved. Come back for 5 questions.",
      },
    ],
    funny: [
      {
        title: "{away} of silence",
        body: "Your questions are fine. They just wondered if it was something they said.",
      },
      {
        title: "Hello? Is it study you're looking for?",
        body: "Five questions will break the spell.",
      },
      { title: "We kept your seat warm", body: "{away} away. Come sit down for 5 questions." },
    ],
    firm: [
      {
        title: "{away} without practice",
        body: "Restart today with 5 questions. Then build back up.",
      },
      { title: "Back to it", body: "{away} since your last answer. Do a quick set now." },
      { title: "Time to restart", body: "Pick up where you stopped. 5 questions today." },
    ],
  },
  weekly: {
    motivating: [
      {
        title: "Your week: {wkN}",
        body: "{wkPct} right, {trend} on the week before. Keep that rhythm going.",
      },
      { title: "Week done", body: "{wkN} answered at {wkPct}. That is real progress, {name}." },
      {
        title: "Look what you did this week",
        body: "{wkN}, {wkPct} right ({trend}). Plan your next one tonight.",
      },
    ],
    funny: [
      {
        title: "Weekly report card, no homework",
        body: "{wkN} at {wkPct}, {trend}. Your brain thanks you.",
      },
      {
        title: "This week in numbers",
        body: "{wkN} answered, {wkPct} right, {trend}. Not bad at all.",
      },
      {
        title: "Sunday summary",
        body: "You did {wkN} this week ({wkPct} right). Tomorrow, again?",
      },
    ],
    firm: [
      {
        title: "Weekly summary",
        body: "{wkN}, {wkPct} right, {trend}. Set your goal for next week.",
      },
      {
        title: "Last 7 days",
        body: "{wkN} answered at {wkPct} ({trend}). Aim a bit higher this week.",
      },
      { title: "Week review", body: "{wkN} at {wkPct}. See Insights for what to fix." },
    ],
  },
  test: {
    motivating: [
      {
        title: "Notifications are on",
        body: "This is a test. The Coach will only message you when it matters.",
      },
    ],
    funny: [
      {
        title: "Hello from your Coach",
        body: "Test passed. I promise to be annoying only in a helpful way.",
      },
    ],
    firm: [{ title: "Test notification", body: "Notifications work on this device." }],
  },
};

export const VOICES: Voice[] = ["motivating", "funny", "firm"];

function fill(template: string, t: Tokens): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = (t as unknown as Record<string, string>)[k];
    if (v === undefined) throw new Error(`Unknown token {${k}}`);
    return v;
  });
}

/** A small stable number from text, so the same student gets a steady but varied choice. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks the words. In "mix" the voice rotates day by day, and the variant rotates too, so two
 * days in a row never read the same. `dayNumber` is the student's local day count.
 */
export function compose(
  kind: Kind,
  tone: Tone,
  tokens: Tokens,
  seed: string,
  dayNumber: number,
): Words & { voice: Voice } {
  const base = hash(seed);
  const voice: Voice = tone === "mix" ? VOICES[(base + dayNumber) % VOICES.length]! : tone;
  const list = BANK[kind][voice];
  const pick = list[(Math.floor(base / 7) + dayNumber) % list.length]!;
  return { title: fill(pick.title, tokens), body: fill(pick.body, tokens), voice };
}
