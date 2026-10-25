/**
 * Keyboard shortcut registry: one table maps keys to commands, and the same table feeds the shortcut
 * list (Ctrl+H, F1, ?), tooltips and menus, so the documentation can never drift from the behaviour.
 */
import type { Key } from '../i18n';

export type Command =
  | 'search'
  | 'save'
  | 'open'
  | 'export'
  | 'help'
  | 'settings'
  | 'theme'
  | 'manual'
  | 'ancMore'
  | 'ancLess'
  | 'descMore'
  | 'descLess'
  | 'zoomIn'
  | 'zoomOut'
  | 'center'
  | 'navUp'
  | 'navDown'
  | 'navLeft'
  | 'navRight'
  | 'edit'
  | 'photo'
  | 'addParents'
  | 'addSibling'
  | 'addPartner'
  | 'addChild'
  | 'focusPerson'
  | 'selectFocus'
  | 'prevPerson'
  | 'nextPerson'
  | 'tab1'
  | 'tab2'
  | 'tab3'
  | 'saveForm'
  | 'delete'
  | 'undo'
  | 'redo'
  | 'escape';

export type ShortcutGroup = 'file' | 'navigation' | 'person' | 'view' | 'history' | 'help';
export const SHORTCUT_GROUPS: ShortcutGroup[] = ['file', 'navigation', 'person', 'view', 'history', 'help'];

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface Shortcut {
  command: Command;
  group: ShortcutGroup;
  /** Keys as shown to the user, e.g. ["Ctrl", "F"]. "Ctrl" is shown as ⌘ on Apple devices. */
  keys: string[][];
  label: Key;
  /** Still active while typing in a text field. */
  whileTyping?: boolean;
  /** Arrow keys, Enter and Delete belong to a focused button, tab or slider; don't steal them there. */
  yieldsToControls?: boolean;
  /** Single letters: only while focus is in the tree (canvas, editor, page body), never in the header. */
  treeOnly?: boolean;
  /** Acts on the selected person: inactive when nobody is selected. */
  needsSelection?: boolean;
  /** Only inside the edit form. */
  inForm?: boolean;
  match: (e: KeyLike) => boolean;
}

/** Ctrl, or ⌘ on Apple keyboards. */
const mod = (e: KeyLike) => !!(e.ctrlKey || e.metaKey);
const plain = (e: KeyLike) => !e.ctrlKey && !e.metaKey && !e.altKey;
const k = (e: KeyLike) => e.key.toLowerCase();
const letter = (ch: string) => (e: KeyLike) => plain(e) && !e.shiftKey && k(e) === ch;
/** Alt+digit (the digit key may report a symbol on some layouts, so `code` is checked as well). */
const altDigit = (e: KeyLike, d: string) => !!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === d || e.code === `Digit${d}`);

