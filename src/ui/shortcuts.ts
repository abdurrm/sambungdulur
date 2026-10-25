/**
 * Keyboard shortcut registry: one table maps keys to commands, and the same table feeds the "?" help
 * dialog and tooltips, so the documentation can never drift from the behaviour.
 */
import type { Key } from '../i18n';

export type Command =
  | 'search'
  | 'save'
  | 'help'
  | 'zoomIn'
  | 'zoomOut'
  | 'center'
  | 'navUp'
  | 'navDown'
  | 'navLeft'
  | 'navRight'
  | 'edit'
  | 'delete'
  | 'undo'
  | 'redo'
  | 'escape';

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface Shortcut {
  command: Command;
  /** Keys as shown to the user, e.g. ["Ctrl", "F"]. "Ctrl" is shown as ⌘ on Apple devices. */
  keys: string[][];
  label: Key;
  /** Still active while typing in a text field. */
  whileTyping?: boolean;
  /** Arrow keys, Enter and Delete belong to a focused button, tab or slider; don't steal them there. */
  yieldsToControls?: boolean;
  match: (e: KeyLike) => boolean;
}

const mod = (e: KeyLike) => !!(e.ctrlKey || e.metaKey);
const plain = (e: KeyLike) => !e.ctrlKey && !e.metaKey && !e.altKey;
const k = (e: KeyLike) => e.key.toLowerCase();

export const SHORTCUTS: Shortcut[] = [
  { command: 'search', keys: [['Ctrl', 'F']], label: 'scSearch', whileTyping: true, match: (e) => mod(e) && !e.shiftKey && k(e) === 'f' },
  { command: 'save', keys: [['Ctrl', 'S']], label: 'scSave', whileTyping: true, match: (e) => mod(e) && !e.shiftKey && k(e) === 's' },
  { command: 'undo', keys: [['Ctrl', 'Z']], label: 'scUndo', match: (e) => mod(e) && !e.shiftKey && k(e) === 'z' },
  {
    command: 'redo',
    keys: [['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']],
    label: 'scRedo',
    match: (e) => (mod(e) && e.shiftKey && k(e) === 'z') || (mod(e) && !e.shiftKey && k(e) === 'y'),
  },
  { command: 'navUp', keys: [['↑']], label: 'scNavUp', yieldsToControls: true, match: (e) => plain(e) && e.key === 'ArrowUp' },
  { command: 'navDown', keys: [['↓']], label: 'scNavDown', yieldsToControls: true, match: (e) => plain(e) && e.key === 'ArrowDown' },
  {
    command: 'navLeft',
    keys: [['←'], ['→']],
    label: 'scNavSide',
    yieldsToControls: true,
    match: (e) => plain(e) && e.key === 'ArrowLeft',
  },
  { command: 'navRight', keys: [], label: 'scNavSide', yieldsToControls: true, match: (e) => plain(e) && e.key === 'ArrowRight' },
  { command: 'edit', keys: [['Enter']], label: 'scEdit', yieldsToControls: true, match: (e) => plain(e) && e.key === 'Enter' },
  { command: 'delete', keys: [['Delete']], label: 'scDelete', yieldsToControls: true, match: (e) => plain(e) && (e.key === 'Delete' || e.key === 'Backspace') },
  { command: 'zoomIn', keys: [['+']], label: 'scZoomIn', match: (e) => plain(e) && (e.key === '+' || e.key === '=') },
  { command: 'zoomOut', keys: [['−']], label: 'scZoomOut', match: (e) => plain(e) && (e.key === '-' || e.key === '_') },
  { command: 'center', keys: [['0']], label: 'scCenter', match: (e) => plain(e) && e.key === '0' },
  { command: 'help', keys: [['?']], label: 'scHelp', match: (e) => !e.ctrlKey && !e.metaKey && e.key === '?' },
  { command: 'escape', keys: [['Esc']], label: 'scEscape', whileTyping: true, match: (e) => e.key === 'Escape' },
];

export interface KeyContext {
  /** Focus is in a text input, textarea, select or editable element. */
  typing: boolean;
  /** Focus is on a button, link, tab, menu item or slider that handles its own keys. */
  onControl: boolean;
}

export function commandFor(e: KeyLike, ctx: KeyContext): Command | null {
  for (const s of SHORTCUTS) {
    if (!s.match(e)) continue;
    if (ctx.typing && !s.whileTyping) return null;
    if (ctx.onControl && s.yieldsToControls) return null;
    return s.command;
  }
  return null;
}

/** Classifies the focused element for `commandFor`. */
export function keyContext(target: EventTarget | null): KeyContext {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return { typing: false, onControl: false };
  const typing =
    el.isContentEditable ||
    (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(el.type)) ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement;
  const onControl =
    !typing &&
    !!el.closest('button, a[href], input, [role="button"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="separator"], [role="slider"], [role="dialog"], [role="menu"]');
  return { typing, onControl };
}

/** Display form of a key chord for the current platform. */
export function showKeys(keys: string[]): string {
  const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return keys.map((x) => (x === 'Ctrl' && apple ? '⌘' : x)).join(apple ? '' : '+');
}

/** Keys for a command, for tooltips: "Ctrl+F". */
export function shortcutText(command: Command): string | undefined {
  const s = SHORTCUTS.find((x) => x.command === command);
  return s && s.keys.length ? showKeys(s.keys[0]) : undefined;
}
