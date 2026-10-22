import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultTree } from '../../src/model/defaultTree';
import {
  addChild,
  addChildOptions,
  addParents,
  addPartner,
  addSibling,
  childrenOf,
  components,
  deleteBlocker,
  deletePerson,
  parentsOf,
  partnersOf,
  RelationError,
  siblingsOf,
  updatePerson,
} from '../../src/model/relations';
import { formatDate, parseSimpleDate, buildGedcomDate } from '../../src/model/dates';
import { selectVisible } from '../../src/layout/visible';
import { computeLayout } from '../../src/layout/layout';
import { importGedcom } from '../../src/gedcom/gedcom';
import type { TreeDoc } from '../../src/model/types';

describe('dates', () => {
  it('formats the five observed date formats', () => {
    expect(formatDate('4 JUL 1994', 'MM/DD/YYYY')).toBe('07/04/1994');
    expect(formatDate('4 JUL 1994', 'MM.DD.YYYY')).toBe('07.04.1994');
    expect(formatDate('4 JUL 1994', 'DD/MM/YYYY')).toBe('04/07/1994');
    expect(formatDate('4 JUL 1994', 'DD.MM.YYYY')).toBe('04.07.1994');
    expect(formatDate('4 JUL 1994', 'YYYY')).toBe('1994');
    expect(formatDate('JUL 1994', 'DD/MM/YYYY')).toBe('07/1994');
    expect(formatDate('ABT 1950', 'DD/MM/YYYY')).toBe('ABT 1950');
  });
  it('builds partial GEDCOM dates', () => {
    expect(buildGedcomDate({ day: 3, month: 2, year: 2001 })).toBe('3 FEB 2001');
    expect(buildGedcomDate({ month: 2, year: 2001 })).toBe('FEB 2001');
    expect(buildGedcomDate({ day: 3, month: 2 })).toBe('');
    expect(parseSimpleDate('BET 1900 AND 1910')).toBeNull();
  });
});

describe('relations (behaviour observed on family-tree-builder.com)', () => {
  it('starts with me + parents', () => {
    const d = createDefaultTree();
    expect(parentsOf(d, 'I1')).toEqual(['I2', 'I3']);
    expect(partnersOf(d, 'I2')).toEqual(['I3']);
  });

  it('refuses "Add parents" when parents exist', () => {
    expect(() => addParents(createDefaultTree(), 'I1')).toThrow(RelationError);
    const r = addParents(createDefaultTree(), 'I2');
    expect(parentsOf(r.doc, 'I2').map((id) => r.doc.persons[id].givenName)).toEqual(['Father of My Father', 'Mother of My Father']);
  });

  it('adds a sibling into the shared parents family, creating parents when missing', () => {
    let r = addSibling(createDefaultTree(), 'I1');
    expect(siblingsOf(r.doc, 'I1')).toEqual([r.select]);
    r = addSibling(createDefaultTree(), 'I2');
    expect(parentsOf(r.doc, 'I2').length).toBe(2);
    expect(siblingsOf(r.doc, 'I2')).toEqual([r.select]);
  });

  it('adds partner of opposite gender', () => {
    const r = addPartner(createDefaultTree(), 'I1');
    expect(r.doc.persons[r.select!].gender).toBe('female');
    expect(partnersOf(r.doc, 'I1')).toEqual([r.select]);
  });

  it('supports the three add-child modes', () => {
    let d = createDefaultTree();
    expect(addChildOptions(d, 'I2')).toEqual([{ partnerId: 'I3', label: 'Add child with My Mother' }]);
    d = addChild(d, 'I2', { kind: 'withPartner', partnerId: 'I3' }).doc;
    expect(childrenOf(d, 'I3').length).toBe(2);
    d = addChild(d, 'I1', { kind: 'single' }).doc;
    expect(partnersOf(d, 'I1')).toEqual([]);
    expect(childrenOf(d, 'I1').length).toBe(1);
    const r = addChild(d, 'I1', { kind: 'newPartner' });
    expect(partnersOf(r.doc, 'I1').length).toBe(1);
    expect(childrenOf(r.doc, 'I1').length).toBe(2);
  });

  it('blocks deleting the last person and splitting the tree', () => {
    const d = createDefaultTree();
    // Deleting "Me" would leave the two parents with no shared child but still married: allowed.
    expect(deleteBlocker(d, 'I1')).toBeNull();
    // A person bridging two groups cannot be removed.
    let bridge = addPartner(d, 'I1').doc; // I4 partner of I1
    bridge = addParents(bridge, 'I4').doc; // I5, I6 parents of I4
    expect(deleteBlocker(bridge, 'I1')?.code).toBe('split');
    expect(deleteBlocker(bridge, 'I4')?.code).toBe('split');
    expect(deleteBlocker(bridge, 'I5')).toBeNull();
    let single = createDefaultTree();
    single = deletePerson(single, 'I1').doc;
    single = deletePerson(single, 'I2').doc;
    expect(deleteBlocker(single, 'I3')?.code).toBe('last-person');
    expect(components(single).length).toBe(1);
  });

  it('cleans up families and keeps focus valid after delete', () => {
    const d = deletePerson(createDefaultTree(), 'I1').doc;
    expect(d.focusId).not.toBe('I1');
    expect(Object.values(d.families)).toEqual([{ id: 'F1', partners: ['I2', 'I3'], children: [] }]);
  });

  it('clears death date when not deceased', () => {
    const d = updatePerson(createDefaultTree(), 'I1', { deceased: false, deathDate: '1 JAN 2000' });
    expect(d.persons.I1.deathDate).toBe('');
  });
});