export const SHORTCUTS: Shortcut[] = [
  // File
  { command: 'open', group: 'file', keys: [['Ctrl', 'O']], label: 'scOpen', whileTyping: true, match: (e) => mod(e) && !e.shiftKey && !e.altKey && k(e) === 'o' },
  { command: 'save', group: 'file', keys: [['Ctrl', 'S']], label: 'scSave', whileTyping: true, match: (e) => mod(e) && !e.shiftKey && !e.altKey && k(e) === 's' },
  { command: 'export', group: 'file', keys: [['Ctrl', 'E']], label: 'scExport', whileTyping: true, match: (e) => mod(e) && !e.shiftKey && !e.altKey && k(e) === 'e' },
  // Navigation
  {
    command: 'search',
    group: 'navigation',
    keys: [['Ctrl', 'F'], ['Ctrl', 'K']],
    label: 'scSearch',
    whileTyping: true,
    match: (e) => mod(e) && !e.shiftKey && !e.altKey && (k(e) === 'f' || k(e) === 'k'),
  },
  { command: 'navUp', group: 'navigation', keys: [['↑']], label: 'scNavUp', yieldsToControls: true, match: (e) => plain(e) && !e.shiftKey && e.key === 'ArrowUp' },
  { command: 'navDown', group: 'navigation', keys: [['↓']], label: 'scNavDown', yieldsToControls: true, match: (e) => plain(e) && !e.shiftKey && e.key === 'ArrowDown' },
  {
    command: 'navLeft',
    group: 'navigation',
    keys: [['←'], ['→']],
    label: 'scNavSide',
    yieldsToControls: true,
    match: (e) => plain(e) && !e.shiftKey && e.key === 'ArrowLeft',
  },
  { command: 'navRight', group: 'navigation', keys: [], label: 'scNavSide', yieldsToControls: true, match: (e) => plain(e) && !e.shiftKey && e.key === 'ArrowRight' },
  { command: 'selectFocus', group: 'navigation', keys: [['Home']], label: 'scHome', yieldsToControls: true, treeOnly: true, match: (e) => plain(e) && !e.shiftKey && e.key === 'Home' },
  { command: 'prevPerson', group: 'navigation', keys: [['['], [']']], label: 'scPrevNext', treeOnly: true, match: (e) => plain(e) && e.key === '[' },
  { command: 'nextPerson', group: 'navigation', keys: [], label: 'scPrevNext', treeOnly: true, match: (e) => plain(e) && e.key === ']' },
  // Person
  { command: 'edit', group: 'person', keys: [['Enter']], label: 'scEdit', yieldsToControls: true, match: (e) => plain(e) && !e.shiftKey && e.key === 'Enter' },
  // Single letters for the selected person, from English words so they stay the same in every language:
  // Edit, Parents, Sibling, pArtner, Child, Focus, Image.
  { command: 'edit', group: 'person', keys: [['E']], label: 'scEdit', treeOnly: true, needsSelection: true, match: letter('e') },
  { command: 'addParents', group: 'person', keys: [['P']], label: 'scAddParents', treeOnly: true, needsSelection: true, match: letter('p') },
  { command: 'addSibling', group: 'person', keys: [['S']], label: 'scAddSibling', treeOnly: true, needsSelection: true, match: letter('s') },
  { command: 'addPartner', group: 'person', keys: [['A']], label: 'scAddPartner', treeOnly: true, needsSelection: true, match: letter('a') },
  { command: 'addChild', group: 'person', keys: [['C']], label: 'scAddChild', treeOnly: true, needsSelection: true, match: letter('c') },
  { command: 'focusPerson', group: 'person', keys: [['F']], label: 'scFocusPerson', treeOnly: true, needsSelection: true, match: letter('f') },
  { command: 'photo', group: 'person', keys: [['I']], label: 'scPhoto', treeOnly: true, needsSelection: true, match: letter('i') },
  {
    command: 'tab1',
    group: 'person',
    keys: [['Alt', '1'], ['Alt', '2'], ['Alt', '3']],
    label: 'scTabs',
    whileTyping: true,
    needsSelection: true,
    match: (e) => altDigit(e, '1'),
  },
  { command: 'tab2', group: 'person', keys: [], label: 'scTabs', whileTyping: true, needsSelection: true, match: (e) => altDigit(e, '2') },
  { command: 'tab3', group: 'person', keys: [], label: 'scTabs', whileTyping: true, needsSelection: true, match: (e) => altDigit(e, '3') },
  { command: 'saveForm', group: 'person', keys: [['Ctrl', 'Enter']], label: 'scSaveForm', whileTyping: true, inForm: true, match: (e) => mod(e) && !e.altKey && !e.shiftKey && e.key === 'Enter' },
  { command: 'delete', group: 'person', keys: [['Delete']], label: 'scDelete', yieldsToControls: true, match: (e) => plain(e) && (e.key === 'Delete' || e.key === 'Backspace') },
  // View
  { command: 'zoomIn', group: 'view', keys: [['+']], label: 'scZoomIn', match: (e) => plain(e) && (e.key === '+' || e.key === '=') },
  { command: 'zoomOut', group: 'view', keys: [['−']], label: 'scZoomOut', match: (e) => plain(e) && (e.key === '-' || e.key === '_') },
  { command: 'center', group: 'view', keys: [['0']], label: 'scCenter', match: (e) => plain(e) && e.key === '0' },
  { command: 'settings', group: 'view', keys: [['Ctrl', ',']], label: 'scSettings', whileTyping: true, match: (e) => mod(e) && !e.altKey && e.key === ',' },
  { command: 'theme', group: 'view', keys: [['Ctrl', 'Shift', 'L']], label: 'scTheme', whileTyping: true, match: (e) => mod(e) && !!e.shiftKey && !e.altKey && k(e) === 'l' },
  { command: 'manual', group: 'view', keys: [['M']], label: 'scManual', treeOnly: true, match: letter('m') },
  { command: 'ancMore', group: 'view', keys: [['Ctrl', '↑']], label: 'scAncMore', match: (e) => mod(e) && !e.shiftKey && !e.altKey && e.key === 'ArrowUp' },
  { command: 'ancLess', group: 'view', keys: [['Ctrl', '↓']], label: 'scAncLess', match: (e) => mod(e) && !e.shiftKey && !e.altKey && e.key === 'ArrowDown' },
  { command: 'descMore', group: 'view', keys: [['Ctrl', 'Shift', '↑']], label: 'scDescMore', match: (e) => mod(e) && !!e.shiftKey && !e.altKey && e.key === 'ArrowUp' },
  { command: 'descLess', group: 'view', keys: [['Ctrl', 'Shift', '↓']], label: 'scDescLess', match: (e) => mod(e) && !!e.shiftKey && !e.altKey && e.key === 'ArrowDown' },
  // History
  { command: 'undo', group: 'history', keys: [['Ctrl', 'Z']], label: 'scUndo', match: (e) => mod(e) && !e.shiftKey && !e.altKey && k(e) === 'z' },
  {
    command: 'redo',
    group: 'history',
    keys: [['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']],
    label: 'scRedo',
    match: (e) => (mod(e) && !!e.shiftKey && !e.altKey && k(e) === 'z') || (mod(e) && !e.shiftKey && !e.altKey && k(e) === 'y'),
  },
  // Help
  {
    command: 'help',
    group: 'help',
    keys: [['Ctrl', 'H'], ['F1'], ['?']],
    label: 'scHelp',
    match: (e) => (mod(e) && !e.shiftKey && !e.altKey && k(e) === 'h') || (e.key === 'F1' && !e.altKey) || (!e.ctrlKey && !e.metaKey && e.key === '?'),
  },
  { command: 'escape', group: 'navigation', keys: [['Esc']], label: 'scEscape', whileTyping: true, match: (e) => e.key === 'Escape' },
];

