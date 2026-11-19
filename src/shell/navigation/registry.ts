/** Module registry: the app shell reads this list, so adding a feature means adding a manifest. */

export type ModuleId = "home" | "questions" | "practice" | "review" | "insights";

export interface ModuleManifest {
  id: ModuleId;
  label: string;
  /** URL hash route, for example "#/questions". */
  route: string;
  /** Primary modules always show in the main navigation. */
  primary: boolean;
  /** Phase of the roadmap in which the real screen is built. */
  builtInPhase: number;
}

export const MODULES: readonly ModuleManifest[] = [
  { id: "home", label: "Home", route: "#/home", primary: true, builtInPhase: 4 },
  { id: "questions", label: "Questions", route: "#/questions", primary: true, builtInPhase: 4 },
  { id: "practice", label: "Practice", route: "#/practice", primary: true, builtInPhase: 5 },
  { id: "review", label: "Review", route: "#/review", primary: true, builtInPhase: 6 },
  { id: "insights", label: "Insights", route: "#/insights", primary: true, builtInPhase: 6 },
];

/** Modules shown in navigation. Primary modules always show; others only when the student enabled them. */
export function visibleModules(enabled: readonly string[] = []): ModuleManifest[] {
  return MODULES.filter((m) => m.primary || enabled.includes(m.id));
}

/** Resolve a URL hash to a module, falling back to Home for unknown routes. */
export function moduleForHash(hash: string): ModuleManifest {
  return MODULES.find((m) => m.route === hash) ?? MODULES[0]!;
}
