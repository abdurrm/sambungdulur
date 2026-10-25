/** Generations shown above/below the focus person step through 0 … 10, then "All" (-1), and back. */
export function stepGeneration(cur: number, delta: 1 | -1): number {
  if (delta > 0) return cur < 0 || cur >= 10 ? -1 : cur + 1;
  return cur < 0 ? 10 : Math.max(0, cur - 1);
}
