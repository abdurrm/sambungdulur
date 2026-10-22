import type { TreeDoc } from '../model/types';
import type { VisibleGraph } from './visible';
import { cardContent, cardStyle, type CardContent, type Density } from './metrics';

export interface LayoutNode {
  id: string;
  gen: number;
  x: number; // centre
  y: number; // top
  w: number;
  h: number;
  content: CardContent;
}

export type EdgeKind = 'partner' | 'partner-far' | 'child';

export interface LayoutEdge {
  id: string;
  familyId: string;
  kind: EdgeKind;
  d: string;
  /** Person ids this edge connects (used for lineage highlighting). */
  from: string[];
  to: string[];
}

export interface FamilyHandle {
  familyId: string;
  x: number;
  y: number;
}

export interface TreeLayout {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  handles: FamilyHandle[];
  width: number;
  height: number;
  minX: number;
  minY: number;
}

export interface LayoutOptions {
  density: Density;
  /** Apply manual offsets from doc.manual (true for canvas, true for exports). */
  manual: boolean;
  /** Override offsets while dragging in manual mode. */
  personDx?: Record<string, number>;
  familyDy?: Record<string, number>;
}

const PARTNER_GAP = 36;
const UNIT_GAP = 44;
const COMPONENT_GAP = 72;
const LAYER_GAP = 96;
const CORNER = 10;

interface Unit {
  members: string[];
  gen: number;
  width: number;
  offsets: number[]; // member centre relative to unit centre
  x: number;
}

/** Pool-adjacent-violators: least-squares non-decreasing fit of `t` with weights `w`. */
function pava(t: number[], w: number[]): number[] {
  const vals: number[] = [];
  const wts: number[] = [];
  const counts: number[] = [];
  for (let i = 0; i < t.length; i++) {
    vals.push(t[i]);
    wts.push(w[i]);
    counts.push(1);
    while (vals.length > 1 && vals[vals.length - 2] > vals[vals.length - 1]) {
      const v2 = vals.pop()!, w2 = wts.pop()!, c2 = counts.pop()!;
      const v1 = vals.pop()!, w1 = wts.pop()!, c1 = counts.pop()!;
      const ww = w1 + w2;
      vals.push((v1 * w1 + v2 * w2) / ww);
      wts.push(ww);
      counts.push(c1 + c2);
    }
  }
  const out: number[] = [];
  vals.forEach((v, i) => {
    for (let k = 0; k < counts[i]; k++) out.push(v);
  });
  return out;
}

/** Orders partners so that a person with several partners sits between them. */
function chainOrder(ids: string[], adj: Map<string, Set<string>>): string[] {
  if (ids.length <= 2) return ids;
  const deg = (id: string) => [...(adj.get(id) ?? [])].filter((x) => ids.includes(x)).length;
  const isPath = ids.every((id) => deg(id) <= 2) && ids.some((id) => deg(id) === 1);
  if (isPath) {
    const start = ids.find((id) => deg(id) === 1)!;
    const out = [start];
    const seen = new Set(out);
    let cur = start;
    for (;;) {
      const next = [...(adj.get(cur) ?? [])].find((x) => ids.includes(x) && !seen.has(x));
      if (!next) break;
      out.push(next);
      seen.add(next);
      cur = next;
    }
    for (const id of ids) if (!seen.has(id)) out.push(id);
    return out;
  }
  const center = [...ids].sort((a, b) => deg(b) - deg(a))[0];
  const rest = ids.filter((x) => x !== center);
  const left = rest.slice(0, Math.ceil(rest.length / 2));
  return [...left, center, ...rest.slice(left.length)];
}

