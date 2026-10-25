import { describe, expect, it } from 'vitest';
import { commandFor, SHORTCUT_GROUPS, SHORTCUTS, showKeys, type KeyLike, type Shortcut } from '../../src/ui/shortcuts';
import { stepGeneration } from '../../src/model/generations';

const free = { typing: false, onControl: false, inTree: true };
const ARROWS: Record<string, string> = { '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight', '−': '-', Esc: 'Escape' };

/** The key event a user produces for a chord as listed in the shortcut list. */
function eventFor(chord: string[]): KeyLike {
  const e: KeyLike = { key: '' };
  for (const part of chord) {
    if (part === 'Ctrl') e.ctrlKey = true;
    else if (part === 'Shift') e.shiftKey = true;
    else if (part === 'Alt') e.altKey = true;
    else e.key = ARROWS[part] ?? (part.length === 1 ? part.toLowerCase() : part);
  }
  if (e.key === '?') e.shiftKey = true;
  return e;
}

describe('grouped shortcut registry', () => {
  it('every listed chord runs its own command and matches no other entry', () => {
    for (const s of SHORTCUTS) {
      for (const chord of s.keys) {
        const e = eventFor(chord);
        // One row may list keys of sibling entries with the same label (← / → for "sibling or partner").
        const matching = SHORTCUTS.filter((x) => x.match(e));
        expect(matching.length, chord.join('+')).toBe(1);
        expect(matching[0].label, chord.join('+')).toBe(s.label);
        expect(commandFor(e, { ...free, hasSelection: true, inForm: s.inForm }), chord.join('+')).toBe(matching[0].command);
      }
    }
  });

  it('no two entries list the same key combination', () => {
    const seen = new Map<string, string>();
    for (const s of SHORTCUTS) {
      for (const chord of s.keys) {
        const id = chord.join('+').toLowerCase();
        expect(seen.get(id), id).toBeUndefined();
        seen.set(id, s.command);
      }
    }
  });

  it('puts every entry in a known group', () => {
    for (const s of SHORTCUTS) expect(SHORTCUT_GROUPS).toContain(s.group);
    for (const g of SHORTCUT_GROUPS) expect(SHORTCUTS.some((s) => s.group === g && s.keys.length), g).toBe(true);
  });

  it('maps the new file and view chords, with ⌘ on Apple keyboards', () => {
    const cases: [KeyLike, string][] = [
      [{ key: 'h', ctrlKey: true }, 'help'],
      [{ key: 'F1' }, 'help'],
      [{ key: '?', shiftKey: true }, 'help'],
      [{ key: 'o', ctrlKey: true }, 'open'],
      [{ key: 'e', ctrlKey: true }, 'export'],
      [{ key: 'k', ctrlKey: true }, 'search'],
      [{ key: ',', ctrlKey: true }, 'settings'],
      [{ key: 'L', ctrlKey: true, shiftKey: true }, 'theme'],
      [{ key: 'm' }, 'manual'],
      [{ key: 'ArrowUp', ctrlKey: true }, 'ancMore'],
      [{ key: 'ArrowDown', ctrlKey: true }, 'ancLess'],
      [{ key: 'ArrowUp', ctrlKey: true, shiftKey: true }, 'descMore'],
      [{ key: 'ArrowDown', ctrlKey: true, shiftKey: true }, 'descLess'],
    ];
    for (const [e, cmd] of cases) {
      expect(commandFor(e, free), JSON.stringify(e)).toBe(cmd);
      if (e.ctrlKey) expect(commandFor({ ...e, ctrlKey: false, metaKey: true }, free), 'meta ' + JSON.stringify(e)).toBe(cmd);
    }
    expect(showKeys(['Ctrl', 'Shift', 'L'], true)).toBe('⌘⇧L');
    expect(showKeys(['Ctrl', 'Shift', 'L'], false)).toBe('Ctrl+Shift+L');
  });

  it('avoids chords the browser or the OS keeps: Ctrl+0, Alt+letters, Ctrl+Shift+M', () => {
    const chords = SHORTCUTS.flatMap((s) => s.keys.map((k) => k.join('+')));
    expect(chords).not.toContain('Ctrl+0');
    expect(chords).not.toContain('Ctrl+Shift+M');
    expect(chords.filter((c) => /^Alt\+[A-Z]$/.test(c))).toEqual([]);
    expect(commandFor({ key: '0', ctrlKey: true }, free)).toBeNull();
    expect(commandFor({ key: 'm', ctrlKey: true, shiftKey: true }, free)).toBeNull();
    expect(commandFor({ key: 'm', altKey: true }, free)).toBeNull();
  });

  it('single letters work only in the tree and never while typing', () => {
    expect(commandFor({ key: 'm' }, { typing: false, onControl: false, inTree: true })).toBe('manual');
    expect(commandFor({ key: 'm' }, { typing: true, onControl: false, inTree: true })).toBeNull();
    expect(commandFor({ key: 'm' }, { typing: false, onControl: true, inTree: false })).toBeNull();
    expect(commandFor({ key: 'M', shiftKey: true }, free)).toBeNull();
    // Help chords that never type text still work in a text field; "?" does not.
    expect(commandFor({ key: 'h', ctrlKey: true }, { typing: true, onControl: false })).toBe('help');
    expect(commandFor({ key: 'F1' }, { typing: true, onControl: false })).toBe('help');
    expect(commandFor({ key: '?', shiftKey: true }, { typing: true, onControl: false })).toBeNull();
  });

  it('honours needsSelection and inForm', () => {
    const reg: Shortcut[] = [
      { command: 'edit', group: 'person', keys: [['E']], label: 'scEdit', treeOnly: true, needsSelection: true, match: (e) => e.key === 'e' },
      { command: 'save', group: 'person', keys: [['Ctrl', 'Enter']], label: 'scSave', whileTyping: true, inForm: true, match: (e) => !!e.ctrlKey && e.key === 'Enter' },
    ];
    expect(commandFor({ key: 'e' }, { ...free, hasSelection: false }, reg)).toBeNull();
    expect(commandFor({ key: 'e' }, { ...free, hasSelection: true }, reg)).toBe('edit');
    expect(commandFor({ key: 'Enter', ctrlKey: true }, { typing: true, onControl: false, inForm: false }, reg)).toBeNull();
    expect(commandFor({ key: 'Enter', ctrlKey: true }, { typing: true, onControl: false, inForm: true }, reg)).toBe('save');
  });

  it('steps generations 0 … 10, then All, and back', () => {
    expect(stepGeneration(-1, -1)).toBe(10);
    expect(stepGeneration(10, 1)).toBe(-1);
    expect(stepGeneration(3, 1)).toBe(4);
    expect(stepGeneration(0, -1)).toBe(0);
    expect(stepGeneration(-1, 1)).toBe(-1);
  });
});
