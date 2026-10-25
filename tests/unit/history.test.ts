import { describe, expect, it } from 'vitest';
import { emptyHistory, HISTORY_LIMIT, record, redo, undo } from '../../src/model/history';

describe('undo history', () => {
  it('undoes and redoes in order', () => {
    let h = emptyHistory<string>();
    h = record(h, 'a', { now: 0 });
    h = record(h, 'b', { now: 5000 });
    // current is "c"
    const u1 = undo(h, 'c')!;
    expect(u1.value).toBe('b');
    const u2 = undo(u1.history, 'b')!;
    expect(u2.value).toBe('a');
    expect(undo(u2.history, 'a')).toBeNull();
    const r1 = redo(u2.history, 'a')!;
    expect(r1.value).toBe('b');
    const r2 = redo(r1.history, 'b')!;
    expect(r2.value).toBe('c');
    expect(redo(r2.history, 'c')).toBeNull();
  });

  it('a new change drops the redo branch', () => {
    let h = record(emptyHistory<string>(), 'a', { now: 0 });
    const u = undo(h, 'b')!;
    h = record(u.history, 'a', { now: 5000 });
    expect(h.future).toEqual([]);
    expect(redo(h, 'x')).toBeNull();
  });

  it('keeps at most the limit', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, i, { now: i * 5000 });
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
  });

  it('coalesces fast edits of the same field into one step', () => {
    let h = emptyHistory<string>();
    h = record(h, '', { key: 'title', now: 0 });
    h = record(h, 'M', { key: 'title', now: 200 });
    h = record(h, 'My', { key: 'title', now: 400 });
    expect(h.past).toEqual(['']);
    h = record(h, 'My T', { key: 'title', now: 2000 }); // a pause starts a new step
    expect(h.past).toEqual(['', 'My T']);
    h = record(h, 'x', { key: 'person', now: 2100 }); // a different field too
    expect(h.past.length).toBe(3);
  });
});
