/** Module registry: the app shell reads this list, so adding a feature means adding a manifest. */

export type ModuleId =
  "home" | "questions" | "practice" | "study" | "review" | "insights" | "games";

export interface ModuleManifest {
  id: ModuleId;
  label: string;
  /** URL hash route, for example "#/questions". */
  route: string;
  /** Primary modules always show in the main navigation. */
  primary: boolean;
  /** Other words that find this screen in the command palette. */
  keywords?: string;
  /** Shown in the five-item bottom bar. Others are reached from Home, Practice or a hub. */
  nav: boolean;
  /** For a screen outside the bar: the bar item that stays lit while it is open. */
  navParent?: ModuleId;
  /** Phase of the roadmap in which the real screen is built. */
  builtInPhase: number;
}

export const MODULES: readonly ModuleManifest[] = [
  { id: "home", label: "Home", route: "#/home", primary: true, nav: true, builtInPhase: 4 },
  {
    id: "questions",
    label: "Questions",
    route: "#/questions",
    primary: true,
    nav: true,
    builtInPhase: 4,
  },
  {
    id: "practice",
    label: "Practice",
    route: "#/practice",
    primary: true,
    nav: true,
    builtInPhase: 5,
  },
  { id: "review", label: "Review", route: "#/review", primary: true, nav: true, builtInPhase: 6 },
  {
    id: "insights",
    keywords: "insights stats analytics",
    label: "Progress",
    route: "#/insights",
    primary: true,
    nav: true,
    builtInPhase: 6,
  },
  {
    id: "study",
    keywords: "study pomodoro stopwatch time",
    label: "Focus timer",
    route: "#/study",
    primary: true,
    nav: false,
    navParent: "practice",
    builtInPhase: 7,
  },
  {
    id: "games",
    keywords: "play fun",
    label: "Mini games",
    route: "#/games",
    primary: true,
    nav: false,
    navParent: "practice",
    builtInPhase: 8,
  },
];

/** Modules shown in the bottom bar: the five main ones, always. */
export function visibleModules(enabled: readonly string[] = []): ModuleManifest[] {
  return MODULES.filter((m) => m.nav && (m.primary || enabled.includes(m.id)));
}

/** Resolve a URL hash to a module (a sub-page such as "#/review/notes" belongs to its module), falling back to Home for unknown routes. */
export function moduleForHash(hash: string): ModuleManifest {
  return MODULES.find((m) => m.route === hash || hash.startsWith(`${m.route}/`)) ?? MODULES[0]!;
}
