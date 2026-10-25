import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unzipSync } from 'fflate';
import {
  CircleHelp, Download, FolderOpen, Moon, Save, Search, Settings2, Sun, LayoutTemplate, RotateCcw, ZoomIn, ZoomOut, Maximize, MoreHorizontal, MonitorDown,
} from 'lucide-react';
import type { PersonFields, TreeDoc, TreeSettings } from './model/types';
import { DEFAULT_SETTINGS } from './model/types';
import { createDefaultTree } from './model/defaultTree';
import {
  addChild, addParents, addPartner, addSibling, deleteBlocker, deletePerson, displayName, RelationError, updatePerson, type AddChildMode,
  components,
} from './model/relations';
import { selectVisible } from './layout/visible';
import { computeLayout, lineage } from './layout/layout';
import { importGedcom, basename } from './gedcom/gedcom';
import { importFtbZip } from './ftb/importFtb';
import { buildSambung, isSambung, parseSambung } from './io/sambungFile';
import { downloadBlob, safeFileName } from './io/imageExport';
import * as store from './storage/idb';
import { TreeCanvas, ZOOM_MAX, ZOOM_MIN, type CanvasApi, type CanvasInset } from './ui/TreeCanvas';
import { PANEL_DEFAULT, Sidebar } from './ui/Sidebar';
import { SHEET_BAR_PX, type SheetSnap } from './ui/sheetSnap';
import { useBackToClose } from './ui/backToClose';
import { emptyHistory, record, redo as redoStep, undo as undoStep, type History } from './model/history';
import { GenerationControl, LanguageSelect, SettingsMenu } from './ui/SettingsMenu';
import { SearchPanel } from './ui/SearchPanel';
import type { OpenReport } from './ui/OpenDialog';
import type { MenuAnchor } from './ui/PersonMenu';
import type { PersonActionId } from './model/personActions';
import { GUIDE_URL } from './links';
import { initialLang, LANG_KEY, setLang as setI18nLang, t, type Lang } from './i18n';
import { getViewport, useViewport } from './ui/viewport';
import { commandFor, keyContext, shortcutText, type Command } from './ui/shortcuts';
import { kinNeighbour } from './model/kinNav';
import { personLabel } from './model/a11y';
import { ONBOARDED_KEY, OnboardingHint } from './ui/OnboardingHint';

// Loaded on demand (and precached by the service worker for offline use): not needed for the first view.
const loadDialogs = () => import('./ui/dialogs');
const loadToasts = () => import('./ui/toasts');
const Toasts = lazy(() => loadToasts().then((m) => ({ default: m.Toasts })));
/** Queue a toast; the Base UI toast module loads on demand (it is warmed at idle). */
function notify(text: string, opts?: Parameters<typeof import('./ui/toasts').notify>[1]) {
  void loadToasts().then((m) => m.notify(text, opts));
}
const loadPopups = () => import('./ui/HeaderPopups');
const MoreMenu = lazy(() => import('./ui/MoreMenu'));
const TooltipLayer = lazy(() => import('./ui/TooltipLayer'));
/** Accessible name plus the tooltip text (with the keyboard shortcut, if there is one). */
function tip(label: string, cmd?: Command) {
  const keys = cmd ? shortcutText(cmd) : undefined;
  return { 'aria-label': label, 'data-tip': keys && !label.includes(keys) ? `${label} (${keys})` : label };
}
const PersonMenu = lazy(() => import('./ui/PersonMenu'));
const ToolPopover = lazy(() => loadPopups().then((m) => ({ default: m.ToolPopover })));
const AddChildDialog = lazy(() => loadDialogs().then((m) => ({ default: m.AddChildDialog })));
const ConfirmDialog = lazy(() => loadDialogs().then((m) => ({ default: m.ConfirmDialog })));
const ManualLayoutInfo = lazy(() => loadDialogs().then((m) => ({ default: m.ManualLayoutInfo })));
const MessageDialog = lazy(() => loadDialogs().then((m) => ({ default: m.MessageDialog })));
const ShortcutsDialog = lazy(() => loadDialogs().then((m) => ({ default: m.ShortcutsDialog })));
/** Warm the on-demand chunks once the first view is up, so the first click never waits. */
function preloadLazyUi() {
  const run = () => {
    void loadDialogs();
    void loadToasts();
    void loadPopups();
    void import('./ui/MoreMenu');
    if (getViewport().pointer === 'fine') void import('./ui/TooltipLayer');
    void import('./ui/PersonMenu');
    void import('./ui/ExportDialog');
    void import('./ui/OpenDialog');
    void import('./ui/SheetFrame');
  };
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 800);
}
const CropDialog = lazy(() => import('./ui/CropDialog').then((m) => ({ default: m.CropDialog })));
const ExportDialog = lazy(() => import('./ui/ExportDialog').then((m) => ({ default: m.ExportDialog })));
const OpenDialog = lazy(() => import('./ui/OpenDialog').then((m) => ({ default: m.OpenDialog })));

type Dialog =
  | null
  | { kind: 'addChild'; personId: string }
  | { kind: 'confirmDelete'; personId: string }
  | { kind: 'confirmReset' }
  | { kind: 'confirmDeleteImage'; personId: string }
  | { kind: 'confirmResetManual' }
  | { kind: 'message'; title: string; text: string }
  | { kind: 'manualInfo' }
  | { kind: 'crop'; file: File; personId: string }
  | { kind: 'export' }
  | { kind: 'open' }
  | { kind: 'shortcuts' };

const MANUAL_INFO_KEY = 'sambungdulur.manualInfoSeen';
const PANEL_KEY = 'sambungdulur.panel';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

async function initSql() {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm-browser.wasm?url'),
  ]);
  return initSqlJs({ locateFile: () => wasmUrl });
}

function decodeText(bytes: Uint8Array): { text: string; note?: string } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), note: t('notUtf8') };
  }
}

