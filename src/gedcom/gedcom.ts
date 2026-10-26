import type { Family, Gender, MediaItem, PersonFields, TreeDoc } from '../model/types';
import { DEFAULT_SETTINGS } from '../model/types';
import {
  child,
  childrenTagged,
  ensureChild,
  type GedFile,
  type GedNode,
  node,
  parseGedcomText,
  readText,
  removeChild,
  serializeGedcom,
  setValue,
  writeText,
} from './ast';

// ---------------------------------------------------------------------------
// Field extraction (shared by import and by export diffing)
// ---------------------------------------------------------------------------

export function htmlToText(s: string): string {
  if (!/[<&]/.test(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface NameParts {
  given: string;
  surname: string;
  suffix: string;
}

export function splitName(value: string): NameParts {
  const m = /^([^/]*)\/([^/]*)\/?(.*)$/.exec(value);
  if (!m) return { given: value.trim(), surname: '', suffix: '' };
  return { given: m[1].trim(), surname: m[2].trim(), suffix: m[3].trim() };
}

function genderOf(v: string): Gender {
  const s = v.trim().toUpperCase();
  return s === 'M' ? 'male' : s === 'F' ? 'female' : 'other';
}

/** Primary OBJE: the first with _PRIM Y, otherwise the first OBJE that has a FILE. */
function primaryObje(indi: GedNode): GedNode | undefined {
  const objes = childrenTagged(indi, 'OBJE').filter((o) => child(o, 'FILE'));
  return objes.find((o) => child(o, '_PRIM')?.value.trim().toUpperCase() === 'Y') ?? objes[0];
}

interface Extracted extends Omit<PersonFields, 'photoId'> {
  photoPath: string;
}

function noteText(indi: GedNode, notes: Map<string, GedNode>): string {
  const n = child(indi, 'NOTE');
  if (!n) return '';
  const ptr = /^@([^@]+)@$/.exec(n.value.trim());
  return htmlToText(readText(ptr ? notes.get(ptr[1]) : n));
}

export function extractPerson(indi: GedNode, notes: Map<string, GedNode>): Extracted {
  const name = child(indi, 'NAME');
  const parts = splitName(name?.value ?? '');
  const given = parts.given || child(name, 'GIVN')?.value.trim() || '';
  const birt = child(indi, 'BIRT');
  const deat = child(indi, 'DEAT');
  return {
    givenName: given,
    surnameAtBirth: parts.surname,
    surnameNow: child(name, '_MARNM')?.value.trim() ?? '',
    gender: genderOf(child(indi, 'SEX')?.value ?? ''),
    birthDate: child(birt, 'DATE')?.value.trim() ?? '',
    birthPlace: child(birt, 'PLAC')?.value.trim() ?? '',
    deceased: !!deat,
    deathDate: child(deat, 'DATE')?.value.trim() ?? '',
    profession: child(indi, 'OCCU')?.value.trim() ?? '',
    facts: noteText(indi, notes),
    photoPath: child(primaryObje(indi), 'FILE')?.value.trim() ?? '',
    ...(child(indi, '_NIK') ? { nik: child(indi, '_NIK')!.value.trim() } : {}),
    ...(child(indi, 'RELI') ? { religion: child(indi, 'RELI')!.value.trim() } : {}),
    ...(child(indi, 'EDUC') ? { education: child(indi, 'EDUC')!.value.trim() } : {}),
    ...(child(indi, 'NATI') ? { nationality: child(indi, 'NATI')!.value.trim() } : {}),
  };
}

const ptr = (v: string) => /^@([^@]+)@$/.exec(v.trim())?.[1];

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface GedcomStats {
  individuals: number;
  families: number;
  otherRecords: number;
  media: number;
}

export function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function mimeFor(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

export function importGedcom(text: string, title = 'Imported tree'): { doc: TreeDoc; stats: GedcomStats } {
  const file = parseGedcomText(text);
  const notes = new Map<string, GedNode>();
  for (const r of file.records) if (r.tag === 'NOTE' && r.xref) notes.set(r.xref, r);

  const doc: TreeDoc = {
    title,
    persons: {},
    families: {},
    order: [],
    familyOrder: [],
    focusId: '',
    settings: { ...DEFAULT_SETTINGS },
    manual: { personDx: {}, familyDy: {} },
    media: {},
    gedcomSource: text,
    origin: 'gedcom',
    collapsed: {},
    gallery: {},
    compactCards: {},
  };
  const mediaByPath = new Map<string, string>();
  const mediaId = (p: string) => {
    let id = mediaByPath.get(p);
    if (!id) {
      id = `M${mediaByPath.size + 1}`;
      mediaByPath.set(p, id);
      const item: MediaItem = { id, fileName: basename(p), mime: mimeFor(p), sourcePath: p, available: false };
      doc.media[id] = item;
    }
    return id;
  };
  let other = 0;
  for (const r of file.records) {
    if (r.tag === 'INDI' && r.xref) {
      const { photoPath, ...fields } = extractPerson(r, notes);
      const photoId = photoPath ? mediaId(photoPath) : '';
      doc.persons[r.xref] = { id: r.xref, ...fields, photoId };
      doc.order.push(r.xref);
      const extra = childrenTagged(r, 'OBJE')
        .map((o) => child(o, 'FILE')?.value.trim() ?? '')
        .filter((p) => p && p !== photoPath)
        .map(mediaId);
      if (extra.length) doc.gallery[r.xref] = [...new Set(extra)];
    } else if (r.tag !== 'FAM' && r.tag !== 'HEAD' && r.tag !== 'TRLR' && r.level === 0) {
      other++;
    }
  }
  for (const r of file.records) {
    if (r.tag !== 'FAM' || !r.xref) continue;
    const partners = [...childrenTagged(r, 'HUSB'), ...childrenTagged(r, 'WIFE')]
      .map((n) => ptr(n.value))
      .filter((x): x is string => !!x && !!doc.persons[x]);
    const children = childrenTagged(r, 'CHIL')
      .map((n) => ptr(n.value))
      .filter((x): x is string => !!x && !!doc.persons[x]);
    doc.families[r.xref] = { id: r.xref, partners, children };
    doc.familyOrder.push(r.xref);
  }
  doc.focusId = doc.order[0] ?? '';
  if (doc.order.length <= 60) {
    doc.settings.ancestorGenerations = -1;
    doc.settings.descendantGenerations = -1;
  }
  return {
    doc,
    stats: {
      individuals: doc.order.length,
      families: doc.familyOrder.length,
      otherRecords: other,
      media: mediaByPath.size,
    },
  };
}

// ---------------------------------------------------------------------------
// Export (diff-apply onto the original record tree)
// ---------------------------------------------------------------------------

function freshFile(): GedFile {
  const today = new Date();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return {
    bom: true,
    eol: '\r\n',
    finalEol: true,
    records: [
      node('HEAD', '', [
        node('GEDC', '', [node('VERS', '5.5.1'), node('FORM', 'LINEAGE-LINKED')]),
        node('CHAR', 'UTF-8'),
        node('SOUR', 'SAMBUNGDULUR', [node('NAME', 'SambungDulur'), node('VERS', '1.0')]),
        node('DATE', `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`),
        node('SUBM', '@U1@'),
      ]),
      { ...node('SUBM', '', [node('NAME', 'SambungDulur user')]), xref: 'U1' },
      node('TRLR'),
    ],
  };
}

function formFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? 'jpg';
  return ext === 'jpeg' ? 'jpg' : ext;
}

function sexCode(g: Gender) {
  return g === 'male' ? 'M' : g === 'female' ? 'F' : 'U';
}

function applyName(indi: GedNode, want: Extracted, have: Extracted | null) {
  if (have && have.givenName === want.givenName && have.surnameAtBirth === want.surnameAtBirth && have.surnameNow === want.surnameNow)
    return;
  let name = child(indi, 'NAME');
  if (!name) {
    if (!want.givenName && !want.surnameAtBirth && !want.surnameNow) return;
    name = node('NAME');
    indi.children.unshift(name);
  }
  const old = splitName(name.value);
  const value = [want.givenName, `/${want.surnameAtBirth}/`, old.suffix].filter(Boolean).join(' ');
  setValue(name, value);
  const givn = child(name, 'GIVN');
  if (givn) {
    if (want.givenName) setValue(givn, want.givenName);
    else removeChild(name, givn);
  }
  const surn = child(name, 'SURN');
  if (want.surnameAtBirth) {
    if (surn) setValue(surn, want.surnameAtBirth);
    else if (givn) ensureChild(name, 'SURN', ['GIVN']).value = want.surnameAtBirth;
  } else if (surn) removeChild(name, surn);
  const marnm = child(name, '_MARNM');
  if (want.surnameNow) {
    const m = marnm ?? ensureChild(name, '_MARNM', ['GIVN', 'SURN']);
    setValue(m, want.surnameNow);
  } else if (marnm) removeChild(name, marnm);
}

const EVENT_ANCHORS = ['NAME', 'SEX', 'BIRT'];

function applyEventField(indi: GedNode, tag: 'BIRT' | 'DEAT', sub: 'DATE' | 'PLAC', value: string) {
  let ev = child(indi, tag);
  if (!value) {
    const s = child(ev, sub);
    if (ev && s) {
      removeChild(ev, s);
      if (ev.children.length === 0 && tag === 'BIRT' && !ev.value) removeChild(indi, ev);
      else if (ev.children.length === 0 && tag === 'DEAT') setValue(ev, 'Y');
    }
    return;
  }
  if (!ev) ev = ensureChild(indi, tag, tag === 'BIRT' ? ['NAME', 'SEX'] : EVENT_ANCHORS);
  if (tag === 'DEAT' && ev.value === 'Y') setValue(ev, '');
  const s = ensureChild(ev, sub, sub === 'PLAC' ? ['TYPE', 'DATE'] : ['TYPE']);
  setValue(s, value);
}

function applyPerson(
  indi: GedNode,
  want: Extracted,
  have: Extracted | null,
  notes: Map<string, GedNode>,
) {
  applyName(indi, want, have);
  for (const [field, tag] of [['nik', '_NIK'], ['religion', 'RELI'], ['education', 'EDUC'], ['nationality', 'NATI']] as const) {
    if (want[field] === have?.[field]) continue;
    const previous = child(indi, tag);
    if (want[field]) setValue(previous ?? ensureChild(indi, tag), want[field]!);
    else if (previous) removeChild(indi, previous);
  }
  if (!have || have.gender !== want.gender) {
    const sex = child(indi, 'SEX') ?? ensureChild(indi, 'SEX', ['NAME']);
    setValue(sex, sexCode(want.gender));
  }
  if (!have || have.birthDate !== want.birthDate) applyEventField(indi, 'BIRT', 'DATE', want.birthDate);
  if (!have || have.birthPlace !== want.birthPlace) applyEventField(indi, 'BIRT', 'PLAC', want.birthPlace);
  if (!have || have.deceased !== want.deceased || have.deathDate !== want.deathDate) {
    if (!want.deceased) {
      const d = child(indi, 'DEAT');
      if (d) removeChild(indi, d);
    } else if (want.deathDate) {
      applyEventField(indi, 'DEAT', 'DATE', want.deathDate);
    } else {
      const d = child(indi, 'DEAT');
      if (!d) ensureChild(indi, 'DEAT', EVENT_ANCHORS).value = 'Y';
      else {
        const dt = child(d, 'DATE');
        if (dt) removeChild(d, dt);
        if (d.children.length === 0) setValue(d, 'Y');
      }
    }
  }
  if (!have || have.profession !== want.profession) {
    const occu = child(indi, 'OCCU');
    if (want.profession) setValue(occu ?? ensureChild(indi, 'OCCU', ['BIRT', 'DEAT']), want.profession);
    else if (occu) removeChild(indi, occu);
  }
  if (!have || have.facts !== want.facts) {
    const n = child(indi, 'NOTE');
    const p = n && /^@([^@]+)@$/.exec(n.value.trim());
    if (!want.facts) {
      if (n) removeChild(indi, n);
    } else if (p && notes.get(p[1])) {
      writeText(notes.get(p[1])!, want.facts);
    } else {
      writeText(n ?? ensureChild(indi, 'NOTE', ['BIRT', 'DEAT', 'OCCU']), want.facts);
    }
  }
  if (!have || have.photoPath !== want.photoPath) {
    const prim = primaryObje(indi);
    if (prim) removeChild(indi, prim);
    if (want.photoPath) {
      const obje = node('OBJE', '', [node('FORM', formFor(want.photoPath)), node('FILE', want.photoPath), node('_PRIM', 'Y')]);
      const idx = prim ? indi.children.length : indi.children.length;
      indi.children.splice(idx, 0, obje);
    }
  }
}

function reconcilePointers(rec: GedNode, tags: string[], want: { tag: string; xref: string }[]) {
  const existing = rec.children.filter((c) => tags.includes(c.tag));
  const same =
    existing.length === want.length && existing.every((c, i) => c.tag === want[i].tag && ptr(c.value) === want[i].xref);
  if (same) return;
  const pool = [...existing];
  const rebuilt = want.map((w) => {
    const i = pool.findIndex((c) => c.tag === w.tag && ptr(c.value) === w.xref);
    if (i >= 0) return pool.splice(i, 1)[0];
    return node(w.tag, `@${w.xref}@`);
  });
  const firstIdx = existing.length ? rec.children.indexOf(existing[0]) : rec.children.length;
  const kept = rec.children.filter((c) => !tags.includes(c.tag));
  const insertAt = kept.filter((c) => rec.children.indexOf(c) < firstIdx).length;
  kept.splice(insertAt, 0, ...rebuilt);
  rec.children = kept;
}

function familyPointers(doc: TreeDoc, f: Family) {
  const partners = f.partners.filter((p) => doc.persons[p]);
  const out: { tag: string; xref: string }[] = [];
  // HUSB/WIFE by gender when it disambiguates, else by stored order.
  const male = partners.find((p) => doc.persons[p].gender === 'male');
  const female = partners.find((p) => doc.persons[p].gender === 'female' && p !== male);
  if (partners.length === 2 && male && female) {
    out.push({ tag: 'HUSB', xref: male }, { tag: 'WIFE', xref: female });
  } else if (partners.length === 1) {
    out.push({ tag: doc.persons[partners[0]].gender === 'female' ? 'WIFE' : 'HUSB', xref: partners[0] });
  } else {
    partners.forEach((p, i) => out.push({ tag: i === 0 ? 'HUSB' : 'WIFE', xref: p }));
  }
  for (const c of f.children) if (doc.persons[c]) out.push({ tag: 'CHIL', xref: c });
  return out;
}

export interface GedcomExportOptions {
  /** Maps media id -> path to write in OBJE FILE for media without a source path. */
  mediaPath?: (id: string) => string;
}

export function exportGedcom(doc: TreeDoc, opts: GedcomExportOptions = {}): string {
  const file = doc.gedcomSource ? parseGedcomText(doc.gedcomSource) : freshFile();
  const notes = new Map<string, GedNode>();
  const indis = new Map<string, GedNode>();
  const fams = new Map<string, GedNode>();
  for (const r of file.records) {
    if (!r.xref) continue;
    if (r.tag === 'NOTE') notes.set(r.xref, r);
    if (r.tag === 'INDI') indis.set(r.xref, r);
    if (r.tag === 'FAM') fams.set(r.xref, r);
  }
  const photoPath = (id: string) => {
    const m = doc.media[id];
    if (!m) return '';
    return m.sourcePath || opts.mediaPath?.(id) || `media/${m.fileName}`;
  };

  // Persons whose family pointers need reconciliation.
  const touched = new Set<string>();
  const newRecords: GedNode[] = [];

  for (const id of doc.order) {
    const p = doc.persons[id];
    const want: Extracted = { ...p, photoPath: p.photoId ? photoPath(p.photoId) : '' };
    const rec = indis.get(id);
    if (rec) {
      applyPerson(rec, want, extractPerson(rec, notes), notes);
    } else {
      const created: GedNode = { ...node('INDI'), xref: id };
      applyPerson(created, want, null, notes);
      newRecords.push(created);
      indis.set(id, created);
      touched.add(id);
    }
  }
  // Removed persons.
  for (const [xref, rec] of indis) {
    if (!doc.persons[xref]) {
      file.records = file.records.filter((r) => r !== rec);
      indis.delete(xref);
    }
  }
  // Families.
  for (const [xref, rec] of fams) {
    const f = doc.families[xref];
    const before = rec.children.filter((c) => ['HUSB', 'WIFE', 'CHIL'].includes(c.tag)).map((c) => ptr(c.value) ?? '');
    if (!f) {
      before.forEach((x) => touched.add(x));
      file.records = file.records.filter((r) => r !== rec);
      continue;
    }
    const want = familyPointers(doc, f);
    const beforeSet = new Set(before);
    const changed = want.length !== before.length || want.some((w) => !beforeSet.has(w.xref));
    if (changed) {
      before.forEach((x) => touched.add(x));
      want.forEach((w) => touched.add(w.xref));
    }
    reconcilePointers(rec, ['HUSB', 'WIFE', 'CHIL'], want);
  }
  for (const fid of doc.familyOrder) {
    if (fams.has(fid)) continue;
    const f = doc.families[fid];
    const rec: GedNode = { ...node('FAM'), xref: fid };
    reconcilePointers(rec, ['HUSB', 'WIFE', 'CHIL'], familyPointers(doc, f));
    newRecords.push(rec);
    [...f.partners, ...f.children].forEach((x) => touched.add(x));
  }
  // FAMC/FAMS for touched persons only, so untouched records stay byte-identical.
  for (const id of touched) {
    const rec = indis.get(id);
    if (!rec || !doc.persons[id]) continue;
    const want: { tag: string; xref: string }[] = [];
    for (const fid of doc.familyOrder) if (doc.families[fid].children.includes(id)) want.push({ tag: 'FAMC', xref: fid });
    for (const fid of doc.familyOrder) if (doc.families[fid].partners.includes(id)) want.push({ tag: 'FAMS', xref: fid });
    reconcilePointers(rec, ['FAMC', 'FAMS'], want);
  }
  if (newRecords.length) {
    const trlr = file.records.findIndex((r) => r.tag === 'TRLR');
    const at = trlr >= 0 ? trlr : file.records.length;
    const sorted = [...newRecords.filter((r) => r.tag === 'INDI'), ...newRecords.filter((r) => r.tag === 'FAM')];
    file.records.splice(at, 0, ...sorted);
  }
  return serializeGedcom(file);
}

export { parseGedcomText, serializeGedcom };
