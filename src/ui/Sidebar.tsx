import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Trash2, UserPlus, Users, Baby, Heart, ImagePlus, ImageMinus, Crosshair } from 'lucide-react';
import type { Gender, PersonFields, TreeDoc } from '../model/types';
import { buildGedcomDate, formatDate, parseSimpleDate } from '../model/dates';
import { COUNTRIES } from '../model/countries';
import { displayName, hasParents } from '../model/relations';
import { getLang, MONTHS_BY_LANG, t } from '../i18n';

type Tab = 'personal' | 'biography' | 'image';

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
  disabled: boolean;
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
      <button type="button" className="note" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'var(--info)' }} onClick={() => setFree(true)}>
        {t('approxDate')}
      </button>
    </div>
  );
}

function EditForm(props: { doc: TreeDoc; id: string; tab: Tab; onSave: (f: Partial<PersonFields>) => void; onCancel: () => void }) {
  const p = props.doc.persons[props.id];
  const [f, setF] = useState<PersonFields>({ ...p });
  const set = <K extends keyof PersonFields>(k: K, v: PersonFields[K]) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form
      className="form"
      data-testid="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        const changed: Partial<PersonFields> = {};
        (Object.keys(f) as (keyof PersonFields)[]).forEach((k) => {
          if (f[k] !== p[k]) (changed as Record<string, unknown>)[k] = typeof f[k] === 'string' ? (f[k] as string).replace(/\s+$/, '') : f[k];
        });
        props.onSave(changed);
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

export function Sidebar(props: Props) {
  const { doc, selectedId } = props;
  const [tab, setTab] = useState<Tab>('personal');
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [selectedId]);
  const p = selectedId ? doc.persons[selectedId] : undefined;
  const fmt = (v: string) => formatDate(v, doc.settings.dateFormat) || t('unknown');
  const tabLabel = (x: Tab) => (x === 'personal' ? t('tabPersonal') : x === 'biography' ? t('tabBiography') : t('tabImage'));
  const tabs = (
    <div className="tabs" role="tablist">
      {(['personal', 'biography', 'image'] as Tab[]).map((x) => (
        <button key={x} role="tab" aria-selected={tab === x} className={`tab${tab === x ? ' active' : ''}`} onClick={() => setTab(x)} data-testid={`tab-${x}`}>
          {tabLabel(x)}
        </button>
      ))}
    </div>
  );

  let body;
  if (!p) {
    body = (
      <p className="hint" data-testid="no-selection">
        {t('sidebarHint')}
      </p>
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
          onSave={(f) => {
            props.onSave(p.id, f);
            setEditing(false);
          }}
        />
      </>
    );
  } else {
    const photoUrl = p.photoId ? props.mediaUrl(p.photoId) : undefined;
    const gallery = doc.gallery[p.id] ?? [];
    body = (
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
            <label className="btn">
              <ImagePlus size={16} /> {p.photoId ? t('replaceImage') : t('uploadImage')}
              <input
                type="file"
                accept="image/*,.heic,.heif,.webp"
                hidden
                data-testid="upload-image"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) props.onUploadImage(file);
                  e.target.value = '';
                }}
              />
            </label>
            {p.photoId && (
              <button className="btn danger" onClick={props.onDeleteImage} data-testid="delete-image">
                <ImageMinus size={16} /> {t('deleteImage')}
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
        <hr className="sep" />
        <button className="btn primary" onClick={() => setEditing(true)} disabled={props.disabled} data-testid="edit-person">
          <Pencil size={16} /> {t('editPerson')}
        </button>
        <div className="section-label">{t('addRelative')}</div>
        <div className="btn-grid">
          <button className="btn" onClick={props.onAddParents} disabled={props.disabled || hasParents(doc, p.id)} data-testid="add-parents">
            <Users size={16} /> {t('addParents')}
          </button>
          <button className="btn" onClick={props.onAddSibling} disabled={props.disabled} data-testid="add-sibling">
            <UserPlus size={16} /> {t('addSibling')}
          </button>
          <button className="btn" onClick={props.onAddPartner} disabled={props.disabled} data-testid="add-partner">
            <Heart size={16} /> {t('addPartner')}
          </button>
          <button className="btn" onClick={props.onAddChild} disabled={props.disabled} data-testid="add-child">
            <Baby size={16} /> {t('addChild')}
          </button>
        </div>
        <button className="btn ghost" onClick={props.onFocus} data-testid="focus-person">
          <Crosshair size={16} /> {t('showFrom')}
        </button>
        <hr className="sep" />
        <button className="btn danger" onClick={props.onDelete} disabled={props.disabled} data-testid="delete-person">
          <Trash2 size={16} /> {t('deletePerson')}
        </button>
      </>
    );
  }

  const toggleLabel = props.hidden ? t('expandMenu') : t('collapseMenu');
  return (
    <>
      <aside className={`sidebar${props.hidden ? ' hidden' : ''}`} data-testid="sidebar" aria-label={t('editorMenu')}>
        <button className="sidebar-grip" onClick={props.onToggleHidden} aria-label={toggleLabel}>
          {props.hidden ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {p ? displayName(p, doc.settings) : t('editor')}
        </button>
        <div className="sidebar-body">{body}</div>
      </aside>
      <button
        className="sidebar-handle hide-mobile"
        style={{ left: props.hidden ? 0 : 340 }}
        onClick={props.onToggleHidden}
        aria-label={toggleLabel}
        data-testid="sidebar-toggle"
      >
        {props.hidden ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </>
  );
}
