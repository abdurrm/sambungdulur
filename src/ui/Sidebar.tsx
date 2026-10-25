import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { SheetSnap } from './sheetSnap';
import { Icon } from './icons';
import type { Gender, PersonFields, TreeDoc } from '../model/types';
import { buildGedcomDate, formatDate, parseSimpleDate } from '../model/dates';
import { COUNTRIES } from '../model/countries';
import { displayName } from '../model/relations';
import { personActions, type PersonActionState } from '../model/personActions';
import { Tabs } from '@base-ui/react/tabs';
import { getLang, MONTHS_BY_LANG, t } from '../i18n';

type Tab = 'personal' | 'biography' | 'image';

// The phone sheet (Base UI Drawer) is only needed on narrow screens: load it on demand.
const SheetFrame = lazy(() => import('./SheetFrame'));

interface Props {
  doc: TreeDoc;
  selectedId: string | null;
  hidden: boolean;
  onToggleHidden: () => void;
  mediaUrl: (id: string) => string | undefined;
  onSave: (id: string, fields: Partial<PersonFields>) => void;
  onAddParents: () => void;
  onAddSibling: () => void;
  onAddPartner: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onUploadImage: (file: File) => void;
  onDeleteImage: () => void;
  onFocus: () => void;
  manualMode: boolean;
  /** The editor element, measured by the App to know how much of the canvas it covers. */
  asideRef?: Ref<HTMLElement>;
  /** Set on phones: the editor becomes a draggable bottom sheet at this snap point. */
  sheet?: SheetSnap | null;
  onSheetChange?: (snap: SheetSnap) => void;
  onEditingChange?: (editing: boolean) => void;
  /** Desktop panel width (px). When `onResize` is set the right edge can be dragged or moved with arrow keys. */
  width?: number;
  onResize?: (width: number) => void;
  /** Asks the panel to open the edit form for this person (card menu, double-click, Enter / E).
   *  `focus` moves keyboard focus to the first field. */
  editRequest?: EditRequest | null;
  /** `popup`: only the editor content, framed by the desktop pop-up (which brings its own chrome).
   *  `pinned`: a fixed, resizable panel on the right of the desktop canvas. */
  frame?: 'popup' | 'pinned';
  /** Pinned panel: back to the pop-up. */
  onUnpin?: () => void;
  /** Touch screen: the Image tab offers the camera next to the gallery. */
  coarse?: boolean;
  /** Alt+1/2/3: switch to this tab. */
  tabRequest?: { tab: 'personal' | 'biography' | 'image'; n: number } | null;
  /** The open edit form, for the unsaved-changes prompt (and saving from the keyboard). */
  formControl?: React.MutableRefObject<FormControl | null>;
}

export interface EditRequest {
  id: string;
  n: number;
  focus?: boolean;
}

export const PANEL_MIN = 280;
export const PANEL_MAX = 560;
export const PANEL_DEFAULT = 340;
const clampW = (w: number) => Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, w)));

/** Drag or arrow-key separator. `side`: where the panel sits; a right-hand panel grows when its left edge moves left. */
function PanelResizer(props: { width: number; onResize: (w: number) => void; side?: 'left' | 'right' }) {
  const dir = props.side === 'right' ? -1 : 1;
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('resizePanel')}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={props.width}
      tabIndex={0}
      data-dragging={dragging || undefined}
      data-testid="panel-resizer"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, w: props.width };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        setDragging(true);
        e.preventDefault();
      }}
      onPointerMove={(e) => drag.current && props.onResize(clampW(drag.current.w + dir * (e.clientX - drag.current.x)))}
      onPointerUp={() => ((drag.current = null), setDragging(false))}
      onPointerCancel={() => ((drag.current = null), setDragging(false))}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 16;
        if (e.key === 'ArrowLeft') props.onResize(clampW(props.width - dir * step));
        else if (e.key === 'ArrowRight') props.onResize(clampW(props.width + dir * step));
        else if (e.key === 'Home') props.onResize(PANEL_MIN);
        else if (e.key === 'End') props.onResize(PANEL_MAX);
        else return;
        e.preventDefault();
      }}
    />
  );
}

