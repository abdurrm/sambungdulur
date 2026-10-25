import { useSyncExternalStore } from 'react';

/**
 * Single source of truth for responsive behaviour.
 *
 * - `layout` is the width class: `wide` (≥1100 px), `medium` (761–1099 px), `narrow` (≤760 px).
 * - `pointer` is the primary input: `coarse` (touch) or `fine` (mouse, trackpad, stylus with hover).
 *
 * Touch-specific behaviour (target sizes, tooltips, long-press) follows `pointer`, not width.
 * The App mirrors both values onto `data-layout` / `data-pointer` so CSS reads the same source.
 */
export type LayoutClass = 'wide' | 'medium' | 'narrow';
export type PointerKind = 'fine' | 'coarse';
export interface Viewport {
  layout: LayoutClass;
  pointer: PointerKind;
}

export const NARROW_MAX = 760;
export const WIDE_MIN = 1100;

const QUERIES = {
  narrow: `(max-width: ${NARROW_MAX}px)`,
  wide: `(min-width: ${WIDE_MIN}px)`,
  coarse: '(pointer: coarse)',
};

function mq(q: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null;
}

function read(): Viewport {
  const narrow = mq(QUERIES.narrow)?.matches ?? false;
  const wide = mq(QUERIES.wide)?.matches ?? true;
  const coarse = mq(QUERIES.coarse)?.matches ?? false;
  return { layout: narrow ? 'narrow' : wide ? 'wide' : 'medium', pointer: coarse ? 'coarse' : 'fine' };
}

let snapshot: Viewport = read();

function subscribe(onChange: () => void): () => void {
  const lists = Object.values(QUERIES).map(mq).filter((l): l is MediaQueryList => !!l);
  const handler = () => {
    const next = read();
    if (next.layout !== snapshot.layout || next.pointer !== snapshot.pointer) {
      snapshot = next;
      onChange();
    }
  };
  lists.forEach((l) => l.addEventListener('change', handler));
  // Orientation changes on some browsers only fire resize before the media lists settle.
  window.addEventListener('resize', handler);
  return () => {
    lists.forEach((l) => l.removeEventListener('change', handler));
    window.removeEventListener('resize', handler);
  };
}

/** Current viewport outside React (event handlers, initial state). */
export function getViewport(): Viewport {
  snapshot = read();
  return snapshot;
}

/** Re-renders when the width class or pointer kind changes (resize, rotation, docking a keyboard). */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
