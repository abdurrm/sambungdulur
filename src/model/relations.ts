import type { Family, Gender, Person, PersonFields, TreeDoc, TreeSettings } from './types';
import { emptyFields } from './types';
import { t } from '../i18n';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function parentFamilies(doc: TreeDoc, id: string): Family[] {
  return doc.familyOrder.map((f) => doc.families[f]).filter((f) => f && f.children.includes(id));
}

export function partnerFamilies(doc: TreeDoc, id: string): Family[] {
  return doc.familyOrder.map((f) => doc.families[f]).filter((f) => f && f.partners.includes(id));
}

export function parentsOf(doc: TreeDoc, id: string): string[] {
  const out: string[] = [];
  for (const f of parentFamilies(doc, id)) for (const p of f.partners) if (!out.includes(p)) out.push(p);
  return out;
}

export function partnersOf(doc: TreeDoc, id: string): string[] {
  const out: string[] = [];
  for (const f of partnerFamilies(doc, id)) for (const p of f.partners) if (p !== id && !out.includes(p)) out.push(p);
  return out;
}

export function childrenOf(doc: TreeDoc, id: string): string[] {
  const out: string[] = [];
  for (const f of partnerFamilies(doc, id)) for (const c of f.children) if (!out.includes(c)) out.push(c);
  return out;
}

export function siblingsOf(doc: TreeDoc, id: string): string[] {
  const out: string[] = [];
  for (const f of parentFamilies(doc, id)) for (const c of f.children) if (c !== id && !out.includes(c)) out.push(c);
  return out;
}

export function surnameFor(p: PersonFields, settings: Pick<TreeSettings, 'surname'>): string {
  return settings.surname === 'surnameAtBirth'
    ? p.surnameAtBirth || p.surnameNow
    : p.surnameNow || p.surnameAtBirth;
}

export function displayName(p: PersonFields | undefined, settings?: Pick<TreeSettings, 'surname'>): string {
  if (!p) return '';
  const sur = surnameFor(p, settings ?? { surname: 'surnameNow' });
  const full = [p.givenName, sur].filter(Boolean).join(' ').trim();
  return full || t('noName');
}

/** Connected components over the person/family graph. */
export function components(doc: TreeDoc): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const id of doc.order) adj.set(id, new Set());
  for (const fid of doc.familyOrder) {
    const f = doc.families[fid];
    if (!f) continue;
    const members = [...f.partners, ...f.children].filter((m) => adj.has(m));
    for (let i = 1; i < members.length; i++) {
      adj.get(members[0])!.add(members[i]);
      adj.get(members[i])!.add(members[0]);
    }
  }
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const id of doc.order) {
    if (seen.has(id)) continue;
    const comp: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const n of adj.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mutations (return a new TreeDoc; inputs are never mutated)
// ---------------------------------------------------------------------------

export const MAX_PARTNER_FAMILIES = 20;

export class RelationError extends Error {
  constructor(public code: 'last-person' | 'split' | 'has-parents' | 'partner-limit' | 'not-found' | 'invalid-relation', message: string) {
    super(message);
  }
}

function clone(doc: TreeDoc): TreeDoc {
  return {
    ...doc,
    persons: { ...doc.persons },
    families: { ...doc.families },
    order: [...doc.order],
    familyOrder: [...doc.familyOrder],
  };
}

function nextId(existing: Record<string, unknown>, prefix: string): string {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const k of Object.keys(existing)) {
    const m = re.exec(k);
    if (m) max = Math.max(max, +m[1]);
  }
  return `${prefix}${max + 1}`;
}

function insertAfter(list: string[], anchor: string, ids: string[]) {
  const i = list.indexOf(anchor);
  if (i < 0) list.push(...ids);
  else list.splice(i + 1, 0, ...ids);
}

function newPerson(doc: TreeDoc, fields: Partial<PersonFields>): Person {
  const id = nextId(doc.persons, 'I');
  const p: Person = { ...emptyFields(), ...fields, id };
  doc.persons[id] = p;
  return p;
}

function newFamily(doc: TreeDoc, partners: string[], children: string[]): Family {
  const id = nextId(doc.families, 'F');
  const f: Family = { id, partners, children };
  doc.families[id] = f;
  doc.familyOrder.push(id);
  return f;
}

function setFamily(doc: TreeDoc, f: Family) {
  doc.families[f.id] = f;
}

const opposite = (g: Gender): Gender => (g === 'male' ? 'female' : 'male');
const nameOf = (doc: TreeDoc, id: string) => displayName(doc.persons[id]);

export interface MutationResult {
  doc: TreeDoc;
  /** Person that should become selected after the change. */
  select: string | null;
}

export function hasParents(doc: TreeDoc, id: string): boolean {
  return parentFamilies(doc, id).some((f) => f.partners.length > 0);
}