function overlaps(doc: TreeDoc, up: number, down: number, focus = doc.focusId) {
  const vis = selectVisible(doc, focus, up, down);
  const layout = computeLayout(doc, vis, { density: 'normal', manual: false });
  const byGen = new Map<number, { x: number; w: number }[]>();
  for (const n of layout.nodes.values()) (byGen.get(n.gen) ?? byGen.set(n.gen, []).get(n.gen)!).push(n);
  let bad = 0;
  for (const list of byGen.values()) {
    list.sort((a, b) => a.x - b.x);
    for (let i = 1; i < list.length; i++) if (list[i].x - list[i].w / 2 < list[i - 1].x + list[i - 1].w / 2 - 0.5) bad++;
  }
  return { bad, vis, layout };
}

describe('visible selection and layout', () => {
  it('lays out the default tree with parents above the child', () => {
    const { bad, layout } = overlaps(createDefaultTree(), -1, -1);
    expect(bad).toBe(0);
    const me = layout.nodes.get('I1')!, dad = layout.nodes.get('I2')!, mom = layout.nodes.get('I3')!;
    expect(dad.y).toBeLessThan(me.y);
    expect(Math.abs((dad.x + mom.x) / 2 - me.x)).toBeLessThan(1);
    expect(layout.edges.some((e) => e.kind === 'partner')).toBe(true);
  });

  it('honours generation limits and collapse', () => {
    let d = createDefaultTree();
    d = addParents(d, 'I2').doc;
    d = addChild(d, 'I1', { kind: 'newPartner' }).doc;
    // Partners belong to the same generation, so 0/0 shows the focus person with their partner only.
    const zero = selectVisible(d, 'I1', 0, 0);
    expect([...zero.gen.keys()].sort()).toEqual(['I1', ...partnersOf(d, 'I1')].sort());
    expect(zero.hiddenChildren.has('I1')).toBe(true);
    expect(zero.hiddenParents.has('I1')).toBe(true);
    expect(selectVisible(d, 'I1', 1, 0).gen.has('I2')).toBe(true);
    expect(selectVisible(d, 'I1', 1, 0).gen.has('I4')).toBe(false);
    expect(selectVisible(d, 'I1', 1, 0).hiddenParents.has('I2')).toBe(true);
    expect(selectVisible(d, 'I1', 2, 1).gen.size).toBe(d.order.length);
    const collapsed = { ...d, collapsed: { I2: 'ancestors' as const } };
    expect(selectVisible(collapsed, 'I1', -1, -1).gen.has('I4')).toBe(false);
  });
});

const realPath = path.join(__dirname, '../../local-test-data/abdurrm2023.ged');
describe.skipIf(!fs.existsSync(realPath))('layout on the local 2336-person GEDCOM', () => {
  const doc = fs.existsSync(realPath) ? importGedcom(fs.readFileSync(realPath, 'utf8')).doc : createDefaultTree();
  it('has no overlapping cards for limited and full views', () => {
    for (const [up, down] of [[3, 3], [5, 5], [-1, -1]] as const) {
      const t0 = performance.now();
      const { bad, vis } = overlaps(doc, up, down);
      const ms = performance.now() - t0;
      expect(bad, `overlaps for ${up}/${down}`).toBe(0);
      expect(vis.gen.size).toBeGreaterThan(0);
      expect(ms).toBeLessThan(15000);
    }
  });
  it('keeps every child below its visible parents', () => {
    const { vis, layout } = overlaps(doc, 4, 4);
    for (const fid of vis.families) {
      const f = doc.families[fid];
      for (const p of f.partners)
        for (const c of f.children)
          if (layout.nodes.has(p) && layout.nodes.has(c)) expect(layout.nodes.get(c)!.y).toBeGreaterThan(layout.nodes.get(p)!.y);
    }
  });
});
