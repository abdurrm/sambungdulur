import type { TreeDoc } from '../model/types';
import { parentFamilies, partnerFamilies } from '../model/relations';

export interface VisibleGraph {
  /** person id -> generation relative to focus (negative = ancestors). */
  gen: Map<string, number>;
  /** family ids with at least one visible partner and one other visible member. */
  families: string[];
  /** Persons whose parents exist but are not shown (generation limit or collapse). */
  hiddenParents: Set<string>;
  /** Persons whose children exist but are not shown. */
  hiddenChildren: Set<string>;
  /** Persons in the tree that are not visible in this view. */
  hiddenCount: number;
}

/**
 * Selects the people to draw around the focus person.
 *
 * - ancestors: direct line upward for `up` generations (both parents of each ancestor), with
 *   the siblings of the focus person;
 * - descendants: partners and children downward for `down` generations;
 * - `up`/`down` = -1 means unlimited; with both unlimited the whole connected family is shown.
 * Collapsed branches stop expansion at that person.
 */
export function selectVisible(doc: TreeDoc, focusId: string, up: number, down: number): VisibleGraph {
  const gen = new Map<string, number>();
  const hiddenParents = new Set<string>();
  const hiddenChildren = new Set<string>();
  if (!doc.persons[focusId]) focusId = doc.order[0];
  if (!focusId) return { gen, families: [], hiddenParents, hiddenChildren, hiddenCount: 0 };
  const collapsedUp = (id: string) => doc.collapsed[id] === 'ancestors' || doc.collapsed[id] === 'both';
  const collapsedDown = (id: string) => doc.collapsed[id] === 'descendants' || doc.collapsed[id] === 'both';
  const within = (g: number) => (g < 0 ? up < 0 || -g <= up : down < 0 || g <= down);

  gen.set(focusId, 0);
  if (up < 0 && down < 0) {
    // Whole connected component, breadth-first so generations are as consistent as possible.
    const queue = [focusId];
    while (queue.length) {
      const id = queue.shift()!;
      const g = gen.get(id)!;
      const visit = (other: string, og: number) => {
        if (!gen.has(other)) {
          gen.set(other, og);
          queue.push(other);
        }
      };
      if (!collapsedUp(id)) {
        for (const f of parentFamilies(doc, id)) {
          f.partners.forEach((p) => visit(p, g - 1));
          f.children.forEach((c) => visit(c, g));
        }
      }
      for (const f of partnerFamilies(doc, id)) {
        f.partners.forEach((p) => visit(p, g));
        if (!collapsedDown(id)) f.children.forEach((c) => visit(c, g + 1));
      }
    }
  } else {
    // Ancestors.
    let frontier = [focusId];
    for (let g = 0; frontier.length; g--) {
      const next: string[] = [];
      for (const id of frontier) {
        const fams = parentFamilies(doc, id).filter((f) => f.partners.length);
        if (!fams.length) continue;
        if (!within(g - 1) || collapsedUp(id)) {
          hiddenParents.add(id);
          continue;
        }
        for (const f of fams)
          for (const p of f.partners)
            if (!gen.has(p)) {
              gen.set(p, g - 1);
              next.push(p);
            }
      }
      frontier = next;
    }
    // Siblings of the focus person share its parents' family.
    if (!collapsedUp(focusId))
      for (const f of parentFamilies(doc, focusId)) for (const c of f.children) if (!gen.has(c)) gen.set(c, 0);
    // Descendants (with partners) of the focus person and its siblings.
    frontier = [...gen.entries()].filter(([, g]) => g === 0).map(([id]) => id);
    for (let g = 0; frontier.length; g++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const f of partnerFamilies(doc, id)) {
          for (const p of f.partners) if (!gen.has(p)) gen.set(p, g);
          if (!f.children.length) continue;
          const isSiblingBranch = g === 0 && id !== focusId && !partnerFamilies(doc, focusId).includes(f);
          // Show siblings' own families only one level deep so the focus line stays readable.
          const limit = isSiblingBranch ? Math.min(down < 0 ? 1 : down, 1) : down;
          if ((limit >= 0 && g + 1 > limit) || collapsedDown(id)) {
            hiddenChildren.add(id);
            continue;
          }
          for (const c of f.children)
            if (!gen.has(c)) {
              gen.set(c, g + 1);
              if (!isSiblingBranch) next.push(c);
            }
        }
      }
      frontier = next;
    }
  }

  // Flag hidden relatives for every visible person (drives the expand buttons on cards).
  for (const id of gen.keys()) {
    const pf = parentFamilies(doc, id).filter((f) => f.partners.length);
    if (pf.some((f) => f.partners.some((p) => !gen.has(p)))) hiddenParents.add(id);
    for (const f of partnerFamilies(doc, id)) if (f.children.some((c) => !gen.has(c))) hiddenChildren.add(id);
  }

  const families = doc.familyOrder.filter((fid) => {
    const f = doc.families[fid];
    const vp = f.partners.filter((p) => gen.has(p)).length;
    const vc = f.children.filter((c) => gen.has(c)).length;
    return vp >= 1 && vp + vc >= 2;
  });
  return { gen, families, hiddenParents, hiddenChildren, hiddenCount: doc.order.length - gen.size };
}
