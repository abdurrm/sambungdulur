import { describe, expect, it } from 'vitest';
import { createDefaultTree } from '../../src/model/defaultTree';
import { addChild, addSibling } from '../../src/model/relations';
import { selectVisible } from '../../src/layout/visible';
import { computeLayout } from '../../src/layout/layout';
import type { TreeDoc } from '../../src/model/types';

const layoutOf = (doc: TreeDoc) => computeLayout(doc, selectVisible(doc, doc.focusId, -1, -1), { density: 'normal', manual: true });
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('family lines', () => {
  it('an only child between its parents gets one straight line, with no jog at the bus', () => {
    const doc = createDefaultTree();
    const L = layoutOf(doc);
    const me = L.nodes.get('I1')!;
    const drop = L.edges.find((e) => e.id === 'F1:c:I1')!;
    expect(drop.d).not.toContain('Q');
    expect(nums(drop.d)[0]).toBe(Math.round(me.x * 10) / 10);
    const trunk = L.edges.find((e) => e.id === 'F1:trunk')!;
    expect(nums(trunk.d)[0]).toBe(Math.round(me.x * 10) / 10); // the trunk leaves the partner line right above the child
    expect(trunk.d).not.toContain('H'); // no bus needed
  });

  it('also when the child sits a few pixels off the middle of its parents (no small S-bend)', () => {
    const doc = createDefaultTree();
    const L = computeLayout(doc, selectVisible(doc, doc.focusId, -1, -1), { density: 'normal', manual: true, personDx: { I1: 8 } });
    const me = L.nodes.get('I1')!;
    const drop = L.edges.find((e) => e.id === 'F1:c:I1')!;
    expect(drop.d).not.toContain('Q');
    const trunk = L.edges.find((e) => e.id === 'F1:trunk')!;
    expect(nums(trunk.d)[0]).toBe(Math.round(me.x * 10) / 10);
    expect(nums(drop.d)[0]).toBe(Math.round(me.x * 10) / 10);
  });

  it('the bus stops where the elbow of an end child begins, so no straight stub sticks out', () => {
    let doc = createDefaultTree();
    doc = addSibling(doc, 'I1').doc;
    doc = addSibling(doc, 'I1').doc;
    const L = layoutOf(doc);
    const trunk = L.edges.find((e) => e.id === 'F1:trunk')!;
    const bus = /M(-?[\d.]+),(-?[\d.]+)H(-?[\d.]+)/.exec(trunk.d)!;
    const [busL, , busR] = [+bus[1], +bus[2], +bus[3]];
    const drops = L.edges.filter((e) => e.id.startsWith('F1:c:') && e.d.includes('Q'));
    expect(drops.length).toBeGreaterThanOrEqual(2);
    const starts = drops.map((e) => nums(e.d)[0]);
    expect(Math.min(...starts)).toBeCloseTo(busL, 1);
    expect(Math.max(...starts)).toBeCloseTo(busR, 1);
  });

  it('a child of a single parent still drops straight', () => {
    let doc = createDefaultTree();
    doc = addChild(doc, 'I1', { kind: 'single' }).doc;
    const L = layoutOf(doc);
    const kid = [...L.nodes.values()].find((n) => !['I1', 'I2', 'I3'].includes(n.id))!;
    const drop = L.edges.find((e) => e.id.endsWith(`:c:${kid.id}`))!;
    expect(drop.d).not.toContain('Q');
  });
});
