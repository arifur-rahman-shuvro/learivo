import type { PickerOption } from "../../../ui-kit/index.ts";
import { KIND_BY_DEPTH, type TaxonomyNode } from "../data/repo.ts";

/** The subject tree flattened for a Picker: each item knows how deep it sits. */
export function subjectOptions(nodes: readonly TaxonomyNode[]): PickerOption[] {
  const out: PickerOption[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const n of nodes
      .filter((x) => x.parentId === parent)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ value: n.id, label: n.name, depth });
      if (depth < KIND_BY_DEPTH.length - 1) walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
