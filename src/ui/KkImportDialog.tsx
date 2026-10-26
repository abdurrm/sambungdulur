import { useEffect, useRef, useState } from 'react';
import type { PersonFields, TreeDoc } from '../model/types';
import { displayName, parentsOf } from '../model/relations';
import { t, type Key } from '../i18n';
import { normalizeName, withParentReferences, type KkRow } from '../kk/parse';
import { applyKkDraft, candidates, initialChoice, KK_FIELDS, type KkDraft, type KkField } from '../kk/review';
import { readKk } from '../kk/read';
import { Modal } from './dialogs';
import { PersonPicker } from './PersonPicker';
import { downloadBlob } from '../io/imageExport';

export const KK_LABEL: Record<KkField, Key> = { givenName: 'firstName', nik: 'kkNik', gender: 'gender', birthDate: 'kkBirthDate', birthPlace: 'kkBirthPlace', profession: 'profession', religion: 'kkReligion', education: 'kkEducation', nationality: 'kkNationality' };

function fieldValue(fields: Partial<PersonFields>, key: KkField): string {
  if (key === 'gender') return fields.gender ? t(fields.gender === 'male' ? 'male' : fields.gender === 'female' ? 'female' : 'other') : '';
  return fields[key] ?? '';
}

export default function KkImportDialog(props: {
  doc: TreeDoc; selectedId: string; onClose: () => void;
  onApply: (draft: KkDraft, original: File) => Promise<void>;
  getMediaBlob: (id: string) => Promise<Blob | undefined>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [index, setIndex] = useState(0);
  const [anchorId, setAnchorId] = useState(props.selectedId);
  const [rotation, setRotation] = useState(0);
  const [draft, setDraft] = useState<KkDraft | null>(null);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [whole, setWhole] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const close = () => { if (!busy || controller.current) { controller.current?.abort(); props.onClose(); } };
  const file = files[index];
  const [originalUrl, setOriginalUrl] = useState('');
  useEffect(() => {
    if (!file) { setOriginalUrl(''); return; }
    const url = URL.createObjectURL(file); setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const reset = () => { setDraft(null); setRaw(''); setError(''); setProgress(''); };
  const read = async () => {
    if (!file || !anchorId) return;
    setBusy(true); setError(''); setDraft(null);
    controller.current = new AbortController();
    try {
      const result = await readKk(file, rotation, setProgress, controller.current.signal);
      const previous = props.doc.kkSources?.[result.id];
      const rows = withParentReferences(result.rows);
      const anchor = rows.find((r) => (props.doc.persons[anchorId].nik && r.fields.nik === props.doc.persons[anchorId].nik) || normalizeName(r.fields.givenName ?? '') === normalizeName(displayName(props.doc.persons[anchorId])));
      setDraft({ id: result.id, fileName: file.name, mime: file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'image/jpeg'), anchorId, anchorKey: anchor?.key ?? '', anchorConfirmed: false, rows,
        choices: Object.fromEntries(rows.map((r) => {
          const knownId = previous?.claims.find((c) => c.rowKey === r.key)?.personId;
          return [r.key, initialChoice(props.doc, r, r === anchor ? anchorId : knownId && props.doc.persons[knownId] ? knownId : 'skip')];
        })) });
      setRaw(result.text); setProgress('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { controller.current = null; setBusy(false); }
  };
  const changeRows = (next: KkRow[]) => {
    if (!draft) return;
    const rows = withParentReferences(next);
    setDraft({ ...draft, rows, anchorKey: rows.some((r) => r.key === draft.anchorKey) ? draft.anchorKey : '', anchorConfirmed: false, choices: Object.fromEntries(rows.map((r) => [r.key, draft.choices[r.key] ?? initialChoice(props.doc, r, 'skip')])) });
  };
  const edit = (row: KkRow, fields: Partial<KkRow>) => {
    if (!draft) return;
    changeRows(draft.rows.map((r) => r.key === row.key ? { ...r, ...fields } : r));
  };
  const counts = draft ? Object.values(draft.choices).filter((c) => c.target !== 'skip') : [];
  // The same pure operation supplies the preview validation and the final transaction.
  let validation = '';
  if (draft?.anchorConfirmed) {
    try { applyKkDraft(props.doc, draft); } catch (e) { validation = e instanceof Error ? e.message : String(e); }
  }
  const apply = async () => {
    if (!draft || !file) return;
    setBusy(true); setError('');
    try {
      await props.onApply(draft, file);
      reset();
      if (index + 1 < files.length) { setIndex(index + 1); setRotation(0); }
      else { setFiles([]); setIndex(0); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <Modal title={t('kkImport')} onClose={close} wide testId="kk-dialog">
    <p className="note">{t('kkIntro')}</p>
    <div className="kk-scroll" aria-busy={busy}>
      <label className="field">{t('kkFiles')}<input className="input" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy} data-testid="kk-file-input" onChange={(e) => { setFiles([...e.target.files ?? []]); setIndex(0); reset(); e.target.value = ''; }} /></label>
      {file && <>
        <p><strong>{index + 1}/{files.length} · {file.name}</strong> · <a href={originalUrl} target="_blank" rel="noopener noreferrer">{t('kkOriginal')}</a></p>
        <fieldset disabled={busy}>
          <PersonPicker doc={props.doc} label={t('kkAnchor')} value={anchorId} onChange={(id) => { setAnchorId(id); reset(); }} testId="kk-anchor" />
          <div className="row"><label className="field">{t('kkRotation')}<select className="input" value={rotation} onChange={(e) => { setRotation(+e.target.value); reset(); }} data-testid="kk-rotation">{[0,90,180,270].map((r) => <option key={r} value={r}>{r}°</option>)}</select></label><button className="btn" disabled={!anchorId} onClick={() => void read()} data-testid="kk-read">{t('kkRead')}</button></div>
        </fieldset>
      </>}
      {progress && <p role="status">{progress}</p>}
      {draft && <fieldset disabled={busy}>
        {props.doc.kkSources?.[draft.id] && <p className="note" role="status" data-testid="kk-resume">{t('kkResume')}</p>}
        {!draft.rows.length && <p className="note">{t('kkNoRows')}</p>}
        <label className="field">{t('kkAnchorRow')}<select className="input" value={draft.anchorKey} data-testid="kk-anchor-row" onChange={(e) => {
          const key = e.target.value;
          const row = draft.rows.find((r) => r.key === key);
          const choices = { ...draft.choices };
          if (draft.anchorKey && choices[draft.anchorKey]?.target === anchorId) choices[draft.anchorKey] = initialChoice(props.doc, draft.rows.find((r) => r.key === draft.anchorKey)!, 'skip');
          if (row) choices[key] = initialChoice(props.doc, row, anchorId);
          setDraft({ ...draft, anchorKey: key, anchorConfirmed: false, choices });
        }}><option value="">{t('choosePerson')}</option>{draft.rows.map((r) => <option key={r.key} value={r.key}>{r.fields.givenName} · {t('kkPageRow', { page: r.page, row: r.row })}{r.referenceOnly ? ` · ${t('kkReferenceOnly')}` : ''}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={draft.anchorConfirmed} disabled={!draft.anchorKey} onChange={(e) => setDraft({ ...draft, anchorConfirmed: e.target.checked })} data-testid="kk-confirm-anchor" />{t('kkConfirmAnchor')}</label>
        <label className="check"><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />{t('kkWholeProject')}</label>
        {draft.rows.map((row) => {
          const choice = draft.choices[row.key];
          const current = props.doc.persons[choice.target];
          const matches = candidates(props.doc, row, anchorId, whole);
          const ids = [...new Set([choice.target, ...matches.map((c) => c.id)].filter((id) => !!props.doc.persons[id]))];
          return <section className="kk-person" key={row.key} data-testid="kk-row">
            <h4>{row.fields.givenName || t('noName')} <small>{t('kkPageRow', { page: row.page, row: row.row })}</small></h4>
            {row.referenceOnly && <p className="note">{t('kkReferenceOnly')}</p>}
            {row.householdRole && <p className="note">{t('kkHouseholdRole')}: {row.householdRole}</p>}
            <label className="field">{t('kkMatch')}<select className="input" value={choice.target} disabled={row.key === draft.anchorKey} data-testid="kk-match" onChange={(e) => setDraft({ ...draft, choices: { ...draft.choices, [row.key]: initialChoice(props.doc, row, e.target.value) } })}>
              <option value="skip">{t('kkSkip')}</option><option value="new">{t('kkNew')}</option>
              {ids.map((id) => <option key={id} value={id}>{displayName(props.doc.persons[id])} [{id}] · {props.doc.persons[id].birthDate}{matches.find((m) => m.id === id)?.conflict ? ` · ${t('kkConflict')}` : ''}</option>)}
            </select></label>
            <div className="kk-fields">
              {KK_FIELDS.map((key) => <div className="field" key={key}>
                <label><span>{t(KK_LABEL[key])}</span>{key === 'gender' ? <select className="input" value={row.fields.gender ?? ''} aria-label={t(KK_LABEL[key])} onChange={(e) => edit(row, { fields: { ...row.fields, gender: e.target.value ? e.target.value as PersonFields['gender'] : undefined } })}><option value="">—</option>{(['male','female','other'] as const).map((g) => <option key={g} value={g}>{t(g)}</option>)}</select> : <input className="input" aria-label={t(KK_LABEL[key])} value={row.fields[key] ?? ''} onChange={(e) => edit(row, { fields: { ...row.fields, [key]: e.target.value } })} />}</label>
                {current && <small className={current[key] && row.fields[key] && current[key] !== row.fields[key] ? 'kk-conflict' : 'note'}>{t('kkKeep')}: {fieldValue(current, key) || '—'}</small>}
                <label className="check"><input type="checkbox" disabled={choice.target === 'skip' || !row.fields[key]} checked={choice.fields.includes(key)} onChange={(e) => setDraft({ ...draft, choices: { ...draft.choices, [row.key]: { ...choice, fields: e.target.checked ? [...choice.fields, key] : choice.fields.filter((f) => f !== key) } } })} />{t('kkFrom')}: {fieldValue(row.fields, key) || '—'}</label>
              </div>)}
            </div>
            {!row.referenceOnly && <>
              <div className="row"><label className="field">{t('kkFather')}<input className="input" value={row.fatherName} onChange={(e) => edit(row, { fatherName: e.target.value })} /></label><label className="field">{t('kkMother')}<input className="input" value={row.motherName} onChange={(e) => edit(row, { motherName: e.target.value })} /></label></div>
              <div className="row">{(['fatherKey','motherKey'] as const).map((role) => <label className="field" key={role}>{t(role === 'fatherKey' ? 'kkFatherIdentity' : 'kkMotherIdentity')}<select className="input" value={choice[role] ?? ''} onChange={(e) => setDraft({ ...draft, choices: { ...draft.choices, [row.key]: { ...choice, [role]: e.target.value } } })}><option value="">{t('kkByReviewedName')}</option>{draft.rows.filter((r) => r.key !== row.key && draft.choices[r.key]?.target !== 'skip').map((r) => <option key={r.key} value={r.key}>{r.fields.givenName} · {draft.choices[r.key]?.target === 'new' ? t('kkNew') : displayName(props.doc.persons[draft.choices[r.key]?.target])} [{r.key}]</option>)}</select></label>)}</div>
              {current && <p className="note">{t('kkKeep')}: {parentsOf(props.doc, current.id).map((id) => displayName(props.doc.persons[id])).join(' · ') || '—'}</p>}
              <label className="check"><input type="checkbox" disabled={choice.target === 'skip'} checked={choice.parents} onChange={(e) => setDraft({ ...draft, choices: { ...draft.choices, [row.key]: { ...choice, parents: e.target.checked } } })} />{t('kkUpdateParents')}</label>
              {/^(ISTRI|SUAMI)$/i.test(row.householdRole ?? '') && <label className="check"><input type="checkbox" disabled={choice.target === 'skip'} checked={!!choice.partner} onChange={(e) => setDraft({ ...draft, choices: { ...draft.choices, [row.key]: { ...choice, partner: e.target.checked } } })} />{t('kkLinkHeadPartner')}</label>}
            </>}
            {row.key !== draft.anchorKey && !row.referenceOnly && <button className="btn ghost" onClick={() => changeRows(draft.rows.filter((r) => r.key !== row.key))}>{t('kkRemoveRow')}</button>}
          </section>;
        })}
        <button className="btn" onClick={() => changeRows([...draft.rows, { key: `manual:${crypto.randomUUID()}`, page: 1, row: draft.rows.filter((r) => !r.referenceOnly).length + 1, fields: {}, fatherName: '', motherName: '' }])} data-testid="kk-add-row">{t('kkAddRow')}</button>
        <details><summary>{t('kkRawText')}</summary><pre className="kk-raw">{raw}</pre></details>
        <p role="status" data-testid="kk-summary">{t('kkAppliedCount', { n: counts.length, f: counts.filter((c) => c.target === 'new').length })}</p>
      </fieldset>}
      {!!Object.keys(props.doc.kkSources ?? {}).length && <details><summary>{t('kkSourceList')}</summary>{Object.values(props.doc.kkSources ?? {}).map((source) => <div key={source.id} className="kk-source"><strong>{source.fileName}</strong><p>{t('kkAnchor')}: {displayName(props.doc.persons[source.anchorId])}</p><ul>{source.claims.map((c, i) => <li key={i}>{displayName(props.doc.persons[c.personId])} · {t('kkPageRow', { page: c.page, row: c.row })} · {Object.entries(c.fields).map(([k,v]) => `${t(KK_LABEL[k as KkField])}: ${v}`).join(', ')}</li>)}</ul>{source.mediaId && props.doc.media[source.mediaId]?.available && <button className="btn" onClick={async () => { const blob = await props.getMediaBlob(source.mediaId!); if (blob) downloadBlob(blob, source.fileName); }}>{t('kkOriginal')}</button>}</div>)}</details>}
    </div>
    {(error || validation) && <p className="error-text" role="alert">{error || validation}</p>}
    <div className="actions"><button className="btn ghost" onClick={close} disabled={busy && !controller.current}>{t('close')}</button><button className="btn primary" disabled={busy || !draft?.anchorConfirmed || !!validation} onClick={() => void apply()} data-testid="kk-apply">{t('kkApply')}</button></div>
  </Modal>;
}
