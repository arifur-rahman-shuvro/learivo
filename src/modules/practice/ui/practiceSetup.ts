import { MISTAKE_GROUPS } from "../domain/groups.ts";
import type { PracticeFilter } from "../domain/session.ts";
import { type PracticeSetup } from "./start.ts";

export const DEFAULT_SETUP: PracticeSetup = {
  nodeId: null,
  tagId: null,
  collectionId: null,
  filter: "all",
  count: 20,
  minutes: null,
  instantFeedback: true,
  shuffleOptions: true,
};

export const SETUP_KEY = "learivo.practiceSetup";

export function rememberedSetup(): PracticeSetup {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(SETUP_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULT_SETUP;
    const o = raw as Partial<PracticeSetup>;
    const filters: PracticeFilter[] = [
      "all",
      "unattempted",
      "bookmarked",
      ...MISTAKE_GROUPS.map((g) => (g.id === "wrong" ? "incorrect" : g.id) as PracticeFilter),
    ];
    return {
      ...DEFAULT_SETUP,
      filter: filters.includes(o.filter as PracticeFilter) ? (o.filter as PracticeFilter) : "all",
      count: typeof o.count === "number" ? Math.min(200, Math.max(1, Math.floor(o.count))) : 20,
      minutes: typeof o.minutes === "number" && o.minutes > 0 ? Math.min(600, o.minutes) : null,
      instantFeedback: o.instantFeedback !== false,
      shuffleOptions: o.shuffleOptions !== false,
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

/** One-tap ways to start. They always draw from every subject. */
export const PRESETS: { id: string; label: string; hint: string; patch: Partial<PracticeSetup> }[] =
  [
    {
      id: "quick",
      label: "Quick 10",
      hint: "Ten random questions",
      patch: { filter: "all", count: 10 },
    },
    {
      id: "new",
      label: "New questions",
      hint: "Not attempted yet",
      patch: { filter: "unattempted", count: 20 },
    },
    {
      id: "mistakes",
      label: "My mistakes",
      hint: "Last answered wrong",
      patch: { filter: "incorrect", count: 20 },
    },
    {
      id: "saved",
      label: "Bookmarked",
      hint: "Questions you saved",
      patch: { filter: "bookmarked", count: 20 },
    },
  ];
