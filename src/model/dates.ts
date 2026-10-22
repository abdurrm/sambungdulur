import type { DateFormat } from './types';
import { getLang, MONTHS_BY_LANG, type Lang } from '../i18n';

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface SimpleDate {
  day?: number;
  month?: number; // 1-12
  year?: number;
}

/**
 * Parses a plain GEDCOM date ("4 JUL 1994", "JUL 1994", "1994").
 * Returns null for qualified or ranged dates ("ABT 1950", "BET 1900 AND 1910"),
 * which are kept verbatim and never rewritten unless the user edits them.
 */
export function parseSimpleDate(value: string): SimpleDate | null {
  const v = value.trim().toUpperCase();
  if (!v) return {};
  let m = /^(\d{1,2}) ([A-Z]{3}) (\d{1,4})$/.exec(v);
  if (m) {
    const month = MONTHS.indexOf(m[2]) + 1;
    if (month > 0) return { day: +m[1], month, year: +m[3] };
  }
  m = /^([A-Z]{3}) (\d{1,4})$/.exec(v);
  if (m) {
    const month = MONTHS.indexOf(m[1]) + 1;
    if (month > 0) return { month, year: +m[2] };
  }
  m = /^(\d{1,4})$/.exec(v);
  if (m) return { year: +m[1] };
  return null;
}

export function buildGedcomDate(d: SimpleDate): string {
  const parts: string[] = [];
  if (d.year && d.month && d.day) parts.push(String(d.day));
  if (d.year && d.month) parts.push(MONTHS[d.month - 1]);
  if (d.year) parts.push(String(d.year));
  // A day/month without a year cannot be expressed as a GEDCOM date value.
  return parts.join(' ');
}

/** Converts an ISO timestamp (as used by family-tree-builder.com data) to a GEDCOM date. */
export function isoToGedcom(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return buildGedcomDate({ year: +m[1], month: +m[2], day: +m[3] });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a GEDCOM date for display according to the tree "Date Format" setting. */
export function formatDate(value: string, fmt: DateFormat): string {
  if (!value) return '';
  const d = parseSimpleDate(value);
  if (!d) return value.trim(); // qualified/ranged dates are shown verbatim
  if (!d.year) return '';
  if (fmt === 'YYYY' || !d.month) return String(d.year);
  const sep = fmt.includes('.') ? '.' : '/';
  if (!d.day) {
    return `${pad(d.month)}${sep}${d.year}`;
  }
  return fmt.startsWith('MM')
    ? `${pad(d.month)}${sep}${pad(d.day)}${sep}${d.year}`
    : `${pad(d.day)}${sep}${pad(d.month)}${sep}${d.year}`;
}

/** Year of a GEDCOM date, including qualified forms ("ABT 1950" -> 1950). */
export function yearOf(value: string): number | undefined {
  const m = /(\d{3,4})(?!.*\d{3,4})/.exec(value);
  return m ? +m[1] : undefined;
}

const QUALIFIERS: Record<Lang, Record<string, string>> = {
  en: { ABT: 'about', BEF: 'before', AFT: 'after', EST: 'estimated', CAL: 'calculated', BET: 'between', AND: 'and', FROM: 'from', TO: 'to' },
  id: { ABT: 'sekitar', BEF: 'sebelum', AFT: 'sesudah', EST: 'perkiraan', CAL: 'dihitung', BET: 'antara', AND: 'dan', FROM: 'dari', TO: 'sampai' },
  jv: { ABT: 'kira-kira', BEF: 'sadurungé', AFT: 'sawisé', EST: 'prakiraan', CAL: 'diétung', BET: 'antarané', AND: 'lan', FROM: 'saka', TO: 'nganti' },
};

/** Long human form used in text exports, in the UI language: "4 Juli 1994", "sekitar 1950". */
export function formatDateLong(value: string): string {
  if (!value) return '';
  const lang = getLang();
  const months = MONTHS_BY_LANG[lang];
  const d = parseSimpleDate(value);
  if (!d) {
    return value
      .replace(/\b(ABT|BEF|AFT|EST|CAL|BET|AND|FROM|TO)\b/gi, (q) => QUALIFIERS[lang][q.toUpperCase()])
      .replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/gi, (mm) => months[MONTHS.indexOf(mm.toUpperCase())]);
  }
  if (!d.year) return '';
  if (!d.month) return String(d.year);
  if (!d.day) return `${months[d.month - 1]} ${d.year}`;
  return `${d.day} ${months[d.month - 1]} ${d.year}`;
}