export function addParents(src: TreeDoc, id: string): MutationResult {
  if (!src.persons[id]) throw new RelationError('not-found', t('errNotFound'));
  if (hasParents(src, id)) throw new RelationError('has-parents', t('errHasParents'));
  const doc = clone(src);
  const who = nameOf(doc, id);
  const father = newPerson(doc, { givenName: t('fatherOf', { name: who }), gender: 'male' });
  const mother = newPerson(doc, { givenName: t('motherOf', { name: who }), gender: 'female' });
  insertAfter(doc.order, id, [father.id, mother.id]);
  const existing = parentFamilies(doc, id)[0];
  if (existing) setFamily(doc, { ...existing, partners: [father.id, mother.id] });
  else newFamily(doc, [father.id, mother.id], [id]);
  return { doc, select: mother.id };
}

export function addSibling(src: TreeDoc, id: string): MutationResult {
  if (!src.persons[id]) throw new RelationError('not-found', t('errNotFound'));
  const doc = clone(src);
  const sib = newPerson(doc, { givenName: t('siblingOf', { name: nameOf(doc, id) }), gender: 'male' });
  const fam = parentFamilies(doc, id)[0];
  if (fam) {
    const children = [...fam.children];
    children.splice(children.indexOf(id) + 1, 0, sib.id);
    setFamily(doc, { ...fam, children });
    insertAfter(doc.order, id, [sib.id]);
  } else {
    // Siblings are only meaningful through shared parents: create them, as the original does.
    const who = nameOf(doc, id);
    const father = newPerson(doc, { givenName: t('fatherOf', { name: who }), gender: 'male' });
    const mother = newPerson(doc, { givenName: t('motherOf', { name: who }), gender: 'female' });
    insertAfter(doc.order, id, [sib.id, father.id, mother.id]);
    newFamily(doc, [father.id, mother.id], [id, sib.id]);
  }
  return { doc, select: sib.id };
}

export function addPartner(src: TreeDoc, id: string): MutationResult {
  const person = src.persons[id];
  if (!person) throw new RelationError('not-found', t('errNotFound'));
  if (partnerFamilies(src, id).length >= MAX_PARTNER_FAMILIES)
    throw new RelationError('partner-limit', t('errPartnerLimit', { n: MAX_PARTNER_FAMILIES }));
  const doc = clone(src);
  const partner = newPerson(doc, { givenName: t('partnerOf', { name: nameOf(doc, id) }), gender: opposite(person.gender) });
  insertAfter(doc.order, id, [partner.id]);
  // Reuse a single-parent family of this person when it has no partner yet.
  const single = partnerFamilies(doc, id).find((f) => f.partners.length === 1);
  if (single) setFamily(doc, { ...single, partners: [id, partner.id] });
  else newFamily(doc, [id, partner.id], []);
  return { doc, select: partner.id };
}

/** Link two existing identities, preserving their other relationships. Repeating it is a no-op. */
export function linkPartner(src: TreeDoc, id: string, partnerId: string): MutationResult {
  if (!src.persons[id] || !src.persons[partnerId]) throw new RelationError('not-found', t('errNotFound'));
  if (id === partnerId) throw new RelationError('invalid-relation', t('errSelfPartner'));
  if (partnersOf(src, id).includes(partnerId)) return { doc: src, select: partnerId };
  for (const p of [id, partnerId]) if (partnerFamilies(src, p).length >= MAX_PARTNER_FAMILIES)
    throw new RelationError('partner-limit', t('errPartnerLimit', { n: MAX_PARTNER_FAMILIES }));
  const doc = clone(src);
  // A new spouse is not automatically a parent of someone's existing children.
  newFamily(doc, [id, partnerId], []);
  return { doc, select: partnerId };
}

export function isDescendant(doc: TreeDoc, ancestor: string, candidate: string): boolean {
  const seen = new Set<string>();
  const queue = [ancestor];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (seen.has(id)) continue;
    seen.add(id);
    if (id === candidate) return true;
    queue.push(...childrenOf(doc, id));
  }
  return false;
}

/** Explicit reviewed parent assignment; it never changes another child's parent family. */
export function assignParents(src: TreeDoc, childId: string, parentIds: string[], replace = false): TreeDoc {
  const ids = [...new Set(parentIds)];
  if (!src.persons[childId] || ids.some((id) => !src.persons[id])) throw new RelationError('not-found', t('errNotFound'));
  if (ids.length > 2 || ids.some((id) => isDescendant(src, childId, id)))
    throw new RelationError('invalid-relation', t('errParentCycle'));
  const old = parentsOf(src, childId);
  if (old.length === ids.length && old.every((p) => ids.includes(p))) return src;
  if (!replace && old.some((p) => !ids.includes(p))) throw new RelationError('has-parents', t('errHasParents'));
  const doc = clone(src);
  for (const f of parentFamilies(src, childId)) setFamily(doc, { ...f, children: f.children.filter((c) => c !== childId) });
  if (ids.length) {
    const family = doc.familyOrder.map((id) => doc.families[id]).find((f) => f.partners.length === ids.length && ids.every((p) => f.partners.includes(p)));
    if (family) setFamily(doc, { ...family, children: [...family.children, childId] });
    else newFamily(doc, ids, [childId]);
  }
  return doc;
}

