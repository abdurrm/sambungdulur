import type { PersonFields } from '../model/types';
import { buildGedcomDate } from '../model/dates';

export interface KkToken { text: string; x: number; y: number; w: number; h: number }
export interface KkRow {
  key: string; page: number; row: number; fields: Partial<PersonFields>;
  fatherName: string; motherName: string; referenceOnly?: boolean;
  householdRole?: string;
}
export const normalizeName = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
const clean = (s: string) => s.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim();
const name = (s: string) => clean(s).replace(/^\d+[.\s]+/, '').replace(/^-+$/, '');
const join = (tokens: KkToken[]) => clean(tokens.sort((a, b) => a.x - b.x).map((t) => t.text).join(' '));

function linesOf(tokens: KkToken[]): KkToken[][] {
  const lines: KkToken[][] = [];
  for (const token of [...tokens].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines.find((l) => Math.abs(l[0].y - token.y) < Math.max(.003, Math.min(l[0].h, token.h) * .55));
    if (line) line.push(token); else lines.push([token]);
  }
  return lines.map((line) => {
    const out: KkToken[] = [];
    for (const token of line.sort((a,b) => a.x-b.x)) {
      const prev = out[out.length-1];
      // OCR often splits a NIK into two eight-digit words. Preserve the read digits for review.
      if (prev && /^\d{4,}$/.test(prev.text) && /^\d{4,}$/.test(token.text) && token.x-prev.x-prev.w < .018 && token.x < .5)
        out[out.length-1] = { ...prev, text: prev.text+token.text, w: token.x+token.w-prev.x };
      else out.push(token);
    }
    return out;
  });
}

/** Geometry joins the two KK tables by their row number, not OCR reading order. Coordinates are normalized. */
export function parseKkTokens(tokens: KkToken[], page: number): KkRow[] {
  const lines = linesOf(tokens);
  const result: KkRow[] = [];
  const dateRe = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/;
  const fatherHeader = tokens.find((t) => /^AYAH$/i.test(t.text.trim()));
  const motherHeader = tokens.find((t) => /^IBU$/i.test(t.text.trim()) && (!fatherHeader || Math.abs(t.y - fatherHeader.y) < .03));
  const parentY = fatherHeader?.y ?? .5;
  const nikHeader = tokens.find((t) => /^NIK$/i.test(t.text.trim()));
  for (const line of lines) {
    if (line[0].y >= parentY) continue;
    const nik = line.find((t) => /^\d{12,18}$/.test(t.text.replace(/\s/g, '')));
    if (!nik || nik.x < .15 || nik.x > .5) continue;
    if (nikHeader && nik.y <= nikHeader.y) continue;
    const before = line.filter((t) => t.x < nik.x - .004);
    const no = before.find((t) => t.x < .055 && /^\d{1,2}\.?$/.test(t.text.trim()));
    if (!no && !line.some((t) => dateRe.test(t.text))) continue;
    const row = no ? Number(no.text.replace(/\D/g, '')) : result.length + 1;
    const givenName = name(join(before.filter((t) => t !== no && t.x > .025)));
    if (!givenName) continue;
    const dateToken = line.find((t) => dateRe.test(t.text));
    const date = dateToken?.text.match(dateRe);
    const genderTokens = line.filter((t) => t.x > nik.x + .03 && (!dateToken || t.x < dateToken.x));
    const genderText = join(genderTokens);
    const gender = /PEREMPUAN/i.test(genderText) ? 'female' : /LAKI/i.test(genderText) ? 'male' : undefined;
    const genderEnd = genderTokens.find((t) => /PEREMPUAN|LAKI/i.test(t.text));
    const birthPlace = dateToken && genderEnd ? join(line.filter((t) => t.x > genderEnd.x + genderEnd.w + .003 && t.x < dateToken.x - .003)) : '';
    const fields: Partial<PersonFields> = { givenName, nik: nik.text.replace(/\s/g, '') };
    if (gender) fields.gender = gender;
    if (date) fields.birthDate = buildGedcomDate({ day: +date[1], month: +date[2], year: +date[3] });
    if (birthPlace) fields.birthPlace = birthPlace;
    // Column headers vary by KK edition. Locate their positions instead of fixing column numbers.
    for (const [field, re] of [['profession', /PEKERJAAN/i], ['religion', /^AGAMA$/i], ['education', /PENDIDIKAN/i]] as const) {
      const header = tokens.find((t) => re.test(t.text) && t.y < nik.y && t.y > .1);
      if (!header) continue;
      const x = header.x - .015;
      const end = field === 'religion' ? x + .085 : field === 'education' ? x + .17 : .96;
      const value = join(line.filter((t) => t.x >= x && t.x < end));
      if (value) fields[field] = value;
    }
    result.push({ key: `${page}:${row}`, page, row, fields, fatherName: '', motherName: '' });
  }
  if (fatherHeader && motherHeader) {
    const delta = motherHeader.x - fatherHeader.x;
    const fatherStart = fatherHeader.x - delta * .55;
    const motherStart = (fatherHeader.x + motherHeader.x) / 2;
    let nextRow = 1;
    for (const line of lines) {
      if (line[0].y <= parentY + .004) continue;
      const no = line.find((t) => t.x < .055 && /^\d{1,2}\.?$/.test(t.text.trim()));
      const fatherName = name(join(line.filter((t) => t.x >= fatherStart && t.x < motherStart)));
      const motherName = name(join(line.filter((t) => t.x >= motherStart)));
      if (!/[\p{L}]/u.test(fatherName + motherName)) continue;
      if (line[0].y > parentY + .26) continue;
      const rowNumber = no ? Number(no.text.replace(/\D/g, '')) : nextRow;
      const record = result.find((r) => r.row === rowNumber);
      if (!record) continue;
      record.fatherName = fatherName;
      record.motherName = motherName;
      const role = join(line.filter((t) => t.x < fatherStart)).match(/KEPALA\s*KELUARGA|ISTRI|SUAMI|ANAK|MENANTU|CUCU|ORANG\s*TUA/i)?.[0];
      if (role) record.householdRole = role.toUpperCase();
      nextRow = rowNumber + 1;
      const nationality = line.find((t) => /^(WNI|WNA)$/i.test(t.text.trim()));
      if (nationality) record.fields.nationality = nationality.text.toUpperCase();
    }
  }
  return result;
}

/** Parent-only mentions share a draft, but are never silently created or equated to an existing person. */
export function withParentReferences(rows: KkRow[]): KkRow[] {
  const result = rows.filter((r) => !r.referenceOnly).map((r) => ({ ...r, fields: { ...r.fields } }));
  for (const row of [...result]) for (const [value, gender] of [[row.fatherName, 'male'], [row.motherName, 'female']] as const) {
    if (!normalizeName(value) || result.some((r) => normalizeName(r.fields.givenName ?? '') === normalizeName(value))) continue;
    result.push({ key: `parent:${normalizeName(value)}`, page: row.page, row: row.row, fields: { givenName: value, gender }, fatherName: '', motherName: '', referenceOnly: true });
  }
  return result;
}