const genderLabel = (g: Gender) => (g === 'female' ? t('female') : g === 'male' ? t('male') : t('other'));

function Avatar({ doc, id, url }: { doc: TreeDoc; id: string; url?: string }) {
  const p = doc.persons[id];
  const name = displayName(p, doc.settings);
  const ini = name.split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return <div className={`avatar ${p.gender}`}>{url ? <img src={url} alt="" /> : <span>{ini}</span>}</div>;
}

type DateParts = { day?: number; month?: number; year?: number };

function DateInput(props: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  const parsed = parseSimpleDate(props.value);
  const [free, setFree] = useState(parsed === null);
  // Keep partial picks (e.g. day + month before the year) locally; GEDCOM needs a year to express them.
  const [d, setD] = useState<DateParts>(() => parsed ?? {});
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: y - 1000 + 1 }, (_, i) => y - i);
  }, []);
  if (free) {
    return (
      <label className="field">
        {props.label} <span className="note">{t('gedDateHint')}</span>
        <input type="text" value={props.value} onChange={(e) => props.onChange(e.target.value.toUpperCase())} data-testid={`${props.testId}-text`} />
        <button type="button" className="btn ghost" style={{ height: 30 }} onClick={() => (setFree(false), setD({}), props.onChange(''))}>
          {t('useDMY')}
        </button>
      </label>
    );
  }
  const set = (patch: DateParts) => {
    const next = { ...d, ...patch };
    setD(next);
    props.onChange(buildGedcomDate(next));
  };
  return (
    <div className="field">
      <span>{props.label}</span>
      <div className="row">
        <select aria-label={`${props.label} - ${t('day')}`} value={d.day ?? ''} onChange={(e) => set({ day: e.target.value ? +e.target.value : undefined })} data-testid={`${props.testId}-day`}>
          <option value="">{t('day')}</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <select aria-label={`${props.label} - ${t('month')}`} value={d.month ?? ''} onChange={(e) => set({ month: e.target.value ? +e.target.value : undefined })} data-testid={`${props.testId}-month`}>
          <option value="">{t('month')}</option>
          {MONTHS_BY_LANG[getLang()].map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select aria-label={`${props.label} - ${t('year')}`} value={d.year ?? ''} onChange={(e) => set({ year: e.target.value ? +e.target.value : undefined })} data-testid={`${props.testId}-year`}>
          <option value="">{t('year')}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <button type="button" className="note link-btn" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'var(--info)' }} onClick={() => setFree(true)}>
        {t('approxDate')}
      </button>
    </div>
  );
}

/** Lets the App save or discard the open form (unsaved-changes prompt, Ctrl+Enter). */
export interface FormControl {
  /** Read at the moment of leaving (not via state), so a key pressed right after typing is still caught. */
  isDirty: () => boolean;
  save: () => void;
  discard: () => void;
}

