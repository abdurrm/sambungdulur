import type { KkSource, Person, PersonFields, TreeDoc } from '../model/types';
import { emptyFields } from '../model/types';
import { assignParents, childrenOf, displayName, linkPartner, parentsOf, partnersOf, siblingsOf } from '../model/relations';
import { normalizeName, type KkRow } from './parse';
import { t } from '../i18n';

export const KK_FIELDS = ['givenName', 'nik', 'gender', 'birthDate', 'birthPlace', 'profession', 'religion', 'education', 'nationality'] as const;
export type KkField = typeof KK_FIELDS[number];
export interface KkChoice { target: string; fields: KkField[]; parents: boolean; partner?: boolean; fatherKey?: string; motherKey?: string }
export interface KkDraft {
  id: string; fileName: string; mime: string; anchorId: string; anchorKey: string;
  anchorConfirmed: boolean; rows: KkRow[]; choices: Record<string, KkChoice>;
}

export function familyContext(doc: TreeDoc, id: string): Set<string> {
  return new Set([id, ...parentsOf(doc, id), ...partnersOf(doc, id), ...childrenOf(doc, id), ...siblingsOf(doc, id)]);
}
export function candidates(doc: TreeDoc, row: KkRow, anchorId: string, wholeProject = false): { id: string; score: number; conflict: boolean }[] {
  const nearby = familyContext(doc, anchorId);
  return doc.order.filter((id) => wholeProject || nearby.has(id)).map((id) => {
    const p = doc.persons[id];
    const nik = row.fields.nik;
    const conflict = !!(nik && p.nik && nik !== p.nik);
    const sameName = normalizeName(displayName(p)) === normalizeName(row.fields.givenName ?? '');
    const score = (nik && nik === p.nik ? 100 : 0) + (sameName ? 30 : 0) + (p.birthDate && p.birthDate === row.fields.birthDate ? 10 : 0);
    return { id, score, conflict };
  }).sort((a, b) => b.score - a.score);
}

export function initialChoice(doc: TreeDoc, row: KkRow, target: string): KkChoice {
  const p = doc.persons[target];
  return {
    target,
    fields: KK_FIELDS.filter((k) => row.fields[k] !== undefined && row.fields[k] !== '' && (!p || !p[k] || p[k] === row.fields[k])),
    parents: !p || parentsOf(doc, target).length === 0,
  };
}

/** Validate and construct on a private copy. No caller sees a partly applied import. */
export function applyKkDraft(src: TreeDoc, draft: KkDraft): TreeDoc {
  if (!src.persons[draft.anchorId] || !draft.anchorConfirmed || !draft.anchorKey || draft.choices[draft.anchorKey]?.target !== draft.anchorId)
    throw new Error(t('kkAnchorRequired'));
  const previous = src.kkSources?.[draft.id];
  let doc: TreeDoc = { ...src, persons: { ...src.persons }, order: [...src.order], families: { ...src.families }, familyOrder: [...src.familyOrder] };
  const ids = new Map<string, string>();
  const claims: KkSource['claims'] = [];
  for (const row of draft.rows) {
    const choice = draft.choices[row.key];
    if (!choice || choice.target === 'skip') continue;
    let id = choice.target;
    const previousClaim = previous?.claims.find((c) => c.rowKey === row.key);
    if (id === 'new' && previousClaim && doc.persons[previousClaim.personId]) id = previousClaim.personId;
    if (id === 'new') {
      let n = 1;
      while (doc.persons[`I${n}`]) n++;
      id = `I${n}`;
      doc.persons[id] = { ...emptyFields(), gender: 'other', givenName: row.fields.givenName ?? '', id };
      doc.order.push(id);
    }
    const current = doc.persons[id];
    if (!current) throw new Error(t('errNotFound'));
    const patch: Partial<PersonFields> = {};
    for (const k of choice.fields) {
      const value = row.fields[k];
      if (value !== undefined && value !== '') Object.assign(patch, { [k]: value });
    }
    if (patch.nik && !/^\d{16}$/.test(patch.nik)) throw new Error(t('kkNikInvalid'));
    const nik = patch.nik || current.nik;
    if (nik && Object.values(doc.persons).some((p) => p.id !== id && p.nik === nik)) throw new Error(t('kkNikDuplicate'));
    // Two rows assigned to one identity must not silently overwrite conflicting reviewed values.
    for (const prior of claims.filter((c) => c.personId === id)) for (const k of choice.fields) {
      if (prior.fields[k] && patch[k] && prior.fields[k] !== patch[k]) throw new Error(t('kkRowConflict'));
    }
    doc.persons[id] = { ...current, ...patch };
    ids.set(row.key, id);
    claims.push({ personId: id, page: row.page, row: row.row, rowKey: row.key, fields: { ...previousClaim?.fields, ...patch } });
  }
  const resolveParent = (name: string): string | undefined => {
    if (!normalizeName(name)) return undefined;
    const matched = new Set(draft.rows.filter((r) => normalizeName(r.fields.givenName ?? '') === normalizeName(name)).map((r) => ids.get(r.key)).filter((x): x is string => !!x));
    if (matched.size > 1) throw new Error(t('kkParentAmbiguous'));
    return [...matched][0];
  };
  for (const row of draft.rows) {
    const id = ids.get(row.key);
    if (!id || !draft.choices[row.key]?.parents || row.referenceOnly) continue;
    const choice = draft.choices[row.key];
    const fatherId = choice.fatherKey ? ids.get(choice.fatherKey) : resolveParent(row.fatherName);
    const motherId = choice.motherKey ? ids.get(choice.motherKey) : resolveParent(row.motherName);
    if (fatherId && fatherId === motherId) throw new Error(t('kkParentAmbiguous'));
    // An unresolved parent is retained rather than erased by a partial source.
    const existing = parentsOf(doc, id);
    const retained = existing.filter((p) => (doc.persons[p].gender === 'male' && !fatherId) || (doc.persons[p].gender === 'female' && !motherId));
    if (fatherId || motherId) doc = assignParents(doc, id, [...new Set([fatherId, motherId, ...retained].filter((x): x is string => !!x))], true);
    const claim = claims.find((c) => c.personId === id && c.page === row.page && c.row === row.row);
    if (claim) { claim.fatherId = fatherId; claim.motherId = motherId; }
  }
  const heads = draft.rows.filter((r) => /KEPALA\s*KELUARGA/i.test(r.householdRole ?? '') && ids.has(r.key));
  for (const row of draft.rows) {
    if (!draft.choices[row.key]?.partner || !/^(ISTRI|SUAMI)$/i.test(row.householdRole ?? '') || !ids.has(row.key)) continue;
    if (heads.length !== 1) throw new Error(t('kkParentAmbiguous'));
    doc = linkPartner(doc, ids.get(heads[0].key)!, ids.get(row.key)!).doc;
  }
  return { ...doc, kkSources: { ...src.kkSources, [draft.id]: {
    ...previous, id: draft.id, fileName: draft.fileName, anchorId: draft.anchorId, importedAt: new Date().toISOString(),
    claims: [...(previous?.claims ?? []).filter((c) => !claims.some((next) => next.rowKey === c.rowKey)), ...claims],
  } } };
}
