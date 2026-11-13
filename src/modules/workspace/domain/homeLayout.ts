/** Which sections the Home screen shows, and in what order. The student chooses; this keeps it valid. */
export const HOME_SECTIONS = [
  { id: "focus", label: "Today's focus" },
  { id: "numbers", label: "Your numbers" },
  { id: "goal", label: "Daily goal" },
  { id: "weak", label: "Weak areas" },
  { id: "recent", label: "Recent sessions" },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]["id"];

export interface HomeLayout {
  order: HomeSectionId[];
  hidden: HomeSectionId[];
}

const IDS = HOME_SECTIONS.map((s) => s.id) as HomeSectionId[];
const known = (x: unknown): x is HomeSectionId => IDS.includes(x as HomeSectionId);

export const DEFAULT_HOME_LAYOUT: HomeLayout = { order: [...IDS], hidden: [] };

/**
 * Turns anything stored (empty, old, hand-edited) into a valid layout: unknown sections are
 * dropped, duplicates removed, and sections added in a later version appear at the end.
 */
export function cleanLayout(raw: unknown): HomeLayout {
  const o = (raw && typeof raw === "object" ? raw : {}) as { order?: unknown; hidden?: unknown };
  const order: HomeSectionId[] = [];
  for (const id of Array.isArray(o.order) ? o.order : []) {
    if (known(id) && !order.includes(id)) order.push(id);
  }
  for (const id of IDS) if (!order.includes(id)) order.push(id);
  const hidden = (Array.isArray(o.hidden) ? o.hidden : []).filter(
    (id, i, all): id is HomeSectionId => known(id) && all.indexOf(id) === i,
  );
  return { order, hidden };
}

/** Sections to show, in order. */
export function visibleSections(layout: HomeLayout): HomeSectionId[] {
  return layout.order.filter((id) => !layout.hidden.includes(id));
}

export function moveSection(layout: HomeLayout, id: HomeSectionId, by: -1 | 1): HomeLayout {
  const i = layout.order.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= layout.order.length) return layout;
  const order = [...layout.order];
  [order[i], order[j]] = [order[j]!, order[i]!];
  return { ...layout, order };
}

export function toggleSection(layout: HomeLayout, id: HomeSectionId): HomeLayout {
  return {
    ...layout,
    hidden: layout.hidden.includes(id)
      ? layout.hidden.filter((x) => x !== id)
      : [...layout.hidden, id],
  };
}
