import type { FontSize, Person, TreeSettings } from '../model/types';
import { formatDate } from '../model/dates';
import { displayName } from '../model/relations';
import { t } from '../i18n';

/** Visual density used by the canvas (from settings) and by PNG export presets. */
export type Density = 'compact' | 'normal' | 'detailed';

export interface CardStyle {
  width: number;
  pad: number;
  photo: number;
  nameSize: number;
  metaSize: number;
  lineGap: number;
  nameLines: number;
  factLines: number;
}

const BASE: Record<FontSize, CardStyle> = {
  small: { width: 176, pad: 12, photo: 52, nameSize: 13, metaSize: 10.5, lineGap: 1.35, nameLines: 2, factLines: 3 },
  normal: { width: 212, pad: 14, photo: 64, nameSize: 15, metaSize: 11.5, lineGap: 1.35, nameLines: 2, factLines: 3 },
  large: { width: 272, pad: 16, photo: 84, nameSize: 20, metaSize: 15, lineGap: 1.3, nameLines: 2, factLines: 0 },
};

export function cardStyle(settings: TreeSettings, density: Density = 'normal'): CardStyle {
  const s = { ...BASE[settings.fontSize] };
  if (density === 'compact') {
    s.width = Math.round(s.width * 0.8);
    s.photo = Math.round(s.photo * 0.7);
    s.factLines = 0;
  } else if (density === 'detailed') {
    s.width = Math.round(s.width * 1.2);
    s.factLines = settings.fontSize === 'large' ? 2 : 6;
  }
  return s;
}

/** Which rows a card shows. "Large" disables profession and facts, as observed on the original. */
export function visibleRows(settings: TreeSettings, density: Density = 'normal') {
  const large = settings.fontSize === 'large';
  if (density === 'compact') {
    return { image: settings.showImage, dates: settings.showDob || settings.showDod, country: false, profession: false, facts: false };
  }
  if (density === 'detailed') {
    return { image: true, dates: true, country: true, profession: true, facts: true };
  }
  return {
    image: settings.showImage,
    dates: settings.showDob || settings.showDod,
    country: settings.showCountryOfBirth,
    profession: settings.showProfession && !large,
    facts: settings.showInterestingFacts && !large,
  };
}

/** Greedy word wrap using an average glyph width estimate (no DOM needed, works in export). */
export function wrapText(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  if (!text || maxLines <= 0) return [];
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * 0.55)));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > maxChars) {
        if (line) {
          out.push(line);
          line = '';
        }
        out.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      if (!line) line = w;
      else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    const lastLine = kept[maxLines - 1];
    kept[maxLines - 1] = (lastLine.length >= maxChars ? lastLine.slice(0, maxChars - 1) : lastLine) + '…';
    return kept;
  }
  return out;
}

export interface CardContent {
  nameLines: string[];
  dateLine: string;
  countryLines: string[];
  professionLines: string[];
  factLines: string[];
  showPhoto: boolean;
  height: number;
}

export function datesText(p: Person, settings: TreeSettings, density: Density = 'normal'): string {
  const rows = density === 'normal' ? { dob: settings.showDob, dod: settings.showDod } : { dob: true, dod: true };
  const b = rows.dob ? formatDate(p.birthDate, settings.dateFormat) : '';
  const d = rows.dod && p.deceased ? formatDate(p.deathDate, settings.dateFormat) || '?' : '';
  if (b && d) return `${b} – ${d}`;
  if (b) return `${t('bornAbbr')} ${b}`;
  if (d) return `${t('diedAbbr')} ${d}`;
  return '';
}

export function cardContent(p: Person, settings: TreeSettings, density: Density, compactCard: boolean): CardContent {
  const st = cardStyle(settings, density);
  const rows = visibleRows(settings, density);
  const inner = st.width - st.pad * 2;
  const nameLines = wrapText(displayName(p, settings), inner, st.nameSize, st.nameLines);
  const lh = (sz: number) => Math.round(sz * st.lineGap);
  const dateLine = rows.dates ? datesText(p, settings, density) : '';
  const brief = compactCard;
  const countryLines = rows.country && !brief ? wrapText(p.birthPlace, inner, st.metaSize, 2) : [];
  const professionLines = rows.profession && !brief ? wrapText(p.profession, inner, st.metaSize, 2) : [];
  const factLines = rows.facts && !brief ? wrapText(p.facts, inner, st.metaSize, st.factLines) : [];
  const showPhoto = rows.image;
  let h = st.pad;
  if (showPhoto) h += st.photo + 10;
  h += nameLines.length * lh(st.nameSize);
  if (dateLine) h += lh(st.metaSize) + 2;
  if (countryLines.length) h += countryLines.length * lh(st.metaSize) + 2;
  if (professionLines.length) h += professionLines.length * lh(st.metaSize) + 2;
  if (factLines.length) h += factLines.length * lh(st.metaSize) + 8;
  h += st.pad;
  return { nameLines, dateLine, countryLines, professionLines, factLines, showPhoto, height: Math.max(h, 56) };
}