function EditForm(props: {
  doc: TreeDoc;
  id: string;
  tab: Tab;
  onSave: (f: Partial<PersonFields>) => void;
  onCancel: () => void;
  control?: React.MutableRefObject<FormControl | null>;
}) {
  const p = props.doc.persons[props.id];
  const [f, setF] = useState<PersonFields>({ ...p });
  const set = <K extends keyof PersonFields>(k: K, v: PersonFields[K]) => setF((s) => ({ ...s, [k]: v }));
  const keys = Object.keys(f) as (keyof PersonFields)[];
  const dirty = keys.some((k) => f[k] !== p[k]);
  const save = () => {
    const changed: Partial<PersonFields> = {};
    keys.forEach((k) => {
      if (f[k] !== p[k]) (changed as Record<string, unknown>)[k] = typeof f[k] === 'string' ? (f[k] as string).replace(/\s+$/, '') : f[k];
    });
    props.onSave(changed);
  };
  if (props.control) props.control.current = { isDirty: () => dirty, save, discard: props.onCancel };
  useEffect(() => {
    const control = props.control;
    return () => {
      if (control) control.current = null;
    };
  }, [props.control]);
  return (
    <form
      className="form"
      data-testid="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="form" hidden={props.tab !== 'personal'}>
        <label className="field">
          {t('firstName')}
          <input type="text" value={f.givenName} onChange={(e) => set('givenName', e.target.value)} data-testid="f-given" />
        </label>
        <div className="row">
          <label className="field">
            {t('surnameNow')}
            <input type="text" value={f.surnameNow} onChange={(e) => set('surnameNow', e.target.value)} data-testid="f-surname-now" />
          </label>
          <label className="field">
            {t('surnameAtBirth')}
            <input type="text" value={f.surnameAtBirth} onChange={(e) => set('surnameAtBirth', e.target.value)} data-testid="f-surname-birth" />
          </label>
        </div>
        <div className="field">
          {t('gender')}
          <div className="radio-row" role="radiogroup">
            {(['female', 'male', 'other'] as Gender[]).map((g) => (
              <label key={g}>
                <input type="radio" name="gender" checked={f.gender === g} onChange={() => set('gender', g)} data-testid={`f-gender-${g}`} />
                {genderLabel(g)}
              </label>
            ))}
          </div>
        </div>
        <DateInput label={t('dob')} value={f.birthDate} onChange={(v) => set('birthDate', v)} testId="f-dob" />
        <label className="switch">
          {t('deceased')}
          <input type="checkbox" checked={f.deceased} onChange={(e) => set('deceased', e.target.checked)} data-testid="f-deceased" />
        </label>
        {f.deceased && <DateInput label={t('dod')} value={f.deathDate} onChange={(v) => set('deathDate', v)} testId="f-dod" />}
      </div>
      <div className="form" hidden={props.tab !== 'biography'}>
        <label className="field">
          {t('countryPlace')}
          <input type="text" list="country-list" value={f.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} data-testid="f-place" />
          <datalist id="country-list">
            {COUNTRIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          {t('profession')}
          <input type="text" value={f.profession} onChange={(e) => set('profession', e.target.value)} data-testid="f-profession" />
        </label>
        <label className="field">
          {t('factsBio')}
          <textarea value={f.facts} onChange={(e) => set('facts', e.target.value)} data-testid="f-facts" />
        </label>
      </div>
      {props.tab === 'image' && <p className="note">{t('imageTabNote')}</p>}
      <div className="row">
        <button type="button" className="btn ghost" onClick={props.onCancel}>{t('cancel')}</button>
        <button type="submit" className="btn primary" data-testid="f-save">{t('save')}</button>
      </div>
    </form>
  );
}

/** A person action button; when unavailable it stays readable and shows why underneath its label. */
function ActionButton(props: { state: PersonActionState; onClick: () => void; testId: string; icon: ReactNode; label: string; className?: string }) {
  const { enabled, reason } = props.state;
  const reasonId = `${props.testId}-reason`;
  return (
    <button
      className={`${props.className ?? 'btn'}${reason ? ' has-reason' : ''}`}
      onClick={props.onClick}
      disabled={!enabled}
      aria-describedby={reason ? reasonId : undefined}
      title={reason}
      data-testid={props.testId}
    >
      <span className="btn-main">{props.icon} {props.label}</span>
      {reason && <small className="btn-reason" id={reasonId} data-testid={reasonId}>{reason}</small>}
    </button>
  );
}

export function Sidebar(props: Props) {
  const { doc, selectedId } = props;
  const [tab, setTab] = useState<Tab>('personal');
  const tabRequest = props.tabRequest;
  // Alt+1/2/3 inside the form: focus moves to the first field of the new tab. Otherwise the focused field
  // is hidden with its tab, focus is lost and the pop-up pulls it back to itself (Ctrl+Enter then misses).
  const focusTabField = useRef(false);
  useEffect(() => {
    if (!tabRequest) return;
    focusTabField.current = !!bodyRef.current?.querySelector('[data-testid="edit-form"]')?.contains(document.activeElement);
    setTab(tabRequest.tab);
  }, [tabRequest]);
  useLayoutEffect(() => {
    if (!focusTabField.current) return;
    focusTabField.current = false;
    const form = bodyRef.current?.querySelector('[data-testid="edit-form"]');
    const field = form?.querySelector<HTMLElement>(':scope > .form:not([hidden]) :is(input, select, textarea)') ?? form?.querySelector<HTMLElement>('[data-testid="f-save"]');
    field?.focus();
  }, [tab]);
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [selectedId]);
  const editRequest = props.editRequest;
  const consumed = useRef(0);
  useEffect(() => {
    // Each request opens the form once; coming back to that person later must not reopen it.
    if (editRequest && editRequest.id === selectedId && consumed.current !== editRequest.n) {
      consumed.current = editRequest.n;
      setEditing(true);
      if (editRequest.focus) focusFirst.current = true;
    }
  }, [editRequest, selectedId]);
  // Desktop pop-up / pinned panel: when the form closes with focus inside it (Save, Cancel), focus moves to
  // "Edit" right away. Otherwise the focused button vanishes and the pop-up later pulls focus back to
  // itself, away from wherever the user went next (the canvas).
  const wasEditing = useRef(false);
  useLayoutEffect(() => {
    const closed = wasEditing.current && !editing;
    wasEditing.current = editing;
    if (!closed || !props.frame) return;
    const active = document.activeElement;
    if (!active || active === document.body || bodyRef.current?.contains(active)) {
      bodyRef.current?.querySelector<HTMLElement>('[data-testid="edit-person"]')?.focus();
    }
  }, [editing, props.frame]);
  const focusFirst = useRef(false);
  useEffect(() => {
    if (!editing || !focusFirst.current) return;
    focusFirst.current = false;
    requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>('[data-testid="edit-form"] input, [data-testid="edit-form"] select')?.focus());
  }, [editing]);
  const onEditingChange = props.onEditingChange;
  useEffect(() => onEditingChange?.(editing), [editing, onEditingChange]);
  const sheet = props.sheet ?? null;
  // A newly picked person is shown from the top of the panel, not wherever the last one was scrolled to.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [selectedId]);
  const p = selectedId ? doc.persons[selectedId] : undefined;
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) props.onUploadImage(file);
  };
  const fmt = (v: string) => formatDate(v, doc.settings.dateFormat) || t('unknown');
  const tabLabel = (x: Tab) => (x === 'personal' ? t('tabPersonal') : x === 'biography' ? t('tabBiography') : t('tabImage'));
  const tabs = (
    <Tabs.Root value={tab} onValueChange={(v) => setTab(v as Tab)}>
      <Tabs.List className="tabs" aria-label={t('editorMenu')}>
        {(['personal', 'biography', 'image'] as Tab[]).map((x) => (
          <Tabs.Tab key={x} value={x} className="tab" data-testid={`tab-${x}`}>
            {tabLabel(x)}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
  let body;
  if (!p) {
    body = (
      <div className="empty-state">
        <Icon id="tree" size={44} weight="duotone" className="empty-icon" />
        <p className="hint" data-testid="no-selection">
          {t('sidebarHint')}
        </p>
      </div>
    );
  } else if (editing) {
    body = (
      <>
        {tabs}
        <EditForm
          key={p.id}
          doc={doc}
          id={p.id}
          tab={tab}
          onCancel={() => setEditing(false)}
          control={props.formControl}
          onSave={(f) => {
            props.onSave(p.id, f);
            setEditing(false);
          }}
        />
      </>
    );
  } else {
    const acts = personActions(doc, p.id, { manualMode: props.manualMode });
    const photoUrl = p.photoId ? props.mediaUrl(p.photoId) : undefined;
    const gallery = doc.gallery[p.id] ?? [];
    const head = (
      <>
        <div className="person-head">
          <Avatar doc={doc} id={p.id} url={photoUrl} />
          <div>
            <h2 data-testid="selected-name">{displayName(p, doc.settings)}</h2>
            <div className="sub">
              {p.id} · {genderLabel(p.gender)}
              {p.deceased ? ' · †' : ''}
            </div>
          </div>
        </div>
      </>
    );
    const info = (
      <>
        {tabs}
        {tab === 'personal' && (
          <table className="details" data-testid="personal-table">
            <tbody>
              <tr><th>{t('personsName')}</th><td>{p.givenName || '—'}</td></tr>
              <tr><th>{t('surnameNow')}</th><td>{p.surnameNow || '—'}</td></tr>
              <tr><th>{t('surnameAtBirth')}</th><td>{p.surnameAtBirth || '—'}</td></tr>
              <tr><th>{t('gender')}</th><td>{genderLabel(p.gender)}</td></tr>
              <tr><th>{t('dob')}</th><td className="mono">{fmt(p.birthDate)}</td></tr>
              {p.deceased && <tr><th>{t('dod')}</th><td className="mono">{fmt(p.deathDate)}</td></tr>}
            </tbody>
          </table>
        )}
        {tab === 'biography' && (
          <table className="details" data-testid="biography-table">
            <tbody>
              <tr><th>{t('placeOfBirth')}</th><td>{p.birthPlace || '—'}</td></tr>
              <tr><th>{t('profession')}</th><td>{p.profession || '—'}</td></tr>
              <tr><th>{t('facts')}</th><td>{p.facts || '—'}</td></tr>
            </tbody>
          </table>
        )}
        {tab === 'image' && (
          <div className="form" data-testid="image-tab">
            {photoUrl ? (
              <img src={photoUrl} alt={t('photoOf', { name: displayName(p) })} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--panel-border)' }} />
            ) : p.photoId ? (
              <p className="note">{t('photoMissing', { file: doc.media[p.photoId]?.fileName ?? '' })}</p>
            ) : (
              <p className="note">{t('noImage')}</p>
            )}
            {props.coarse ? (
              // Touch screens: the device camera (back camera first; the camera app can switch) or the gallery.
              <div className="btn-grid">
                <label className="btn">
                  <Icon id="photo" size={16} /> {t('takePhoto')}
                  <input type="file" accept="image/*" capture="environment" hidden data-testid="camera-image" onChange={pickFile} />
                </label>
                <label className="btn">
                  <Icon id="uploadImage" size={16} /> {t('pickFromGallery')}
                  <input type="file" accept="image/*,.heic,.heif,.webp" hidden data-testid="upload-image" onChange={pickFile} />
                </label>
              </div>
            ) : (
              <label className="btn">
                <Icon id="uploadImage" size={16} /> {p.photoId ? t('replaceImage') : t('uploadImage')}
                <input type="file" accept="image/*,.heic,.heif,.webp" hidden data-testid="upload-image" onChange={pickFile} />
              </label>
            )}
            {p.photoId && (
              <button className="btn danger" onClick={props.onDeleteImage} data-testid="delete-image">
                <Icon id="deleteImage" size={16} /> {t('deleteImage')}
              </button>
            )}
            {gallery.length > 0 && (
              <>
                <div className="section-label">{t('otherPhotos')}</div>
                <div className="gallery">
                  {gallery.map((m) => {
                    const u = props.mediaUrl(m);
                    return u ? <img key={m} src={u} alt="" /> : <div key={m} className="missing">{doc.media[m]?.fileName}</div>;
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </>
    );
    const actions = (
      <>
        <ActionButton state={acts.edit} className="btn primary" onClick={() => setEditing(true)} testId="edit-person" icon={<Icon id="edit" size={16} weight="fill" />} label={t('editPerson')} />
        <div className="section-label">{t('addRelative')}</div>
        <div className="btn-grid">
          <ActionButton state={acts.addParents} onClick={props.onAddParents} testId="add-parents" icon={<Icon id="addParents" size={16} />} label={t('addParents')} />
          <ActionButton state={acts.addSibling} onClick={props.onAddSibling} testId="add-sibling" icon={<Icon id="addSibling" size={16} />} label={t('addSibling')} />
          <ActionButton state={acts.addPartner} onClick={props.onAddPartner} testId="add-partner" icon={<Icon id="addPartner" size={16} />} label={t('addPartner')} />
          <ActionButton state={acts.addChild} onClick={props.onAddChild} testId="add-child" icon={<Icon id="addChild" size={16} />} label={t('addChild')} />
        </div>
      </>
    );
    const rest = (
      <>
        <ActionButton state={acts.focus} className="btn ghost" onClick={props.onFocus} testId="focus-person" icon={<Icon id="focus" size={16} />} label={t('showFrom')} />
        <hr className="sep" />
        <ActionButton state={acts.delete} className="btn danger" onClick={props.onDelete} testId="delete-person" icon={<Icon id="delete" size={16} />} label={t('deletePerson')} />
      </>
    );
    // In the phone sheet the add-relative actions come right after the name so the half-height sheet shows them.
    body = sheet ? (
      <>
        {head}
        {actions}
        <hr className="sep" />
        {info}
        {rest}
      </>
    ) : (
      <>
        {head}
        {info}
        <hr className="sep" />
        {actions}
        {rest}
      </>
    );
  }

  if (props.frame === 'pinned') {
    return (
      <aside className="sidebar pinned" style={{ '--panel-w': `${props.width ?? PANEL_DEFAULT}px` } as CSSProperties} data-testid="editor-panel" data-key-scope="tree" aria-label={p ? t('editorFor', { name: displayName(p, doc.settings) }) : t('editorMenu')}>
        {props.onResize && <PanelResizer width={props.width ?? PANEL_DEFAULT} onResize={props.onResize} side="right" />}
        <div className="panel-tools">
          <button className="editor-close" onClick={props.onUnpin} aria-label={t('unpinEditor')} aria-pressed="true" data-tip={t('unpinEditor')} data-testid="editor-unpin">
            <Icon id="pin" size={18} active />
          </button>
        </div>
        <div className="sidebar-body editor-popup-body" ref={bodyRef}>
          {body}
        </div>
      </aside>
    );
  }
  if (props.frame === 'popup') {
    return (
      <div className="editor-popup-body" ref={bodyRef} data-testid="editor-body">
        {body}
      </div>
    );
  }
  const toggleLabel = props.hidden ? t('expandMenu') : t('collapseMenu');
  if (sheet) {
    return (
      <Suspense fallback={<div className="sheet-fallback" data-testid="sidebar" data-snap="bar" />}>
        <SheetFrame
          snap={sheet}
          onSnapChange={(v) => props.onSheetChange?.(v)}
          label={t('editorMenu')}
          gripLabel={toggleLabel}
          title={p ? displayName(p, doc.settings) : t('editor')}
          resetKey={selectedId}
        >
          {body}
        </SheetFrame>
      </Suspense>
    );
  }
  return (
    <>
      <aside
        ref={props.asideRef}
        className={`sidebar${props.hidden ? ' hidden' : ''}`}
        style={{ '--panel-w': `${props.width ?? PANEL_DEFAULT}px` } as CSSProperties}
        data-testid="sidebar"
        data-key-scope="tree"
        aria-label={t('editorMenu')}
      >
        {props.onResize && !props.hidden && <PanelResizer width={props.width ?? PANEL_DEFAULT} onResize={props.onResize} />}
        <button className="sidebar-grip" onClick={props.onToggleHidden} aria-expanded={!props.hidden}>
          <Icon id={props.hidden ? 'caretUp' : 'caretDown'} size={16} />
          {p ? displayName(p, doc.settings) : t('editor')}
          <span className="sr-only">, {toggleLabel}</span>
        </button>
        <div className="sidebar-body" ref={bodyRef}>
          {body}
        </div>
      </aside>
      <button
        className="sidebar-handle hide-mobile"
        style={{ left: props.hidden ? 0 : (props.width ?? PANEL_DEFAULT) }}
        onClick={props.onToggleHidden}
        aria-label={toggleLabel}
        data-tip={toggleLabel}
        data-testid="sidebar-toggle"
      >
        <Icon id={props.hidden ? 'caretRight' : 'caretLeft'} size={16} />
      </button>
    </>
  );
}