export type AddChildMode =
  | { kind: 'newPartner' }
  | { kind: 'single' }
  | { kind: 'withPartner'; partnerId: string };

export function addChildOptions(doc: TreeDoc, id: string): { partnerId: string; label: string }[] {
  return partnersOf(doc, id).map((p) => ({ partnerId: p, label: t('addChildWith', { name: nameOf(doc, p) }) }));
}

export function addChild(src: TreeDoc, id: string, mode: AddChildMode): MutationResult {
  const person = src.persons[id];
  if (!person) throw new RelationError('not-found', t('errNotFound'));
  const doc = clone(src);
  const who = nameOf(doc, id);
  const child = newPerson(doc, { givenName: t('childOf', { name: who }), gender: 'male' });
  if (mode.kind === 'newPartner') {
    if (partnerFamilies(src, id).length >= MAX_PARTNER_FAMILIES)
      throw new RelationError('partner-limit', t('errPartnerLimit', { n: MAX_PARTNER_FAMILIES }));
    const partner = newPerson(doc, { givenName: t('parentOfChildOf', { name: who }), gender: opposite(person.gender) });
    insertAfter(doc.order, id, [partner.id, child.id]);
    newFamily(doc, [id, partner.id], [child.id]);
  } else if (mode.kind === 'single') {
    insertAfter(doc.order, id, [child.id]);
    const fam = partnerFamilies(doc, id).find((f) => f.partners.length === 1);
    if (fam) setFamily(doc, { ...fam, children: [...fam.children, child.id] });
    else newFamily(doc, [id], [child.id]);
  } else {
    insertAfter(doc.order, id, [child.id]);
    const fam = partnerFamilies(doc, id).find((f) => f.partners.includes(mode.partnerId));
    if (fam) setFamily(doc, { ...fam, children: [...fam.children, child.id] });
    else newFamily(doc, [id, mode.partnerId], [child.id]);
  }
  return { doc, select: child.id };
}

export function updatePerson(src: TreeDoc, id: string, fields: Partial<PersonFields>): TreeDoc {
  const p = src.persons[id];
  if (!p) throw new RelationError('not-found', t('errNotFound'));
  const next: Person = { ...p, ...fields, id };
  if (!next.deceased) next.deathDate = '';
  return { ...src, persons: { ...src.persons, [id]: next } };
}

/** Explains why a person cannot be deleted, or returns null when deletion is allowed. */
export function deleteBlocker(doc: TreeDoc, id: string): RelationError | null {
  if (!doc.persons[id]) return new RelationError('not-found', t('errNotFound'));
  if (doc.order.length <= 1)
    return new RelationError('last-person', t('errLastPerson'));
  const before = components(doc).length;
  const after = components(removePersonUnchecked(doc, id)).length;
  if (after > before)
    return new RelationError(
      'split',
      t('errSplit'),
    );
  return null;
}

function removePersonUnchecked(src: TreeDoc, id: string): TreeDoc {
  const doc = clone(src);
  delete doc.persons[id];
  doc.order = doc.order.filter((x) => x !== id);
  const keep: string[] = [];
  for (const fid of doc.familyOrder) {
    const f = doc.families[fid];
    const partners = f.partners.filter((x) => x !== id);
    const children = f.children.filter((x) => x !== id);
    const changed = partners.length !== f.partners.length || children.length !== f.children.length;
    // A family that no longer links two people carries no relationship and is dropped.
    if (changed && partners.length + children.length < 2) {
      delete doc.families[fid];
      continue;
    }
    if (changed) doc.families[fid] = { ...f, partners, children };
    keep.push(fid);
  }
  doc.familyOrder = keep;
  const collapsed = { ...doc.collapsed };
  delete collapsed[id];
  doc.collapsed = collapsed;
  const manual = { ...doc.manual, personDx: { ...doc.manual.personDx } };
  delete manual.personDx[id];
  doc.manual = manual;
  return doc;
}

export function deletePerson(src: TreeDoc, id: string): MutationResult {
  const blocker = deleteBlocker(src, id);
  if (blocker) throw blocker;
  const neighbours = [...parentsOf(src, id), ...partnersOf(src, id), ...childrenOf(src, id), ...siblingsOf(src, id)];
  const doc = removePersonUnchecked(src, id);
  if (doc.focusId === id) doc.focusId = neighbours[0] ?? doc.order[0];
  return { doc, select: null };
}
