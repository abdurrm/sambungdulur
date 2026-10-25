import type { TreeDoc } from './types';
import { childrenOf, displayName, parentsOf, partnersOf, siblingsOf } from './relations';
import { yearOf } from './dates';
import { t } from '../i18n';

/** Spoken description of a person card: name, years, and how they relate to the focus person. */
export function personLabel(doc: TreeDoc, id: string): string {
  const p = doc.persons[id];
  if (!p) return '';
  const parts = [displayName(p, doc.settings)];
  const by = yearOf(p.birthDate);
  const dy = p.deceased ? yearOf(p.deathDate) : undefined;
  if (by) parts.push(t('a11yBorn', { y: by }));
  if (dy) parts.push(t('a11yDied', { y: dy }));
  const focus = doc.focusId;
  if (id === focus) parts.push(t('relFocus'));
  else if (doc.persons[focus]) {
    const name = displayName(doc.persons[focus], doc.settings);
    if (parentsOf(doc, focus).includes(id)) parts.push(t('relParent', { name }));
    else if (childrenOf(doc, focus).includes(id)) parts.push(t('relChild', { name }));
    else if (partnersOf(doc, focus).includes(id)) parts.push(t('relPartner', { name }));
    else if (siblingsOf(doc, focus).includes(id)) parts.push(t('relSibling', { name }));
  }
  return parts.join(', ');
}
