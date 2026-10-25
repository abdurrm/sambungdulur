/**
 * Which Phosphor weights are bundled (read by vite.config.ts and by ui/icons.tsx).
 * Every icon keeps `regular`. Only icons that are drawn as a primary button or as an active toggle
 * keep `fill`, and only empty-state illustrations keep `duotone`; the other weights are dropped from
 * the bundle. An icon asked for a weight it does not have falls back to `regular`.
 */
export const FILL_ICONS = ['PencilSimple', 'DownloadSimple', 'MagnifyingGlass', 'SlidersHorizontal', 'Layout', 'DotsThree', 'PushPin'];
export const DUOTONE_ICONS = ['TreeStructure'];

export function hasWeight(icon: string, weight: string): boolean {
  if (weight === 'regular') return true;
  if (weight === 'fill') return FILL_ICONS.includes(icon);
  if (weight === 'duotone') return DUOTONE_ICONS.includes(icon);
  return false;
}
