import type { TreeDoc } from './types';
import { childrenOf, parentsOf, partnersOf, siblingsOf } from './relations';

export type NavDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Keyboard navigation between relatives among the cards currently shown.
 * - up: a parent; down: a child (the one drawn closest to the current card);
 * - left / right: the nearest sibling or partner drawn on that side, falling back to the nearest
 *   card in the same row (cousins, in-laws) so the arrows never dead-end while something is there.
 * Returns null when there is nobody in that direction.
 */
export function kinNeighbour(
  doc: TreeDoc,
  positions: Map<string, { x: number; y: number }>,
  id: string,
  dir: NavDirection,
): string | null {
  const here = positions.get(id);
  if (!here) return null;
  const shown = (ids: string[]) => ids.filter((x) => x !== id && positions.has(x));
  const nearestX = (ids: string[]) =>
    ids.sort((a, b) => Math.abs(positions.get(a)!.x - here.x) - Math.abs(positions.get(b)!.x - here.x) || positions.get(a)!.x - positions.get(b)!.x)[0] ?? null;

  if (dir === 'up') return nearestX(shown(parentsOf(doc, id)));
  if (dir === 'down') return nearestX(shown(childrenOf(doc, id)));

  const sideOk = (x: string) => (dir === 'left' ? positions.get(x)!.x < here.x : positions.get(x)!.x > here.x);
  const kin = shown([...siblingsOf(doc, id), ...partnersOf(doc, id)]).filter(sideOk);
  if (kin.length) return nearestX(kin);
  const row = [...positions.keys()].filter((x) => x !== id && Math.abs(positions.get(x)!.y - here.y) < 1 && sideOk(x));
  return nearestX(row);
}