/** Keys that are still active while typing although their entry is not (F1 and Ctrl+H never type text). */
const typedHelp = (e: KeyLike) => e.key === 'F1' || (mod(e) && k(e) === 'h');

export interface KeyContext {
  /** Focus is in a text input, textarea, select or editable element. */
  typing: boolean;
  /** Focus is on a button, link, tab, menu item or slider that handles its own keys. */
  onControl: boolean;
  /** Focus is in the tree: the canvas, the editor, or nowhere in particular (page body). */
  inTree?: boolean;
  /** Focus is inside the edit form. */
  inForm?: boolean;
  /** A person is selected. */
  hasSelection?: boolean;
}

export function commandFor(e: KeyLike, ctx: KeyContext, registry: Shortcut[] = SHORTCUTS): Command | null {
  for (const s of registry) {
    if (!s.match(e)) continue;
    if (ctx.typing && !s.whileTyping && !(s.command === 'help' && typedHelp(e))) return null;
    if (ctx.onControl && s.yieldsToControls) return null;
    if (s.treeOnly && !ctx.inTree) return null;
    if (s.needsSelection && !ctx.hasSelection) return null;
    if (s.inForm && !ctx.inForm) return null;
    return s.command;
  }
  return null;
}

/** Classifies the focused element for `commandFor`. Tree areas are marked with `data-key-scope="tree"`. */
export function keyContext(target: EventTarget | null): KeyContext {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return { typing: false, onControl: false, inTree: true, inForm: false };
  const typing =
    el.isContentEditable ||
    (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(el.type)) ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement;
  const onControl =
    !typing &&
    !!el.closest('button, a[href], input, [role="button"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="separator"], [role="slider"], [role="dialog"], [role="menu"]');
  const inTree = el === document.body || el === document.documentElement || !!el.closest('[data-key-scope="tree"]');
  const inForm = !!el.closest('[data-testid="edit-form"]');
  return { typing, onControl, inTree, inForm };
}

function isApple() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Display form of a key chord for the current platform: "Ctrl+Shift+L", or "⌘⇧L" on Apple devices. */
export function showKeys(keys: string[], apple = isApple()): string {
  const sym: Record<string, string> = apple ? { Ctrl: '⌘', Shift: '⇧', Alt: '⌥' } : {};
  return keys.map((x) => sym[x] ?? x).join(apple ? '' : '+');
}

/** Keys for a command, for tooltips and menus: "Ctrl+F". `all`: every entry's first chord, "Enter / E". */
export function shortcutText(command: Command, opts: { all?: boolean } = {}): string | undefined {
  const entries = SHORTCUTS.filter((x) => x.command === command && x.keys.length);
  if (!entries.length) return undefined;
  return (opts.all ? entries : entries.slice(0, 1)).map((s) => showKeys(s.keys[0])).join(' / ');
}
