/**
 * Lossless GEDCOM line tree.
 *
 * Every parsed line keeps its exact source text in `raw`. Serialization writes `raw`
 * for untouched nodes and regenerates only nodes whose `raw` was cleared by an edit,
 * so a file that is parsed and written without edits is byte-identical (BOM, line
 * endings, odd spacing and unknown/vendor tags included).
 */
export interface GedNode {
  level: number;
  xref?: string; // without @
  tag: string;
  value: string;
  children: GedNode[];
  /** Exact source line; undefined for new or edited nodes. */
  raw?: string;
  /** Exact terminator that followed the source line (files may mix CRLF with stray LF). */
  eol?: string;
}

export interface GedFile {
  bom: boolean;
  eol: string;
  /** Whether the source ended with a line terminator. */
  finalEol: boolean;
  /** Top-level records in file order (HEAD … TRLR); unparseable lines become opaque nodes. */
  records: GedNode[];
}

const LINE_RE = /^\s*(\d+)\s+(?:@([^@]+)@\s+)?(\S+)(?: (.*))?$/;

export function parseGedcomText(text: string): GedFile {
  let bom = false;
  if (text.charCodeAt(0) === 0xfeff) {
    bom = true;
    text = text.slice(1);
  }
  const eolMatch = /\r\n|\n|\r/.exec(text);
  const eol = eolMatch ? eolMatch[0] : '\r\n';
  const lines: { raw: string; eol: string }[] = [];
  const splitter = /\r\n|\n|\r/g;
  let last = 0;
  for (let m = splitter.exec(text); m; m = splitter.exec(text)) {
    lines.push({ raw: text.slice(last, m.index), eol: m[0] });
    last = m.index + m[0].length;
  }
  const finalEol = last === text.length && lines.length > 0;
  if (!finalEol) lines.push({ raw: text.slice(last), eol: '' });
  const records: GedNode[] = [];
  const stack: GedNode[] = [];
  for (const { raw, eol: lineEol } of lines) {
    const m = LINE_RE.exec(raw);
    if (!m) {
      // Opaque line (blank, or a bare level number): keep it in place, attached to the current record.
      const opaque: GedNode = { level: -1, tag: '', value: '', children: [], raw, eol: lineEol };
      if (stack.length) stack[stack.length - 1].children.push(opaque);
      else records.push(opaque);
      continue;
    }
    const node: GedNode = {
      level: +m[1],
      xref: m[2],
      tag: m[3],
      value: m[4] ?? '',
      children: [],
      raw,
      eol: lineEol,
    };
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    if (stack.length === 0 || node.level === 0) {
      records.push(node);
      stack.length = 0;
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return { bom, eol, finalEol, records };
}

function formatLine(n: GedNode): string {
  const parts = [String(n.level)];
  if (n.xref) parts.push(`@${n.xref}@`);
  parts.push(n.tag);
  let line = parts.join(' ');
  if (n.value !== '') line += ` ${n.value}`;
  return line;
}

export function serializeGedcom(file: GedFile): string {
  const out: { text: string; eol?: string }[] = [];
  const walk = (n: GedNode, level: number) => {
    if (n.level === -1) {
      out.push({ text: n.raw ?? '', eol: n.eol });
      return;
    }
    if (n.raw === undefined || n.level !== level) {
      n.level = level;
      out.push({ text: formatLine(n) });
    } else {
      out.push({ text: n.raw, eol: n.eol });
    }
    for (const c of n.children) walk(c, level + 1);
  };
  for (const r of file.records) walk(r, r.level === -1 ? -1 : 0);
  let s = file.bom ? '﻿' : '';
  out.forEach((line, i) => {
    s += line.text;
    const isLast = i === out.length - 1;
    if (!isLast) s += line.eol || file.eol;
    else if (file.finalEol) s += line.eol || file.eol;
  });
  return s;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function child(n: GedNode | undefined, tag: string): GedNode | undefined {
  return n?.children.find((c) => c.tag === tag);
}

export function childrenTagged(n: GedNode | undefined, tag: string): GedNode[] {
  return n ? n.children.filter((c) => c.tag === tag) : [];
}

export function node(tag: string, value = '', children: GedNode[] = []): GedNode {
  return { level: 0, tag, value, children };
}

/** Reads a value with its CONT/CONC continuation lines. */
export function readText(n: GedNode | undefined): string {
  if (!n) return '';
  let s = n.value;
  for (const c of n.children) {
    if (c.tag === 'CONT') s += '\n' + c.value;
    else if (c.tag === 'CONC') s += c.value;
  }
  return s;
}

const MAX_LINE_VALUE = 200;

/** Writes multi-line text into a node as value + CONT/CONC children, keeping other children. */
export function writeText(n: GedNode, text: string) {
  const others = n.children.filter((c) => c.tag !== 'CONT' && c.tag !== 'CONC');
  const cont: GedNode[] = [];
  const lines = text.split(/\r\n|\n|\r/);
  let first = true;
  for (const line of lines) {
    const chunks: string[] = [];
    let rest = line;
    while (rest.length > MAX_LINE_VALUE) {
      // Avoid splitting before/after a space, which GEDCOM readers may trim.
      let cut = MAX_LINE_VALUE;
      while (cut > 1 && (rest[cut] === ' ' || rest[cut - 1] === ' ')) cut--;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    chunks.push(rest);
    chunks.forEach((chunk, i) => {
      if (first) {
        n.value = chunk;
        first = false;
      } else {
        cont.push(node(i === 0 ? 'CONT' : 'CONC', chunk));
      }
    });
  }
  n.raw = undefined;
  n.children = [...cont, ...others];
}

export function setValue(n: GedNode, value: string) {
  if (n.value !== value) {
    n.value = value;
    n.raw = undefined;
  }
}

/** Gets or creates a child with the tag; new children are inserted after `after` tags when given. */
export function ensureChild(parent: GedNode, tag: string, insertAfterTags: string[] = []): GedNode {
  const existing = child(parent, tag);
  if (existing) return existing;
  const created = node(tag);
  let idx = -1;
  parent.children.forEach((c, i) => {
    if (insertAfterTags.includes(c.tag)) idx = i;
  });
  parent.children.splice(idx + 1, 0, created);
  return created;
}

export function removeChild(parent: GedNode, target: GedNode) {
  parent.children = parent.children.filter((c) => c !== target);
}
