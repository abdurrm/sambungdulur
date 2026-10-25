import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { TreeCanvas, ZOOM_MAX, ZOOM_MIN, type CanvasApi } from './ui/TreeCanvas';
import { Sidebar } from './ui/Sidebar';
import { AddChildDialog, ConfirmDialog, ManualLayoutInfo, MessageDialog, Toast } from './ui/dialogs';
import { CropDialog } from './ui/CropDialog';
import { GenerationControl, LanguageSelect, SettingsMenu } from './ui/SettingsMenu';
import { SearchPanel } from './ui/SearchPanel';
import { ExportDialog } from './ui/ExportDialog';
import { OpenDialog, type OpenReport } from './ui/OpenDialog';
import { GUIDE_URL } from './links';
import { initialLang, LANG_KEY, setLang as setI18nLang, t, type Lang } from './i18n';
import { getViewport, useViewport } from './ui/viewport';

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
  | { kind: 'open' };

const MANUAL_INFO_KEY = 'sambungdulur.manualInfoSeen';
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
  const [sidebarHidden, setSidebarHidden] = useState(() => getViewport().layout === 'narrow');
  const [popover, setPopover] = useState<null | 'settings' | 'search' | 'more'>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<{ text: string; kind?: 'info' | 'error' } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [matches, setMatches] = useState<Set<string>>(new Set());
  const [manualMode, setManualMode] = useState(false);
  const [draftDx, setDraftDx] = useState<Record<string, number>>({});
  const [draftDy, setDraftDy] = useState<Record<string, number>>({});
  const [live, setLive] = useState<{ kind: 'move' | 'bus'; id: string; delta: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const canvas = useRef<CanvasApi>(null);
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
      const initial = withDefaults(d ?? createDefaultTree());
      setDocState(initial);
      // The original selects the root person on load; do the same so the editor is populated.
      if (getViewport().layout !== 'narrow') setSelectedId(initial.persons[initial.focusId] ? initial.focusId : initial.order[0] ?? null);
      if (d) setDirty(localStorage.getItem('sambungdulur.dirty') === '1');
    })();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // ---- Autosave ------------------------------------------------------------------------
  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => store.saveDoc(doc).catch(() => setToast({ text: t('toastStorageFailed'), kind: 'error' })), 400);
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

  const setDoc = useCallback((next: TreeDoc | ((d: TreeDoc) => TreeDoc), markDirty = true) => {
    setDocState((cur) => (cur ? (typeof next === 'function' ? next(cur) : next) : cur));
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
  const run = (fn: () => { doc: TreeDoc; select: string | null }) => {
    try {
      const r = fn();
      setDoc(r.doc);
      setSelectedId(r.select);
      if (r.select) pendingCenter.current = r.select;
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
      setToast({ text: t('toastSaved', { file: `${safeFileName(doc.title)}.sambung`, n: doc.order.length }) });
    } catch (e) {
      setToast({ text: t('toastSaveFailed', { msg: e instanceof Error ? e.message : String(e) }), kind: 'error' });
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
    setDocState(withDefaults(next));
    await store.saveDoc(withDefaults(next));
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
    setToast({ text: t('toastManualSaved') });
  };

  const missingMedia = Object.values(doc.media).filter((m) => !m.available).length;
  const comps = doc.order.length > 1 && visible.hiddenCount > 0 ? components(doc).length : 1;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
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
          onChange={(e) => setDoc({ ...doc, title: e.target.value })}
          data-testid="tree-title"
        />
        <span
          className={`status-chip${dirty ? ' dirty' : ''}`}
          title={t('savedHint')}
          aria-label={`${dirty ? t('unsaved') : t('saved')} · ${t('people', { n: doc.order.length })}`}
          data-testid="status-chip"
        >
          {narrow ? (dirty ? '●' : '✓') : `${dirty ? t('unsaved') : t('saved')} · ${t('people', { n: doc.order.length })}`}
        </span>
        <div className="spacer" />
        <nav className="toolbar" aria-label={t('treeTools')}>
          <button className="tool-btn keep-label" onClick={() => setDialog({ kind: 'open' })} data-testid="btn-open" title={t('openTitle')}>
            <FolderOpen size={18} /> <span className="label">{t('open')}</span>
          </button>
          <button className="tool-btn keep-label" onClick={saveFile} data-testid="btn-save" title={t('saveTitle')}>
            <Save size={18} /> <span className="label">{t('save')}</span>
          </button>
          <button className="tool-btn keep-label primary" onClick={() => setDialog({ kind: 'export' })} data-testid="btn-export" title={t('export')}>
            <Download size={18} /> <span className="label">{t('export')}</span>
          </button>
          {!narrow && <span className="tool-sep" />}
          <button className={`tool-btn${popover === 'search' ? ' active' : ''}`} onClick={() => setPopover(popover === 'search' ? null : 'search')} data-testid="btn-search" title={t('searchTitle')}>
            <Search size={18} /> <span className="label">{t('search')}</span>
          </button>
          {wide && <GenerationControl settings={doc.settings} onChange={patchSettings} />}
          {wide && (
            <span className="header-lang">
              <LanguageSelect lang={lang} onChange={changeLang} />
            </span>
          )}
          <button className={`tool-btn${popover === 'settings' ? ' active' : ''}`} onClick={() => setPopover(popover === 'settings' ? null : 'settings')} data-testid="btn-settings" title={t('treeSettings')}>
            <Settings2 size={18} /> <span className="label">{t('treeSettings')}</span>
          </button>
          {wide ? (
            <>
              <button className={`tool-btn${manualMode ? ' active' : ''}`} onClick={toggleManual} data-testid="btn-manual" title={t('manualLayout')}>
                <LayoutTemplate size={18} /> <span className="label">{t('manualLayout')}</span>
              </button>
              <button className="tool-btn" onClick={() => setDialog({ kind: 'confirmReset' })} data-testid="btn-reset" title={t('resetTree')}>
                <RotateCcw size={18} /> <span className="label">{t('reset')}</span>
              </button>
              <button
                className="tool-btn"
                onClick={() => patchSettings({ theme: doc.settings.theme === 'light' ? 'dark' : 'light' })}
                data-testid="btn-theme"
                title={t('toggleTheme')}
              >
                {doc.settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <a className="tool-btn" href={GUIDE_URL} target="_blank" rel="noopener noreferrer" title={t('helpTitle')} aria-label={t('helpTitle')} data-testid="btn-help">
                <CircleHelp size={18} />
              </a>
              {installEvt && (
                <button className="tool-btn" onClick={() => installEvt.prompt().then(() => setInstallEvt(null))} title={t('installApp')}>
                  <MonitorDown size={18} /> <span className="label">{t('install')}</span>
                </button>
              )}
            </>
          ) : (
            <button className={`tool-btn${popover === 'more' ? ' active' : ''}`} onClick={() => setPopover(popover === 'more' ? null : 'more')} data-testid="btn-more" aria-label={t('moreTools')} title={t('moreTools')}>
              <MoreHorizontal size={18} />
            </button>
          )}
        </nav>
      </header>

      <div className="main">
        <Sidebar
          doc={doc}
          selectedId={selectedId}
          hidden={sidebarHidden || manualMode}
          onToggleHidden={() => setSidebarHidden(!sidebarHidden)}
          mediaUrl={mediaUrl}
          disabled={manualMode}
          onSave={(id, fields) => {
            if (Object.keys(fields).length) setDoc(updatePerson(doc, id, fields));
          }}
          onAddParents={() => selectedId && run(() => addParents(doc, selectedId))}
          onAddSibling={() => selectedId && run(() => addSibling(doc, selectedId))}
          onAddPartner={() => selectedId && run(() => addPartner(doc, selectedId))}
          onAddChild={() => selectedId && setDialog({ kind: 'addChild', personId: selectedId })}
          onDelete={() => {
            if (!selectedId) return;
            const blocker = deleteBlocker(doc, selectedId);
            if (blocker) setDialog({ kind: 'message', title: t('cannotDelete'), text: blocker.message });
            else setDialog({ kind: 'confirmDelete', personId: selectedId });
          }}
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
          onSelect={(id) => {
            setSelectedId(id);
            if (id && narrow) setSidebarHidden(false);
          }}
          onAction={onCardAction}
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
            <button className="btn ghost" style={{ width: 'auto', height: 32 }} onClick={toggleManual} title={t('cancelChanges')} data-testid="manual-cancel">{t('cancel')}</button>
            <button className="btn primary" style={{ width: 'auto', height: 32 }} onClick={saveManual} disabled={!Object.keys(draftDx).length && !Object.keys(draftDy).length} title={t('saveManualChanges')} data-testid="manual-save">{t('save')}</button>
          </div>
        )}

        <div className="view-info" data-testid="view-info">
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
          <button className="fab" onClick={() => canvas.current?.fit()} title={t('centerTree')} aria-label={t('centerTree')} data-testid="btn-center">
            <Maximize size={18} />
          </button>
          <button className="fab" onClick={() => canvas.current?.zoomBy(1.15)} title={t('zoomIn')} aria-label={t('zoomIn')} disabled={scale >= ZOOM_MAX} data-testid="btn-zoom-in">
            <ZoomIn size={18} />
          </button>
          <button className="fab" onClick={() => canvas.current?.zoomBy(0.85)} title={t('zoomOut')} aria-label={t('zoomOut')} disabled={scale <= ZOOM_MIN} data-testid="btn-zoom-out">
            <ZoomOut size={18} />
          </button>
        </div>

        </div>

        {popover === 'settings' && <SettingsMenu settings={doc.settings} onChange={patchSettings} onClose={() => setPopover(null)} lang={lang} onLang={changeLang} />}
        {popover === 'search' && (
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
              if (narrow) setSidebarHidden(false);
            }}
          />
        )}
        {popover === 'more' && !wide && (
          <div className="popover" data-testid="more-menu">
            <div className="form">
              <GenerationControl settings={doc.settings} onChange={patchSettings} />
              <LanguageSelect lang={lang} onChange={changeLang} />
              <button className="btn" onClick={() => (setPopover(null), toggleManual())}><LayoutTemplate size={16} /> {t('manualLayout')}</button>
              <button className="btn" onClick={() => patchSettings({ theme: doc.settings.theme === 'light' ? 'dark' : 'light' })}>
                {doc.settings.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />} {doc.settings.theme === 'light' ? t('darkTheme') : t('lightTheme')}
              </button>
              <a className="btn" href={GUIDE_URL} target="_blank" rel="noopener noreferrer" data-testid="more-help"><CircleHelp size={16} /> {t('help')}</a>
              {installEvt && <button className="btn" onClick={() => installEvt.prompt().then(() => setInstallEvt(null))}><MonitorDown size={16} /> {t('installApp')}</button>}
              <button className="btn danger" onClick={() => (setPopover(null), setDialog({ kind: 'confirmReset' }))}><RotateCcw size={16} /> {t('resetTree')}</button>
            </div>
          </div>
        )}
      </div>

      {dialog?.kind === 'addChild' && (
        <AddChildDialog
          doc={doc}
          personId={dialog.personId}
          onClose={() => setDialog(null)}
          onAdd={(mode: AddChildMode) => {
            setDialog(null);
            run(() => addChild(doc, dialog.personId, mode));
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
            run(() => deletePerson(doc, dialog.personId));
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
            await replaceDoc(createDefaultTree(), new Map());
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
          onDone={(text) => setToast({ text })}
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
      {toast && <Toast text={toast.text} kind={toast.kind} onDone={() => setToast(null)} />}
      <KeyboardShortcuts
        onSearch={() => setPopover('search')}
        onSave={saveFile}
        onEscape={() => {
          // An open dialog owns Escape (Base UI closes it); don't also close popovers behind it.
          if (dialog) return;
          setPopover(null);
          setMatches(new Set());
        }}
      />
    </div>
  );
}

function KeyboardShortcuts(props: { onSearch: () => void; onSave: () => void; onEscape: () => void }) {
  const ref = useRef(props);
  ref.current = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        ref.current.onSearch();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        ref.current.onSave();
      } else if (e.key === 'Escape') ref.current.onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
