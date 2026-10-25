/**
 * Undo / redo over whole-document snapshots. Documents are immutable values (every mutation returns a
 * new TreeDoc), so a snapshot is just a reference: cheap to keep, exact to restore.
 */
export interface History<T> {
  past: T[];
  future: T[];
  /** Coalescing: consecutive records with the same key within `windowMs` collapse into one step. */
  lastKey?: string;
  lastAt?: number;
}

export const HISTORY_LIMIT = 50;
const COALESCE_MS = 1000;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/** Remember `before` as the state to return to, and drop the redo branch. */
export function record<T>(h: History<T>, before: T, opts: { key?: string; now?: number; limit?: number } = {}): History<T> {
  const now = opts.now ?? Date.now();
  if (opts.key && h.lastKey === opts.key && h.lastAt !== undefined && now - h.lastAt < COALESCE_MS && h.past.length) {
    // Typing in one field: keep the state from before the first keystroke.
    return { ...h, future: [], lastAt: now };
  }
  const limit = opts.limit ?? HISTORY_LIMIT;
  const past = [...h.past, before];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, future: [], lastKey: opts.key, lastAt: now };
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (!h.past.length) return null;
  const value = h.past[h.past.length - 1];
  return { value, history: { past: h.past.slice(0, -1), future: [current, ...h.future] } };
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (!h.future.length) return null;
  const [value, ...future] = h.future;
  return { value, history: { past: [...h.past, current], future } };
}
