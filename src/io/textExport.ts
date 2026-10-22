import type { Person, TreeDoc } from '../model/types';
import { formatDateLong } from '../model/dates';
import { displayName, parentFamilies, partnerFamilies } from '../model/relations';
import { t } from '../i18n';

export interface TextExportOptions {
  focusId: string;
  /** Generations of ancestors (-1 = all). */
  ancestors: number;
  /** Generations of descendants (-1 = all). */
  descendants: number;
  includeFacts: boolean;
  includeIndex: boolean;
  /** Also list every family group of the whole file (useful for big imports). */
  includeAllFamilies: boolean;
}

const MAX_DEPTH = 60;

function lifeSpan(p: Person): string {
  const parts: string[] = [];
  const b = formatDateLong(p.birthDate);
  if (b || p.birthPlace) parts.push(`${t('txBorn')} ${[b, p.birthPlace && `${t('txIn')} ${p.birthPlace}`].filter(Boolean).join(' ')}`);
  if (p.deceased) parts.push(`${t('txDied')} ${formatDateLong(p.deathDate) || t('txDateUnknown')}`);
  return parts.join('; ');
}

function describe(doc: TreeDoc, p: Person): string {
  const extra = [
    p.gender === 'male' ? 'L/M' : p.gender === 'female' ? 'P/F' : '?',
    lifeSpan(p),
    p.profession && t('txOccupation', { p: p.profession }),
  ].filter(Boolean);
  return `${displayName(p, doc.settings)} (${extra.join('; ')})`;
}

function factsBlock(p: Person, indent: string): string[] {
  if (!p.facts) return [];
  return p.facts.split('\n').filter(Boolean).map((l) => `${indent}  > ${l}`);
}

export function exportGenealogyText(doc: TreeDoc, opts: TextExportOptions): string {
  const root = doc.persons[opts.focusId] ?? doc.persons[doc.order[0]];
  const out: string[] = [];
  const rule = '='.repeat(72);
  const line = '-'.repeat(72);
  out.push(rule, `${t('txGenealogy')} — ${doc.title}`.trim(), rule);
  out.push(t('txGenerated', { date: new Date().toISOString().slice(0, 10) }));
  out.push(t('txCounts', { n: doc.order.length, f: doc.familyOrder.length }));
  if (!root) return out.join('\n') + '\n';
  out.push(t('txRoot', { p: describe(doc, root) }), '');

  // Ancestors, Ahnentafel numbering (1 = root, 2n / 2n+1 = parents, father's side first).
  out.push(line, t('txAncestors', { name: displayName(root, doc.settings) }), line);
  const ahnen: { n: number; id: string; gen: number }[] = [{ n: 1, id: root.id, gen: 0 }];
  for (let i = 0; i < ahnen.length; i++) {
    const { n, id, gen } = ahnen[i];
    if (gen > MAX_DEPTH) continue;
    if (opts.ancestors >= 0 && gen >= opts.ancestors) continue;
    const fam = parentFamilies(doc, id).find((f) => f.partners.length);
    if (!fam) continue;
    const ps = [...fam.partners].sort((a, b) => (doc.persons[a]?.gender === 'female' ? 1 : 0) - (doc.persons[b]?.gender === 'female' ? 1 : 0));
    ps.slice(0, 2).forEach((p, k) => ahnen.push({ n: 2 * n + k, id: p, gen: gen + 1 }));
  }
  let lastGen = -1;
  for (const a of ahnen.sort((x, y) => x.n - y.n)) {
    if (a.gen !== lastGen) {
      const suffix = a.gen === 0 ? t('txGenRoot') : a.gen === 1 ? t('txGenParents') : a.gen === 2 ? t('txGenGrand') : '';
      out.push('', t('txGeneration', { n: a.gen + 1 }) + suffix);
      lastGen = a.gen;
    }
    const p = doc.persons[a.id];
    out.push(`  ${a.n}. ${describe(doc, p)}`);
    if (opts.includeFacts) out.push(...factsBlock(p, '    '));
  }
  out.push('');

  // Descendants, outline numbering (1, 1.1, 1.1.2 …).
  out.push(line, t('txDescendants', { name: displayName(root, doc.settings) }), line);
  const visited = new Set<string>();
  const walk = (id: string, label: string, depth: number) => {
    const p = doc.persons[id];
    const indent = '  '.repeat(depth);
    if (visited.has(id)) {
      out.push(`${indent}${label} ${displayName(p, doc.settings)} ${t('txSeeAbove')}`);
      return;
    }
    visited.add(id);
    out.push(`${indent}${label} ${describe(doc, p)}`);
    if (opts.includeFacts) out.push(...factsBlock(p, indent));
    let childNo = 0;
    for (const f of partnerFamilies(doc, id)) {
      const partner = f.partners.find((x) => x !== id);
      out.push(`${indent}   + ${partner ? t('txPartner', { p: describe(doc, doc.persons[partner]) }) : t('txNoPartner')}`);
      if (opts.descendants >= 0 && depth >= opts.descendants) {
        if (f.children.length) out.push(`${indent}     ${t('txBeyond', { n: f.children.length })}`);
        continue;
      }
      if (depth >= MAX_DEPTH) continue;
      for (const c of f.children) walk(c, `${label}.${++childNo}`, depth + 1);
    }
  };
  walk(root.id, '1', 0);
  out.push('');

  if (opts.includeAllFamilies) {
    out.push(line, t('txAllFamilies'), line);
    for (const fid of doc.familyOrder) {
      const f = doc.families[fid];
      const names = f.partners.map((p) => displayName(doc.persons[p], doc.settings)).join(' & ') || t('txUnknownParents');
      out.push(`[${fid}] ${names}`);
      for (const c of f.children) out.push(`    - ${describe(doc, doc.persons[c])}`);
    }
    out.push('');
  }

  if (opts.includeIndex) {
    out.push(line, t('txIndex'), line);
    const rows = doc.order
      .map((id) => doc.persons[id])
      .map((p) => ({ name: displayName(p, doc.settings), id: p.id, span: lifeSpan(p) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const r of rows) out.push(`${r.name} [${r.id}]${r.span ? ` — ${r.span}` : ''}`);
    out.push('');
  }
  return out.join('\n');
}
