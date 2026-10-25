import { describe, expect, it } from 'vitest';
import { createDefaultTree } from '../../src/model/defaultTree';
import { addPartner, MAX_PARTNER_FAMILIES } from '../../src/model/relations';
import { PERSON_ACTION_ORDER, personActions } from '../../src/model/personActions';
import { setLang } from '../../src/i18n';

describe('person actions', () => {
  setLang('en');

  it('offers every action for a person without parents', () => {
    const a = personActions(createDefaultTree(), 'I2');
    for (const id of PERSON_ACTION_ORDER) expect(a[id], id).toEqual({ id, enabled: true });
  });

  it('explains why parents cannot be added twice', () => {
    const a = personActions(createDefaultTree(), 'I1');
    expect(a.addParents).toEqual({ id: 'addParents', enabled: false, reason: 'Parents already added' });
    expect(a.addSibling.enabled).toBe(true);
  });

  it('explains the partner limit', () => {
    let doc = createDefaultTree();
    for (let i = 0; i < MAX_PARTNER_FAMILIES; i++) doc = addPartner(doc, 'I1').doc;
    const a = personActions(doc, 'I1');
    expect(a.addPartner.enabled).toBe(false);
    expect(a.addPartner.reason).toBe(`Limit of ${MAX_PARTNER_FAMILIES} partners reached`);
  });

  it('locks editing actions during manual layout but keeps re-rooting the view', () => {
    const a = personActions(createDefaultTree(), 'I2', { manualMode: true });
    for (const id of ['edit', 'addParents', 'addSibling', 'addPartner', 'addChild', 'delete'] as const) {
      expect(a[id].enabled, id).toBe(false);
      expect(a[id].reason, id).toBe('Finish manual layout first');
    }
    expect(a.focus.enabled).toBe(true);
  });

  it('keeps delete clickable so the refusal can be explained', () => {
    expect(personActions(createDefaultTree(), 'I1').delete.enabled).toBe(true);
  });

  it('disables everything for an unknown person', () => {
    const a = personActions(createDefaultTree(), 'NOPE');
    for (const id of PERSON_ACTION_ORDER) expect(a[id].enabled, id).toBe(false);
  });
});
