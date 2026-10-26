import type { TreeDoc } from './types';
import { childrenOf, displayName, partnersOf } from './relations';
import { DEFAULT_BACKGROUND } from './background';
import { t } from '../i18n';

/** Closed projection: serializers must never receive records belonging to another branch. */
export function exportBranch(src: TreeDoc, rootId: string, opts: { partners?: boolean; privateData?: boolean } = {}): TreeDoc {
  if (!src.persons[rootId]) throw new Error(t('errNotFound'));
  const descendants = new Set<string>();
  const queue = [rootId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (descendants.has(id)) continue;
    descendants.add(id);
    queue.push(...childrenOf(src, id));
  }
  const included = new Set(descendants);
  if (opts.partners) for (const id of descendants) for (const p of partnersOf(src, id)) included.add(p);
  const persons = Object.fromEntries(src.order.filter((id) => included.has(id)).map((id) => {
    const { nik, ...person } = src.persons[id];
    return [id, opts.privateData ? { ...person, ...(nik ? { nik } : {}) } : person];
  }));
  const families: TreeDoc['families'] = {};
  for (const fid of src.familyOrder) {
    const f = src.families[fid];
    // Child edges must originate in the selected descendant line, never a spouse's other family.
    const partners = f.partners.filter((id) => included.has(id));
    const children = f.partners.some((id) => descendants.has(id)) ? f.children.filter((id) => descendants.has(id)) : [];
    if (partners.length && partners.length + children.length >= 2) families[fid] = { ...f, partners, children };
  }
  const mediaIds = new Set<string>();
  const gallery: TreeDoc['gallery'] = {};
  for (const p of Object.values(persons)) {
    if (p.photoId) mediaIds.add(p.photoId);
    gallery[p.id] = (src.gallery[p.id] ?? []).filter((id) => !src.media[id]?.document);
    gallery[p.id].forEach((id) => mediaIds.add(id));
  }
  const bg = src.settings.background;
  if (bg.kind === 'image') mediaIds.add(bg.mediaId);
  const kkSources: NonNullable<TreeDoc['kkSources']> = {};
  if (opts.privateData) for (const [id, source] of Object.entries(src.kkSources ?? {})) {
    if (!included.has(source.anchorId)) continue;
    const claims = source.claims.filter((c) => included.has(c.personId)).map((c) => ({
      ...c, fatherId: c.fatherId && included.has(c.fatherId) ? c.fatherId : undefined,
      motherId: c.motherId && included.has(c.motherId) ? c.motherId : undefined,
    }));
    kkSources[id] = { ...source, claims };
    if (source.mediaId) mediaIds.add(source.mediaId);
  }
  const media = Object.fromEntries(Object.entries(src.media).filter(([id, m]) => mediaIds.has(id) && (opts.privateData || !m.document)));
  return {
    ...src, title: `Bani ${displayName(src.persons[rootId], src.settings)}`, persons,
    order: src.order.filter((id) => included.has(id)), families, familyOrder: src.familyOrder.filter((id) => !!families[id]),
    focusId: rootId, media, gallery, kkSources,
    // Raw GEDCOM may contain names, sources and vendor records outside the selected branch.
    gedcomSource: undefined, origin: 'new', collapsed: {}, compactCards: {}, manual: { personDx: {}, familyDy: {} },
    settings: { ...src.settings, ancestorGenerations: 0, descendantGenerations: -1, background: bg.kind === 'image' && !media[bg.mediaId] ? DEFAULT_BACKGROUND : bg },
  };
}