function withDefaults(doc: TreeDoc): TreeDoc {
  return {
    ...doc,
    settings: { ...DEFAULT_SETTINGS, ...doc.settings },
    manual: doc.manual ?? { personDx: {}, familyDy: {} },
    collapsed: doc.collapsed ?? {},
    compactCards: doc.compactCards ?? {},
    gallery: doc.gallery ?? {},
    media: doc.media ?? {},
  };
}

export default function App() {
  // Language is an app preference (not part of a tree). Set before anything renders text.
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang();
    setI18nLang(l);
    return l;
  });
  const changeLang = (l: Lang) => {
    setI18nLang(l);
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  };
  const [doc, setDocState] = useState<TreeDoc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Map<string, string>>(new Map());
  const viewport = useViewport();
  const narrow = viewport.layout === 'narrow';
  const wide = viewport.layout === 'wide';
  useEffect(() => {
    document.documentElement.dataset.layout = viewport.layout;
    document.documentElement.dataset.pointer = viewport.pointer;
  }, [viewport.layout, viewport.pointer]);
  // Editor panel: on desktop its width and open state are remembered; on tablets it is a drawer that
  // starts closed and opens when a person is picked.
  const [panel, setPanel] = useState<{ width: number; hidden: boolean }>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(PANEL_KEY) ?? 'null');
      if (v && typeof v.width === 'number') return { width: v.width, hidden: !!v.hidden };
    } catch {
      /* ignore */
    }
    return { width: PANEL_DEFAULT, hidden: false };
  });
  useEffect(() => localStorage.setItem(PANEL_KEY, JSON.stringify(panel)), [panel]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarHidden = viewport.layout === 'medium' ? !drawerOpen : panel.hidden;
  const setSidebarHidden = (hidden: boolean) => {
    if (getViewport().layout === 'medium') setDrawerOpen(!hidden);
    else setPanel((p) => ({ ...p, hidden }));
  };
  const [popover, setPopover] = useState<null | 'settings' | 'search' | 'more' | 'gens'>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  // Screen-reader announcements (polite live region); toasts announce themselves.
  const [announcement, setAnnouncement] = useState('');
  const announce = (text: string) => setAnnouncement((cur) => (cur === text ? `${text} ` : text));
  const [onboarding, setOnboarding] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY);
    } catch {
      return false;
    }
  });
  const dismissOnboarding = () => {
    setOnboarding(false);
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* no storage */
    }
  };
  const [cardMenu, setCardMenu] = useState<{ id: string; anchor: MenuAnchor } | null>(null);
  const [editRequest, setEditRequest] = useState<{ id: string; n: number } | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [matches, setMatches] = useState<Set<string>>(new Set());
  const [draftDx, setDraftDx] = useState<Record<string, number>>({});
  const [draftDy, setDraftDy] = useState<Record<string, number>>({});
  const [live, setLive] = useState<{ kind: 'move' | 'bus'; id: string; delta: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const canvas = useRef<CanvasApi>(null);
  const undoRef = useRef<() => boolean>(() => false);
  // Phone editor sheet. Its height is known from the snap point, so the canvas inset follows it directly.
  const [sheet, setSheet] = useState<SheetSnap>('bar');
  const [viewH, setViewH] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const sheetSnap: SheetSnap = manualMode ? 'bar' : sheet;
  const inset = useMemo<CanvasInset>(
    () =>
      narrow
        ? { left: 0, bottom: sheetSnap === 'bar' ? SHEET_BAR_PX : sheetSnap === 'half' ? Math.round(viewH * 0.5) : viewH }
        : { left: viewport.layout === 'medium' && drawerOpen && !manualMode ? panel.width : 0, bottom: 0 },
    [narrow, sheetSnap, viewH, viewport.layout, drawerOpen, manualMode, panel.width],
  );
  useBackToClose(narrow && sheetSnap === 'full', () => setSheet('half'));
  // Dialogs on phones also close with the back button.
  useBackToClose(narrow && dialog !== null, () => setDialog(null));
  // Editing needs room: the sheet goes full height, and drops back to half when the form closes.
  const onEditingChange = useCallback((editing: boolean) => {
    if (getViewport().layout !== 'narrow') return;
    setSheet((cur) => (editing ? 'full' : cur === 'full' ? 'half' : cur));
  }, []);
  const pendingCenter = useRef<string | 'fit' | null>('fit');

  // ---- Load persisted state ------------------------------------------------------------
  useEffect(() => {
    (async () => {
      let d: TreeDoc | undefined;
      try {
        d = await store.loadDoc();
      } catch {
        /* IndexedDB unavailable (private mode): start fresh */
      }
      const initial = withDefaults(d ?? createDefaultTree({ narrow: getViewport().layout === 'narrow' }));
      setDocState(initial);
      if (!d || localStorage.getItem('sambungdulur.dirty') !== '1') savedRef.current = initial;
      // The original selects the root person on load; do the same so the editor is populated.
      if (getViewport().layout !== 'narrow') setSelectedId(initial.persons[initial.focusId] ? initial.focusId : initial.order[0] ?? null);
      if (d) setDirty(localStorage.getItem('sambungdulur.dirty') === '1');
    })();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    preloadLazyUi();
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // ---- Autosave ------------------------------------------------------------------------
  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => store.saveDoc(doc).catch(() => notify(t('toastStorageFailed'), { kind: 'error' })), 400);
    return () => clearTimeout(timer);
  }, [doc]);
  useEffect(() => localStorage.setItem('sambungdulur.dirty', dirty ? '1' : '0'), [dirty]);
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [dirty]);

  // ---- Undo / redo: every change to the tree's content is a step; view preferences are not. ----
  const docRef = useRef<TreeDoc | null>(null);
  docRef.current = doc;
  const historyRef = useRef<History<TreeDoc>>(emptyHistory());
  /** The document as last written to / read from a file, to tell whether undo returns to "saved". */
  const savedRef = useRef<TreeDoc | null>(null);
  const setDoc = useCallback((next: TreeDoc | ((d: TreeDoc) => TreeDoc), markDirty = true, coalesceKey?: string) => {
    const cur = docRef.current;
    if (!cur) return;
    const value = typeof next === 'function' ? next(cur) : next;
    if (value === cur) return;
    if (markDirty) historyRef.current = record(historyRef.current, cur, { key: coalesceKey });
    docRef.current = value;
    setDocState(value);
    if (markDirty) setDirty(true);
  }, []);

  // ---- Theme ---------------------------------------------------------------------------
  useEffect(() => {
    if (doc) document.documentElement.dataset.theme = doc.settings.theme;
  }, [doc?.settings.theme]);

  // ---- Media object URLs ---------------------------------------------------------------
  useEffect(() => {
    if (!doc) return;
    const wanted = Object.values(doc.media).filter((m) => m.available && !mediaUrls.has(m.id));
    if (!wanted.length) return;
    let cancelled = false;
    (async () => {
      const add = new Map<string, string>();
      for (const m of wanted) {
        const blob = await store.getMedia(m.id).catch(() => undefined);
        if (blob) add.set(m.id, URL.createObjectURL(blob));
      }
      if (!cancelled && add.size) setMediaUrls((prev) => new Map([...prev, ...add]));
    })();
    return () => {
      cancelled = true;
    };
  }, [doc?.media, mediaUrls]);
  const resetMediaUrls = () => {
    mediaUrls.forEach((u) => URL.revokeObjectURL(u));
    setMediaUrls(new Map());
  };
  const mediaUrl = useCallback((id: string) => mediaUrls.get(id), [mediaUrls]);

  // ---- View model ----------------------------------------------------------------------
  const focusId = doc && doc.persons[doc.focusId] ? doc.focusId : doc?.order[0] ?? '';
  const visible = useMemo(
    () => (doc ? selectVisible(doc, focusId, doc.settings.ancestorGenerations, doc.settings.descendantGenerations) : null),
    [doc?.persons, doc?.families, doc?.familyOrder, doc?.collapsed, doc?.settings.ancestorGenerations, doc?.settings.descendantGenerations, focusId],
  );
  const overrides = useMemo(() => {
    const dx = { ...draftDx };
    const dy = { ...draftDy };
    if (live && doc) {
      if (live.kind === 'move') dx[live.id] = (draftDx[live.id] ?? doc.manual.personDx[live.id] ?? 0) + live.delta;
      else dy[live.id] = (draftDy[live.id] ?? doc.manual.familyDy[live.id] ?? 0) + live.delta;
    }
    return { dx, dy };
  }, [draftDx, draftDy, live, doc?.manual]);
  const layout = useMemo(
    () => (doc && visible ? computeLayout(doc, visible, { density: 'normal', manual: true, personDx: overrides.dx, familyDy: overrides.dy }) : null),
    // Card text (date prefixes, "no name") depends on the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, visible, overrides, lang],
  );
  const highlight = useMemo(() => {
    if (!doc || !visible || !selectedId || !visible.gen.has(selectedId)) return new Set<string>();
    return lineage(doc, selectedId, new Set(visible.gen.keys()));
  }, [doc, visible, selectedId]);
  const collapsible = useMemo(() => {
    const up = new Set<string>();
    const down = new Set<string>();
    if (!doc || !visible) return { up, down };
    for (const fid of visible.families) {
      const f = doc.families[fid];
      const vp = f.partners.filter((p) => visible.gen.has(p));
      const vc = f.children.filter((c) => visible.gen.has(c));
      if (vp.length) vc.forEach((c) => up.add(c));
      if (vc.length) vp.forEach((p) => down.add(p));
    }
    return { up, down };
  }, [doc, visible]);

  useEffect(() => {
    if (!layout || !pendingCenter.current) return;
    const target = pendingCenter.current;
    pendingCenter.current = null;
    requestAnimationFrame(() => (target === 'fit' ? canvas.current?.fit() : canvas.current?.centerOn(target)));
  }, [layout]);

  if (!doc || !visible || !layout) {
    return <div className="hint" style={{ padding: 24 }}>{t('loading')}</div>;
  }

  // ---- Actions -------------------------------------------------------------------------
  const run = (fn: () => { doc: TreeDoc; select: string | null }, added = false) => {
    try {
      const r = fn();
      setDoc(r.doc);
      setSelectedId(r.select);
      if (r.select) pendingCenter.current = r.select;
      if (added && r.select) announce(t('a11yAdded', { name: displayName(r.doc.persons[r.select], r.doc.settings) }));
    } catch (e) {
      if (e instanceof RelationError) setDialog({ kind: 'message', title: t('notPossible'), text: e.message });
      else throw e;
    }
  };
  const patchSettings = (patch: Partial<TreeSettings>) => {
    setDoc((d) => ({ ...d, settings: { ...d.settings, ...patch } }), false);
    if ('ancestorGenerations' in patch || 'descendantGenerations' in patch) pendingCenter.current = 'fit';
  };
  const focusOn = (id: string) => {
    setDoc((d) => ({ ...d, focusId: id }), false);
    setSelectedId(id);
    pendingCenter.current = id;
  };

  /** Runs one person action; shared by the editor panel and the card menus. */
  const doAction = (action: PersonActionId, id: string) => {
    switch (action) {
      case 'edit':
        setSelectedId(id);
        setEditRequest({ id, n: Date.now() });
        if (narrow) setSheet('full');
        else if (viewport.layout === 'medium') setDrawerOpen(true);
        else setSidebarHidden(false);
        break;
      case 'addParents':
        run(() => addParents(doc, id), true);
        break;
      case 'addSibling':
        run(() => addSibling(doc, id), true);
        break;
      case 'addPartner':
        run(() => addPartner(doc, id), true);
        break;
      case 'addChild':
        setDialog({ kind: 'addChild', personId: id });
        break;
      case 'focus':
        focusOn(id);
        break;
      case 'delete': {
        const blocker = deleteBlocker(doc, id);
        if (blocker) setDialog({ kind: 'message', title: t('cannotDelete'), text: blocker.message });
        else setDialog({ kind: 'confirmDelete', personId: id });
        break;
      }
    }
  };

  const onCardAction = (action: string, id: string) => {
    const g = visible.gen.get(id) ?? 0;
    const drop = (dir: 'ancestors' | 'descendants') => {
      const cur = doc.collapsed[id];
      const next = { ...doc.collapsed };
      if (cur === 'both') next[id] = dir === 'ancestors' ? 'descendants' : 'ancestors';
      else if (cur === dir) delete next[id];
      return next;
    };
    if (action === 'toggle-card') {
      setDoc((d) => {
        const c = { ...d.compactCards };
        if (c[id]) delete c[id];
        else c[id] = true;
        return { ...d, compactCards: c };
      }, false);
    } else if (action === 'collapse-up' || action === 'collapse-down') {
      const dir = action === 'collapse-up' ? 'ancestors' : 'descendants';
      setDoc((d) => {
        const cur = d.collapsed[id];
        return { ...d, collapsed: { ...d.collapsed, [id]: cur && cur !== dir ? 'both' : dir } };
      }, false);
    } else if (action === 'expand-up') {
      const collapsed = drop('ancestors');
      const s = doc.settings;
      const need = -g + 1;
      const settings = s.ancestorGenerations >= 0 && s.ancestorGenerations < need ? { ...s, ancestorGenerations: need } : s;
      setDoc({ ...doc, collapsed, settings }, false);
    } else if (action === 'expand-down') {
      const collapsed = drop('descendants');
      const s = doc.settings;
      if (g < 0 || (g === 0 && id !== focusId && !doc.collapsed[id])) {
        // Children of ancestors' siblings are outside the focus line: re-root the view there.
        setDoc({ ...doc, collapsed, focusId: id }, false);
        pendingCenter.current = id;
      } else {
        const need = g + 1;
        const settings = s.descendantGenerations >= 0 && s.descendantGenerations < need ? { ...s, descendantGenerations: need } : s;
        setDoc({ ...doc, collapsed, settings }, false);
      }
    }
  };

  const collectMedia = async () => {
    const media = new Map<string, Uint8Array>();
    for (const m of Object.values(doc.media)) {
      if (!m.available) continue;
      const b = await store.getMedia(m.id);
      if (b) media.set(m.id, new Uint8Array(await b.arrayBuffer()));
    }
    return media;
  };
  const saveFile = async () => {
    try {
      const bytes = buildSambung(doc, await collectMedia());
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/zip' }), `${safeFileName(doc.title)}.sambung`);
      setDirty(false);
      savedRef.current = doc;
      notify(t('toastSaved', { file: `${safeFileName(doc.title)}.sambung`, n: doc.order.length }));
    } catch (e) {
      notify(t('toastSaveFailed', { msg: e instanceof Error ? e.message : String(e) }), { kind: 'error' });
    }
  };

  const replaceDoc = async (next: TreeDoc, media: Map<string, { bytes: Uint8Array; mime: string }>) => {
    await store.clearMedia();
    for (const [id, m] of media) await store.putMedia(id, new Blob([m.bytes as BlobPart], { type: m.mime }));
    resetMediaUrls();
    setManualMode(false);
    setDraftDx({});
    setDraftDy({});
    setMatches(new Set());
    setSelectedId(null);
    // Must be set before the new doc renders: the layout effect consumes it on the next layout.
    pendingCenter.current = 'fit';
    const fresh = withDefaults(next);
    historyRef.current = emptyHistory();
    savedRef.current = fresh;
    docRef.current = fresh;
    setDocState(fresh);
    await store.saveDoc(fresh);
  };

  const openFile = async (file: File): Promise<OpenReport> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const title = file.name.replace(/\.[^.]+$/, '');
    const lower = file.name.toLowerCase();
    if (isSambung(bytes)) {
      const { doc: d, media, manifest } = parseSambung(bytes);
      const m = new Map([...media].map(([id, b]) => [id, { bytes: b, mime: d.media[id]?.mime ?? 'image/jpeg' }]));
      await replaceDoc(d, m);
      setDirty(false);
      return {
        title: t('rOpened', { file: file.name }),
        lines: [t('rFormat', { v: manifest.version, date: manifest.savedAt }), t('rPeople', { n: d.order.length }), t('rFamilies', { n: d.familyOrder.length }), t('rPhotos', { n: media.size })],
      };
    }
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const listing = unzipSync(bytes, { filter: (f) => /\.(ftb|ged)$/i.test(f.name) });
      const ftb = Object.keys(listing).find((n) => /\.ftb$/i.test(n));
      if (ftb) {
        const { doc: d, media, report } = await importFtbZip(bytes, initSql, title);
        await replaceDoc(d, media);
        savedRef.current = null; // imported from a read-only backup: not yet saved as a file
        setDirty(true);
        return {
          title: t('rFtbTitle'),
          lines: [
            t('rFtbDb', { file: report.databaseFile, n: report.tables }),
            t('rPeople', { n: report.individuals }),
            t('rFamilies', { n: report.families }),
            t('rFtbPhotos', { a: report.photosInArchive, b: report.photosLinked }),
            t('rFtbNotes', { n: report.notes }),
            t('rFtbNot', { list: report.notImported.join('; ') }),
            '',
            t('rFtbNever'),
          ],
        };
      }
      const ged = Object.keys(listing).find((n) => /\.ged$/i.test(n));
      if (!ged) throw new Error(t('errZip'));
      const { text, note } = decodeText(listing[ged]);
      const { doc: d, stats } = importGedcom(text, title);
      const all = unzipSync(bytes, { filter: (f) => /\.(jpe?g|png|gif|webp)$/i.test(f.name) });
      const byName = new Map(Object.entries(all).map(([n, b]) => [basename(n).toLowerCase(), b]));
      const media = new Map<string, { bytes: Uint8Array; mime: string }>();
      for (const m of Object.values(d.media)) {
        const b = byName.get(m.fileName.toLowerCase());
        if (b) {
          media.set(m.id, { bytes: b, mime: m.mime });
          m.available = true;
        }
      }
      await replaceDoc(d, media);
      setDirty(false);
      return {
        title: t('rZipGed', { ged, file: file.name }),
        lines: [t('rPeople', { n: stats.individuals }), t('rFamilies', { n: stats.families }), t('rOther', { n: stats.otherRecords }), t('rPhotosZip', { a: stats.media, b: media.size }), ...(note ? [note] : [])],
      };
    }
    if (lower.endsWith('.ged') || /^﻿?0 HEAD/.test(new TextDecoder().decode(bytes.subarray(0, 16)))) {
      const { text, note } = decodeText(bytes);
      const charset = /\n1 CHAR (\S+)/.exec(text)?.[1] ?? 'unspecified';
      if (/ANSEL/i.test(charset)) throw new Error(t('errAnsel'));
      const { doc: d, stats } = importGedcom(text, title);
      await replaceDoc(d, new Map());
      setDirty(false);
      const missing = Object.keys(d.media).length;
      return {
        title: t('rImported', { file: file.name }),
        lines: [
          t('rCharset', { c: charset }),
          t('rPeople', { n: stats.individuals }),
          t('rFamilies', { n: stats.families }),
          t('rOther', { n: stats.otherRecords }),
          t('rPhotosRef', { n: stats.media }) + (missing ? t('rLinkHint') : ''),
          ...(note ? [note] : []),
        ],
      };
    }
    throw new Error(t('errUnsupported', { file: file.name }));
  };

  const linkFolder = async (files: File[]): Promise<OpenReport> => {
    const wanted = new Map<string, string[]>();
    for (const m of Object.values(doc.media)) {
      const k = m.fileName.toLowerCase();
      wanted.set(k, [...(wanted.get(k) ?? []), m.id]);
    }
    const media = { ...doc.media };
    let linked = 0;
    for (const f of files) {
      const ids = wanted.get(f.name.toLowerCase());
      if (!ids) continue;
      for (const id of ids) {
        await store.putMedia(id, f);
        media[id] = { ...media[id], available: true };
        linked++;
      }
    }
    setDoc({ ...doc, media }, false);
    const missing = Object.values(media).filter((m) => !m.available).length;
    return { title: t('rLinked'), lines: [t('rScanned', { n: files.length }), t('rLinkedN', { n: linked }), t('rMissing', { n: missing })] };
  };

  const onUploadImage = (file: File) => {
    if (!selectedId) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setDialog({ kind: 'message', title: t('fileTooLarge'), text: t('fileTooLargeMsg') });
      return;
    }
    setDialog({ kind: 'crop', file, personId: selectedId });
  };
  const applyCroppedImage = async (personId: string, blob: Blob) => {
    let n = 1;
    while (doc.media[`U${n}`]) n++;
    const id = `U${n}`;
    await store.putMedia(id, blob);
    setMediaUrls((prev) => new Map(prev).set(id, URL.createObjectURL(blob)));
    setDoc((d) => ({
      ...updatePerson(d, personId, { photoId: id }),
      media: { ...d.media, [id]: { id, fileName: `photo-${personId}-${n}.jpg`, mime: 'image/jpeg', sourcePath: '', available: true } },
    }));
    setDialog(null);
  };

  const toggleManual = () => {
    if (manualMode) {
      setManualMode(false);
      setDraftDx({});
      setDraftDy({});
      return;
    }
    if (!localStorage.getItem(MANUAL_INFO_KEY)) setDialog({ kind: 'manualInfo' });
    else setManualMode(true);
  };
  const saveManual = () => {
    setDoc((d) => ({ ...d, manual: { personDx: { ...d.manual.personDx, ...draftDx }, familyDy: { ...d.manual.familyDy, ...draftDy } } }));
    setDraftDx({});
    setDraftDy({});
    setManualMode(false);
    notify(t('toastManualSaved'));
  };

  const applyHistory = (dir: 'undo' | 'redo') => {
    if (manualMode) return false;
    const r = (dir === 'undo' ? undoStep : redoStep)(historyRef.current, doc);
    if (!r) return false;
    historyRef.current = r.history;
    docRef.current = r.value;
    setDocState(r.value);
    setDirty(r.value !== savedRef.current);
    if (selectedId && !r.value.persons[selectedId]) setSelectedId(null);
    announce(t(dir === 'undo' ? 'a11yUndone' : 'a11yRedone'));
    return true;
  };
  undoRef.current = () => applyHistory('undo');

  // ---- Keyboard commands (see ui/shortcuts.ts) ------------------------------------------
  const selectAndShow = (id: string) => {
    setSelectedId(id);
    announce(t('a11ySelected', { who: personLabel(doc, id) }));
    requestAnimationFrame(() => canvas.current?.ensureVisible(id));
  };
  const onCommand = (cmd: Command): boolean => {
    const overlay = !!dialog || !!cardMenu;
    switch (cmd) {
      case 'escape':
        // An open dialog or menu owns Escape (Base UI closes it); don't also close popovers behind it.
        if (overlay) return false;
        if (viewport.layout === 'medium' && drawerOpen && !popover) setDrawerOpen(false);
        setPopover(null);
        setMatches(new Set());
        return false;
      case 'save':
        void saveFile();
        return true;
      case 'search':
        if (overlay) return false;
        setPopover('search');
        return true;
      case 'undo':
      case 'redo':
        if (overlay) return false;
        return applyHistory(cmd);
      case 'help':
        if (overlay) return false;
        setPopover(null);
        setDialog({ kind: 'shortcuts' });
        return true;
    }
    if (overlay || popover) return false;
    switch (cmd) {
      case 'zoomIn':
        canvas.current?.zoomBy(1.15);
        return true;
      case 'zoomOut':
        canvas.current?.zoomBy(0.85);
        return true;
      case 'center':
        canvas.current?.fit();
        return true;
      case 'navUp':
      case 'navDown':
      case 'navLeft':
      case 'navRight': {
        if (!selectedId || !layout.nodes.has(selectedId)) {
          selectAndShow(layout.nodes.has(focusId) ? focusId : [...layout.nodes.keys()][0]);
          return true;
        }
        const dir = cmd === 'navUp' ? 'up' : cmd === 'navDown' ? 'down' : cmd === 'navLeft' ? 'left' : 'right';
        const next = kinNeighbour(doc, layout.nodes, selectedId, dir);
        if (next) selectAndShow(next);
        return true;
      }
      case 'edit':
        if (!selectedId || manualMode) return false;
        doAction('edit', selectedId);
        return true;
      case 'delete':
        if (!selectedId || manualMode) return false;
        doAction('delete', selectedId);
        return true;
      default:
        return false;
    }
  };

  const statusText = `${dirty ? t('unsaved') : t('saved')} · ${t('people', { n: doc.order.length })}`;
  const missingMedia = Object.values(doc.media).filter((m) => !m.available).length;
  const comps = doc.order.length > 1 && visible.hiddenCount > 0 ? components(doc).length : 1;

  return (
    <div className="app">
      <header className="header">
        <div className="brand" hidden={narrow}>
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="1" y="1" width="30" height="30" rx="8" fill="none" stroke="var(--accent)" strokeWidth="2" />
            <circle cx="16" cy="9" r="3.2" fill="none" stroke="var(--male)" strokeWidth="2" />
            <circle cx="9" cy="22" r="3.2" fill="none" stroke="var(--female)" strokeWidth="2" />
            <circle cx="23" cy="22" r="3.2" fill="none" stroke="var(--male)" strokeWidth="2" />
            <path d="M16 12.5V16M9 18.6V16H23V18.6" fill="none" stroke="var(--dim)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {!narrow && <span>SambungDulur</span>}
          <small>{t('offline')}</small>
        </div>
        <input
          className="title-input"
          aria-label={t('treeTitle')}
          value={doc.title}
          onChange={(e) => setDoc({ ...doc, title: e.target.value }, true, 'title')}
          data-testid="tree-title"
        />
        {!narrow && (
          <span
            className={`status-chip${dirty ? ' dirty' : ''}`}
            data-tip={t('savedHint')}
            aria-label={statusText}
            data-testid="status-chip"
          >
            {statusText}
          </span>
        )}
        <div className="spacer" />
        <nav className="toolbar" aria-label={t('treeTools')}>
          <button className="tool-btn keep-label" onClick={() => setDialog({ kind: 'open' })} data-testid="btn-open" {...tip(t('openTitle'))}>
            <FolderOpen size={18} /> <span className="label">{t('open')}</span>
          </button>
          <button
            className="tool-btn keep-label"
            onClick={saveFile}
            data-testid="btn-save"
            {...tip(narrow ? `${t('save')} · ${statusText}` : t('saveTitle'), 'save')}
          >
            <Save size={18} /> <span className="label">{t('save')}</span>
            {/* Phones: the save status rides on the Save button instead of a separate chip. */}
            {narrow && <span className={`save-badge${dirty ? ' dirty' : ''}`} data-testid="status-chip" aria-hidden="true" />}
          </button>
          <button className="tool-btn keep-label primary" onClick={() => setDialog({ kind: 'export' })} data-testid="btn-export" {...tip(t('export'))}>
            <Download size={18} /> <span className="label">{t('export')}</span>
          </button>
          {!narrow && <span className="tool-sep" />}
          <Suspense fallback={<button disabled className={`tool-btn keep-label${popover === 'search' ? ' active' : ''}`} data-testid="btn-search" {...tip(t('searchPeople'), 'search')}>
                <Search size={18} /> <span className="label">{t('search')}</span>
              </button>}>
          <ToolPopover
            open={popover === 'search'}
            onOpenChange={(o) => setPopover(o ? 'search' : null)}
            label={t('searchPeople')}
            testId="search-panel"
            className="search-popover"
            trigger={
              <button className={`tool-btn keep-label${popover === 'search' ? ' active' : ''}`} data-testid="btn-search" {...tip(t('searchPeople'), 'search')}>
                <Search size={18} /> <span className="label">{t('search')}</span>
              </button>
            }
          >
            <SearchPanel
              doc={doc}
              onClose={() => setPopover(null)}
              onQuery={setMatches}
              onPick={(id) => {
                setMatches(new Set([id]));
                if (visible.gen.has(id)) {
                  setSelectedId(id);
                  canvas.current?.centerOn(id, 1);
                } else focusOn(id);
                if (narrow) setSheet('half');
                else if (viewport.layout === 'medium') setDrawerOpen(true);
              }}
            />
          </ToolPopover>
          </Suspense>
          {wide && <GenerationControl settings={doc.settings} onChange={patchSettings} />}
          {wide && (
            <span className="header-lang">
              <LanguageSelect lang={lang} onChange={changeLang} />
            </span>
          )}
          <Suspense fallback={<button disabled className={`tool-btn${popover === 'settings' ? ' active' : ''}`} data-testid="btn-settings" {...tip(t('treeSettings'))}>
                <Settings2 size={18} /> <span className="label">{t('treeSettings')}</span>
              </button>}>
          <ToolPopover
            open={popover === 'settings'}
            onOpenChange={(o) => setPopover(o ? 'settings' : null)}
            label={t('treeSettings')}
            testId="settings-menu"
            trigger={
              <button className={`tool-btn${popover === 'settings' ? ' active' : ''}`} data-testid="btn-settings" {...tip(t('treeSettings'))}>
                <Settings2 size={18} /> <span className="label">{t('treeSettings')}</span>
              </button>
            }
          >
            <SettingsMenu settings={doc.settings} onChange={patchSettings} onClose={() => setPopover(null)} lang={lang} onLang={changeLang} />
          </ToolPopover>
          </Suspense>
          {wide ? (
            <>
              <button className={`tool-btn${manualMode ? ' active' : ''}`} onClick={toggleManual} data-testid="btn-manual" {...tip(t('manualLayout'))}>
                <LayoutTemplate size={18} /> <span className="label">{t('manualLayout')}</span>
              </button>
              <button className="tool-btn" onClick={() => setDialog({ kind: 'confirmReset' })} data-testid="btn-reset" {...tip(t('resetTree'))}>
                <RotateCcw size={18} /> <span className="label">{t('reset')}</span>
              </button>
              <button
                className="tool-btn"
                onClick={() => patchSettings({ theme: doc.settings.theme === 'light' ? 'dark' : 'light' })}
                data-testid="btn-theme"
                {...tip(t('toggleTheme'))}
              >
                {doc.settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <a className="tool-btn" href={GUIDE_URL} target="_blank" rel="noopener noreferrer" {...tip(t('helpTitle'))} data-testid="btn-help">
                <CircleHelp size={18} />
              </a>
              {installEvt && (
                <button className="tool-btn" onClick={() => installEvt.prompt().then(() => setInstallEvt(null))} {...tip(t('installApp'))}>
                  <MonitorDown size={18} /> <span className="label">{t('install')}</span>
                </button>
              )}
            </>
          ) : (
            <Suspense fallback={<button className="tool-btn" data-testid="btn-more" aria-label={t('moreTools')} disabled><MoreHorizontal size={18} /></button>}>
            <MoreMenu
              open={popover === 'more'}
              onOpenChange={(o) => setPopover(o ? 'more' : null)}
              theme={doc.settings.theme}
              lang={lang}
              manualMode={manualMode}
              canInstall={!!installEvt}
              onManual={toggleManual}
              onTheme={() => patchSettings({ theme: doc.settings.theme === 'light' ? 'dark' : 'light' })}
              onLang={changeLang}
              onInstall={() => installEvt?.prompt().then(() => setInstallEvt(null))}
              onReset={() => setDialog({ kind: 'confirmReset' })}
            />
            </Suspense>
          )}
        </nav>
      </header>

      <main className="main">
        <h1 className="sr-only">SambungDulur · {doc.title}</h1>
        <Sidebar
          doc={doc}
          selectedId={selectedId}
          hidden={sidebarHidden || manualMode}
          onToggleHidden={() => setSidebarHidden(!sidebarHidden)}
          width={panel.width}
          onResize={wide ? (width) => setPanel((p) => ({ ...p, width })) : undefined}
          mediaUrl={mediaUrl}
          manualMode={manualMode}
          sheet={narrow ? sheetSnap : null}
          onSheetChange={setSheet}
          onEditingChange={onEditingChange}
          onSave={(id, fields) => {
            if (Object.keys(fields).length) setDoc(updatePerson(doc, id, fields));
          }}
          onAddParents={() => selectedId && doAction('addParents', selectedId)}
          onAddSibling={() => selectedId && doAction('addSibling', selectedId)}
          onAddPartner={() => selectedId && doAction('addPartner', selectedId)}
          onAddChild={() => selectedId && doAction('addChild', selectedId)}
          onDelete={() => selectedId && doAction('delete', selectedId)}
          editRequest={editRequest}
          onUploadImage={onUploadImage}
          onDeleteImage={() => selectedId && setDialog({ kind: 'confirmDeleteImage', personId: selectedId })}
          onFocus={() => selectedId && focusOn(selectedId)}
        />
        <div className="stage">
        <TreeCanvas
          ref={canvas}
          doc={doc}
          layout={layout}
          visible={visible}
          selectedId={selectedId}
          highlight={highlight}
          matches={matches}
          mediaUrl={mediaUrl}
          manualMode={manualMode}
          onScale={setScale}
          inset={inset}
          onSelect={(id) => {
            setSelectedId(id);
            if (narrow) setSheet(id ? 'half' : 'bar');
            else if (viewport.layout === 'medium') setDrawerOpen(!!id);
          }}
          onAction={onCardAction}
          coarsePointer={viewport.pointer === 'coarse'}
          onCardMenu={(id, anchor) => setCardMenu({ id, anchor })}
          onEditRequest={(id) => doAction('edit', id)}
          onDragPerson={(id, delta, done) => {
            if (done) {
              setDraftDx((d) => ({ ...d, [id]: (d[id] ?? doc.manual.personDx[id] ?? 0) + delta }));
              setLive(null);
            } else setLive({ kind: 'move', id, delta });
          }}
          onDragBus={(id, delta, done) => {
            if (done) {
              setDraftDy((d) => ({ ...d, [id]: (d[id] ?? doc.manual.familyDy[id] ?? 0) + delta }));
              setLive(null);
            } else setLive({ kind: 'bus', id, delta });
          }}
        />

        {manualMode && (
          <div className="manual-bar" data-testid="manual-bar">
            <span>{t('manualBar')}</span>
            <button className="btn" style={{ width: 'auto', height: 32 }} onClick={() => setDialog({ kind: 'confirmResetManual' })}>{t('resetManual')}</button>
            <button className="btn ghost" style={{ width: 'auto', height: 32 }} onClick={toggleManual} data-tip={t('cancelChanges')} data-testid="manual-cancel">{t('cancel')}</button>
            <button className="btn primary" style={{ width: 'auto', height: 32 }} onClick={saveManual} disabled={!Object.keys(draftDx).length && !Object.keys(draftDy).length} data-tip={t('saveManualChanges')} data-testid="manual-save">{t('save')}</button>
          </div>
        )}

        {onboarding && !manualMode && <OnboardingHint pointer={viewport.pointer} onDismiss={dismissOnboarding} />}
        <div className="view-info" data-testid="view-info">
          {narrow && (
            <Suspense fallback={null}>
              <ToolPopover
                open={popover === 'gens'}
                onOpenChange={(o) => setPopover(o ? 'gens' : null)}
                label={t('generationsShown')}
                testId="gen-popover"
                className="gen-popover"
                trigger={
                  <button className="gen-chip" data-testid="gen-chip">
                    <span className="sr-only">{t('generationsShown')}: </span>▲{doc.settings.ancestorGenerations < 0 ? t('all') : doc.settings.ancestorGenerations} ▼
                    {doc.settings.descendantGenerations < 0 ? t('all') : doc.settings.descendantGenerations}
                  </button>
                }
              >
                <div className="field">
                  {t('generationsHelp')}
                  <GenerationControl settings={doc.settings} onChange={patchSettings} compact />
                </div>
              </ToolPopover>
            </Suspense>
          )}
          <span>
            {t('shown', { n: visible.gen.size, total: doc.order.length })}
            {comps > 1 ? ` · ${t('groups', { n: comps })}` : ''}
          </span>
          {!narrow && <span>{t('focus', { name: displayName(doc.persons[focusId], doc.settings) })}</span>}
          <span><span className="legend-dot" style={{ borderColor: 'var(--male)' }} />M</span>
          <span><span className="legend-dot" style={{ borderColor: 'var(--female)' }} />F</span>
          <span><span className="legend-dot" style={{ borderColor: 'var(--other)', borderStyle: 'dashed' }} />?</span>
          <span>{Math.round(scale * 100)}%</span>
        </div>
        <div className="zoom-controls">
          <button className="fab" onClick={() => canvas.current?.fit()} {...tip(t('centerTree'), 'center')} data-testid="btn-center">
            <Maximize size={18} />
          </button>
          <button className="fab" onClick={() => canvas.current?.zoomBy(1.15)} {...tip(t('zoomIn'), 'zoomIn')} disabled={scale >= ZOOM_MAX} data-testid="btn-zoom-in">
            <ZoomIn size={18} />
          </button>
          <button className="fab" onClick={() => canvas.current?.zoomBy(0.85)} {...tip(t('zoomOut'), 'zoomOut')} disabled={scale <= ZOOM_MIN} data-testid="btn-zoom-out">
            <ZoomOut size={18} />
          </button>
        </div>

        </div>

      </main>

      <Suspense fallback={null}>
      {cardMenu && doc.persons[cardMenu.id] && (
        <PersonMenu
          doc={doc}
          personId={cardMenu.id}
          anchor={cardMenu.anchor}
          manualMode={manualMode}
          onClose={() => setCardMenu(null)}
          onAction={(action, id) => {
            setCardMenu(null);
            doAction(action, id);
          }}
        />
      )}
      {dialog?.kind === 'addChild' && (
        <AddChildDialog
          doc={doc}
          personId={dialog.personId}
          onClose={() => setDialog(null)}
          onAdd={(mode: AddChildMode) => {
            setDialog(null);
            run(() => addChild(doc, dialog.personId, mode), true);
          }}
        />
      )}
      {dialog?.kind === 'confirmDelete' && (
        <ConfirmDialog
          title={t('deletePersonTitle')}
          message={t('deletePersonMsg', { name: displayName(doc.persons[dialog.personId], doc.settings) })}
          confirmLabel={t('delete')}
          danger
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            const name = displayName(doc.persons[dialog.personId], doc.settings);
            run(() => deletePerson(doc, dialog.personId));
            notify(t('toastDeleted', { name }), { action: { label: t('undo'), onClick: () => undoRef.current() } });
          }}
        />
      )}
      {dialog?.kind === 'confirmReset' && (
        <ConfirmDialog
          title={t('resetTitle')}
          message={t('resetMsg')}
          confirmLabel={t('reset')}
          danger
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null);
            await replaceDoc(createDefaultTree({ narrow }), new Map());
            setDirty(false);
          }}
        />
      )}
      {dialog?.kind === 'confirmDeleteImage' && (
        <ConfirmDialog
          title={t('deleteImageTitle')}
          message={t('deleteImageMsg')}
          confirmLabel={t('delete')}
          danger
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDoc(updatePerson(doc, dialog.personId, { photoId: '' }));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === 'confirmResetManual' && (
        <ConfirmDialog
          title={t('resetManualTitle')}
          message={t('resetManualMsg')}
          confirmLabel={t('reset')}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDoc({ ...doc, manual: { personDx: {}, familyDy: {} } });
            setDraftDx({});
            setDraftDy({});
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === 'manualInfo' && (
        <ManualLayoutInfo
          onCancel={() => setDialog(null)}
          onContinue={() => {
            localStorage.setItem(MANUAL_INFO_KEY, '1');
            setDialog(null);
            setManualMode(true);
          }}
        />
      )}
      {dialog?.kind === 'shortcuts' && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'message' && <MessageDialog title={dialog.title} message={dialog.text} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'crop' && (
        <CropDialog file={dialog.file} onCancel={() => setDialog(null)} onDone={(blob) => applyCroppedImage(dialog.personId, blob)} />
      )}
      {dialog?.kind === 'export' && (
        <ExportDialog
          doc={doc}
          focusId={focusId}
          getMediaBlob={(id) => store.getMedia(id)}
          onClose={() => setDialog(null)}
          onDone={(text) => notify(text)}
        />
      )}
      {dialog?.kind === 'open' && (
        <OpenDialog
          missingMedia={missingMedia}
          onClose={() => setDialog(null)}
          onOpenFile={openFile}
          onLinkFolder={linkFolder}
          onNew={() => setDialog({ kind: 'confirmReset' })}
        />
      )}
      </Suspense>
      <Suspense fallback={null}>
        <Toasts />
        {viewport.pointer === 'fine' && <TooltipLayer />}
      </Suspense>
      <KeyboardShortcuts onCommand={onCommand} />
      <div className="sr-only" role="status" aria-live="polite" data-testid="live-region">
        {announcement}
      </div>
    </div>
  );
}

function KeyboardShortcuts(props: { onCommand: (cmd: Command) => boolean }) {
  const ref = useRef(props);
  ref.current = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const cmd = commandFor(e, keyContext(e.target));
      if (cmd && ref.current.onCommand(cmd)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
