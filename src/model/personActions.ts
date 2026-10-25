import type { TreeDoc } from './types';
import { hasParents, MAX_PARTNER_FAMILIES, partnerFamilies } from './relations';
import { t } from '../i18n';

/**
 * The actions available for one person, defined once and shared by every surface that offers them:
 * the editor panel, the card context menu and the card "⋯" button.
 * Each action knows whether it is available and, when not, a short translated reason for the user.
 */
export type PersonActionId = 'edit' | 'addParents' | 'addSibling' | 'addPartner' | 'addChild' | 'focus' | 'delete';

export interface PersonActionState {
  id: PersonActionId;
  enabled: boolean;
  /** Short explanation shown next to a disabled action. */
  reason?: string;
}

export const PERSON_ACTION_ORDER: PersonActionId[] = ['edit', 'addParents', 'addSibling', 'addPartner', 'addChild', 'focus', 'delete'];

export function personActions(doc: TreeDoc, personId: string, opts: { manualMode?: boolean } = {}): Record<PersonActionId, PersonActionState> {
  const exists = !!doc.persons[personId];
  const locked = opts.manualMode ? t('reasonManualMode') : !exists ? t('errNotFound') : undefined;
  const state = (id: PersonActionId, blocker?: string): PersonActionState => {
    const reason = locked ?? blocker;
    return reason ? { id, enabled: false, reason } : { id, enabled: true };
  };
  return {
    edit: state('edit'),
    addParents: state('addParents', exists && hasParents(doc, personId) ? t('reasonHasParents') : undefined),
    addSibling: state('addSibling'),
    addPartner: state(
      'addPartner',
      exists && partnerFamilies(doc, personId).length >= MAX_PARTNER_FAMILIES ? t('reasonPartnerLimit', { n: MAX_PARTNER_FAMILIES }) : undefined,
    ),
    addChild: state('addChild'),
    // Re-rooting the view is harmless in manual mode, so it stays available there.
    focus: exists ? { id: 'focus', enabled: true } : state('focus'),
    // Delete stays clickable when the tree would split: the click explains why it is refused (original behaviour).
    delete: state('delete'),
  };
}

export function personActionLabel(id: PersonActionId): string {
  switch (id) {
    case 'edit':
      return t('editPerson');
    case 'addParents':
      return t('addParents');
    case 'addSibling':
      return t('addSibling');
    case 'addPartner':
      return t('addPartner');
    case 'addChild':
      return t('addChild');
    case 'focus':
      return t('showFrom');
    case 'delete':
      return t('deletePerson');
  }
}