export function computeLayout(doc: TreeDoc, vis: VisibleGraph, opts: LayoutOptions): TreeLayout {
  const settings = doc.settings;
  const st = cardStyle(settings, opts.density);
  const nodes = new Map<string, LayoutNode>();
  for (const [id, g] of vis.gen) {
    const p = doc.persons[id];
    const content = cardContent(p, settings, opts.density, !!doc.compactCards[id]);
    nodes.set(id, { id, gen: g, x: 0, y: 0, w: st.width, h: content.height, content });
  }
  const families = vis.families.map((fid) => doc.families[fid]);

  // --- Units: partners in the same generation are kept side by side. -----------------
  const partnerAdj = new Map<string, Set<string>>();
  for (const f of families) {
    const ps = f.partners.filter((p) => nodes.has(p));
    for (let i = 0; i < ps.length; i++)
      for (let j = 0; j < ps.length; j++)
        if (i !== j && nodes.get(ps[i])!.gen === nodes.get(ps[j])!.gen) {
          if (!partnerAdj.has(ps[i])) partnerAdj.set(ps[i], new Set());
          partnerAdj.get(ps[i])!.add(ps[j]);
        }
  }
  // Traversal order (BFS from focus) seeds a stable initial ordering.
  const seedOrder = new Map<string, number>();
  [...vis.gen.keys()].forEach((id, i) => seedOrder.set(id, i));
  const unitOf = new Map<string, Unit>();
  const units: Unit[] = [];
  for (const id of vis.gen.keys()) {
    if (unitOf.has(id)) continue;
    const comp: string[] = [];
    const stack = [id];
    const seen = new Set([id]);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const n of partnerAdj.get(cur) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
    }
    comp.sort((a, b) => seedOrder.get(a)! - seedOrder.get(b)!);
    const members = chainOrder(comp, partnerAdj);
    const width = members.length * st.width + (members.length - 1) * PARTNER_GAP;
    const offsets = members.map((_, i) => -width / 2 + st.width / 2 + i * (st.width + PARTNER_GAP));
    const u: Unit = { members, gen: vis.gen.get(id)!, width, offsets, x: 0 };
    units.push(u);
    for (const m of members) unitOf.set(m, u);
  }
  const memberOffset = (id: string) => {
    const u = unitOf.get(id)!;
    return u.offsets[u.members.indexOf(id)];
  };
  const personX = (id: string) => unitOf.get(id)!.x + memberOffset(id);

  // --- Layers --------------------------------------------------------------------------
  const gens = [...new Set(units.map((u) => u.gen))].sort((a, b) => a - b);
  const layers = new Map<number, Unit[]>();
  for (const g of gens) layers.set(g, []);
  for (const u of units) layers.get(u.gen)!.push(u);
  for (const g of gens) layers.get(g)!.sort((a, b) => seedOrder.get(a.members[0])! - seedOrder.get(b.members[0])!);

  // Relationship anchors between units.
  const parentFamOf = new Map<string, typeof families>();
  const childFamOf = new Map<string, typeof families>();
  for (const f of families) {
    for (const c of f.children) if (nodes.has(c)) (parentFamOf.get(c) ?? parentFamOf.set(c, []).get(c)!).push(f);
    for (const p of f.partners) if (nodes.has(p)) (childFamOf.get(p) ?? childFamOf.set(p, []).get(p)!).push(f);
  }
  const famAnchorX = (f: (typeof families)[number]) => {
    const ps = f.partners.filter((p) => nodes.has(p));
    return ps.reduce((s, p) => s + personX(p), 0) / ps.length;
  };
  const famAnchorOffset = (f: (typeof families)[number], u: Unit) => {
    const ps = f.partners.filter((p) => unitOf.get(p) === u);
    return ps.reduce((s, p) => s + memberOffset(p), 0) / ps.length;
  };

  const target = (u: Unit, dir: 'up' | 'down' | 'both'): number | null => {
    let sum = 0;
    let n = 0;
    if (dir !== 'down') {
      for (const m of u.members)
        for (const f of parentFamOf.get(m) ?? []) {
          if (!f.partners.some((p) => nodes.has(p))) continue;
          sum += famAnchorX(f) - memberOffset(m);
          n++;
        }
    }
    if (dir !== 'up') {
      for (const m of u.members)
        for (const f of childFamOf.get(m) ?? []) {
          const kids = f.children.filter((c) => nodes.has(c));
          if (!kids.length) continue;
          const mean = kids.reduce((s, c) => s + personX(c), 0) / kids.length;
          sum += (mean - famAnchorOffset(f, u)) * 1;
          n++;
        }
    }
    return n ? sum / n : null;
  };

  const pack = (layer: Unit[]) => {
    let x = 0;
    for (const u of layer) {
      u.x = x + u.width / 2;
      x += u.width + UNIT_GAP;
    }
  };
  for (const g of gens) pack(layers.get(g)!);

  const place = (layer: Unit[], dir: 'up' | 'down' | 'both') => {
    if (!layer.length) return;
    const cum: number[] = [0];
    for (let i = 1; i < layer.length; i++)
      cum.push(cum[i - 1] + (layer[i - 1].width + layer[i].width) / 2 + UNIT_GAP);
    const t = layer.map((u, i) => (target(u, dir) ?? target(u, 'both') ?? u.x) - cum[i]);
    const w = layer.map((u) => (target(u, dir) == null ? 0.05 : 1));
    const y = pava(t, w);
    layer.forEach((u, i) => (u.x = y[i] + cum[i]));
  };
  const reorder = (layer: Unit[], dir: 'up' | 'down') => {
    const key = new Map<Unit, number>();
    for (const u of layer) key.set(u, target(u, dir) ?? u.x);
    layer.sort((a, b) => key.get(a)! - key.get(b)!);
  };

  // Crossing reduction + placement sweeps.
  for (let iter = 0; iter < 6; iter++) {
    for (const g of gens.slice(1)) {
      reorder(layers.get(g)!, 'up');
      place(layers.get(g)!, 'up');
    }
    for (const g of [...gens].reverse().slice(1)) {
      reorder(layers.get(g)!, 'down');
      place(layers.get(g)!, 'down');
    }
  }
  for (let iter = 0; iter < 12; iter++) {
    for (const g of gens) place(layers.get(g)!, 'both');
    for (const g of [...gens].reverse()) place(layers.get(g)!, 'both');
  }
  void COMPONENT_GAP;

  // --- Y positions ---------------------------------------------------------------------
  const layerTop = new Map<number, number>();
  const layerHeight = new Map<number, number>();
  let y = 0;
  for (const g of gens) {
    const h = Math.max(...layers.get(g)!.flatMap((u) => u.members.map((m) => nodes.get(m)!.h)));
    layerTop.set(g, y);
    layerHeight.set(g, h);
    y += h + LAYER_GAP;
  }
  const dx = opts.manual ? { ...doc.manual.personDx, ...(opts.personDx ?? {}) } : {};
  const dy = opts.manual ? { ...doc.manual.familyDy, ...(opts.familyDy ?? {}) } : {};
  for (const n of nodes.values()) {
    n.x = personX(n.id) + (dx[n.id] ?? 0);
    n.y = layerTop.get(n.gen)!;
  }

  // --- Edges ---------------------------------------------------------------------------
  const edges: LayoutEdge[] = [];
  const handles: FamilyHandle[] = [];
  const r = (v: number) => Math.round(v * 10) / 10;
  // Stagger buses of families sharing a layer gap so their horizontal lines don't merge.
  const gapSlots = new Map<number, number>();
  for (const f of families) {
    const ps = f.partners.filter((p) => nodes.has(p)).map((p) => nodes.get(p)!);
    const kids = f.children.filter((c) => nodes.has(c)).map((c) => nodes.get(c)!);
    if (!ps.length) continue;
    // Partner links.
    for (let i = 0; i + 1 < ps.length; i++) {
      const a = ps[i], b = ps[i + 1];
      const [l, rr] = a.x < b.x ? [a, b] : [b, a];
      const ly = l.y + Math.min(l.h, rr.h) / 2;
      if (a.gen === b.gen && unitOf.get(a.id) === unitOf.get(b.id) && Math.abs(unitOf.get(a.id)!.members.indexOf(a.id) - unitOf.get(b.id)!.members.indexOf(b.id)) === 1) {
        edges.push({ id: `${f.id}:p${i}`, familyId: f.id, kind: 'partner', d: `M${r(l.x + l.w / 2)},${r(ly)}H${r(rr.x - rr.w / 2)}`, from: [a.id], to: [b.id] });
      } else {
        const ay = a.y + a.h / 2, by = b.y + b.h / 2;
        const sx = a.x < b.x ? a.x + a.w / 2 : a.x - a.w / 2;
        const ex = a.x < b.x ? b.x - b.w / 2 : b.x + b.w / 2;
        const lift = Math.max(40, Math.abs(ex - sx) * 0.15);
        edges.push({
          id: `${f.id}:p${i}`,
          familyId: f.id,
          kind: 'partner-far',
          d: `M${r(sx)},${r(ay)}C${r(sx)},${r(ay - lift)} ${r(ex)},${r(by - lift)} ${r(ex)},${r(by)}`,
          from: [a.id],
          to: [b.id],
        });
      }
    }
    if (!kids.length) continue;
    const parentGen = Math.max(...ps.map((p) => p.gen));
    const parentBottom = Math.max(...ps.map((p) => p.y + p.h));
    const childTop = Math.min(...kids.map((k) => k.y));
    const sameUnitPair = ps.length === 2 && ps[0].gen === ps[1].gen && unitOf.get(ps[0].id) === unitOf.get(ps[1].id);
    let ax: number;
    let ay: number;
    if (sameUnitPair) {
      ax = (ps[0].x + ps[1].x) / 2;
      ay = ps[0].y + Math.min(ps[0].h, ps[1].h) / 2;
    } else {
      ax = ps[0].x;
      ay = ps[0].y + ps[0].h;
    }
    const slot = gapSlots.get(parentGen) ?? 0;
    gapSlots.set(parentGen, slot + 1);
    const stagger = ((slot % 5) - 2) * 7;
    const busY = Math.max(parentBottom + 18, Math.min(childTop - 18, (parentBottom + childTop) / 2 + stagger + (dy[f.id] ?? 0)));
    handles.push({ familyId: f.id, x: ax, y: busY });
    const xs = kids.map((k) => k.x);
    const minX = Math.min(ax, ...xs);
    const maxX = Math.max(ax, ...xs);
    // Trunk from couple (or single parent) down to the bus.
    let d = `M${r(ax)},${r(ay)}V${r(busY)}`;
    if (maxX - minX > 0.5) d += `M${r(minX)},${r(busY)}H${r(maxX)}`;
    edges.push({ id: `${f.id}:trunk`, familyId: f.id, kind: 'child', d, from: ps.map((p) => p.id), to: kids.map((k) => k.id) });
    for (const k of kids) {
      // Drop to each child with a rounded elbow where the drop leaves the bus.
      const c = Math.min(CORNER, Math.abs(k.x - ax), Math.max(0, k.y - busY));
      let kd: string;
      if (Math.abs(k.x - ax) < 0.5 || c < 1) kd = `M${r(k.x)},${r(busY)}V${r(k.y)}`;
      else {
        const sgn = k.x > ax ? 1 : -1;
        kd = `M${r(k.x - sgn * c)},${r(busY)}Q${r(k.x)},${r(busY)} ${r(k.x)},${r(busY + c)}V${r(k.y)}`;
      }
      edges.push({ id: `${f.id}:c:${k.id}`, familyId: f.id, kind: 'child', d: kd, from: ps.map((p) => p.id), to: [k.id] });
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes.values()) {
    minX = Math.min(minX, n.x - n.w / 2);
    maxX = Math.max(maxX, n.x + n.w / 2);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + n.h);
  }
  if (!nodes.size) (minX = 0), (maxX = 0), (minY = 0), (maxY = 0);
  return { nodes, edges, handles, width: maxX - minX, height: maxY - minY, minX, minY };
}

/** Ancestors + descendants of a person within the visible graph, for lineage highlighting. */
export function lineage(doc: TreeDoc, id: string, visible: Set<string>): Set<string> {
  const out = new Set<string>([id]);
  const up = [id];
  while (up.length) {
    const cur = up.pop()!;
    for (const fid of doc.familyOrder) {
      const f = doc.families[fid];
      if (!f.children.includes(cur)) continue;
      for (const p of f.partners) if (visible.has(p) && !out.has(p)) (out.add(p), up.push(p));
    }
  }
  const down = [id];
  const seen = new Set([id]);
  while (down.length) {
    const cur = down.pop()!;
    for (const fid of doc.familyOrder) {
      const f = doc.families[fid];
      if (!f.partners.includes(cur)) continue;
      for (const c of f.children) if (visible.has(c) && !seen.has(c)) (seen.add(c), out.add(c), down.push(c));
    }
  }
  return out;
}
