import { DEFAULT_BACKGROUND, type CanvasBackground } from './background';

export type Gender = 'male' | 'female' | 'other';

/** Editable attributes of a person. Dates are stored as GEDCOM date values ("4 JUL 1994", "1995", "ABT 1950"). */
export interface PersonFields {
  givenName: string;
  surnameNow: string;
  surnameAtBirth: string;
  gender: Gender;
  birthDate: string;
  birthPlace: string;
  deceased: boolean;
  deathDate: string;
  profession: string;
  /** Free text shown as "Interesting facts" / biography. */
  facts: string;
  /** Media id of the primary photo, or '' for none. */
  photoId: string;
}

export interface Person extends PersonFields {
  id: string;
}

export interface Family {
  id: string;
  /** Zero, one or two partners. Order is preserved for GEDCOM HUSB/WIFE. */
  partners: string[];
  children: string[];
}

export type DateFormat = 'MM/DD/YYYY' | 'MM.DD.YYYY' | 'DD/MM/YYYY' | 'DD.MM.YYYY' | 'YYYY';
export type FontSize = 'small' | 'normal' | 'large';
export type SurnameMode = 'surnameNow' | 'surnameAtBirth';
export type RectStyle = 'plain' | 'framed';
export type Theme = 'light' | 'dark';

export interface TreeSettings {
  dateFormat: DateFormat;
  fontSize: FontSize;
  surname: SurnameMode;
  rectStyle: RectStyle;
  showDob: boolean;
  showDod: boolean;
  showCountryOfBirth: boolean;
  showProfession: boolean;
  showInterestingFacts: boolean;
  showImage: boolean;
  /** Generations of ancestors shown above the focus person (-1 = all). */
  ancestorGenerations: number;
  /** Generations of descendants shown below the focus person (-1 = all). */
  descendantGenerations: number;
  theme: Theme;
  traceAnimation: boolean;
  /** Canvas background (kept with the tree and in .sambung files; older files get the grid). */
  background: CanvasBackground;
}

export interface MediaItem {
  id: string;
  fileName: string;
  mime: string;
  /** Path as written in the source file (e.g. GEDCOM OBJE FILE). */
  sourcePath: string;
  /** True when bytes are available in the media store. */
  available: boolean;
  /** The canvas background picture (not a person's photo): left out of GEDCOM exports. */
  background?: true;
}

/** Manual layout adjustments, relative to the automatic layout so they survive re-layout. */
export interface ManualLayout {
  personDx: Record<string, number>;
  familyDy: Record<string, number>;
}

export interface TreeDoc {
  title: string;
  persons: Record<string, Person>;
  families: Record<string, Family>;
  /** Insertion order of persons (GEDCOM record order for imports). */
  order: string[];
  familyOrder: string[];
  focusId: string;
  settings: TreeSettings;
  manual: ManualLayout;
  media: Record<string, MediaItem>;
  /** Original GEDCOM text when the tree was imported from GEDCOM; used for lossless export. */
  gedcomSource?: string;
  /** Where the tree came from, for UI/reporting. */
  origin: 'default' | 'gedcom' | 'ftb' | 'sambung' | 'new';
  /** Collapsed branches (UI state persisted with the tree). */
  collapsed: Record<string, 'descendants' | 'ancestors' | 'both'>;
  /** Additional (non-primary) photos per person, read-only; kept verbatim in GEDCOM export. */
  gallery: Record<string, string[]>;
  /** Cards whose detail rows are collapsed. */
  compactCards: Record<string, true>;
}

export const DEFAULT_SETTINGS: TreeSettings = {
  dateFormat: 'MM/DD/YYYY',
  fontSize: 'normal',
  surname: 'surnameNow',
  rectStyle: 'plain',
  showDob: true,
  showDod: true,
  showCountryOfBirth: true,
  showProfession: false,
  showInterestingFacts: true,
  showImage: true,
  ancestorGenerations: 3,
  descendantGenerations: 3,
  theme: 'light',
  traceAnimation: false,
  background: DEFAULT_BACKGROUND,
};

export function emptyFields(): PersonFields {
  return {
    givenName: '',
    surnameNow: '',
    surnameAtBirth: '',
    gender: 'male',
    birthDate: '',
    birthPlace: '',
    deceased: false,
    deathDate: '',
    profession: '',
    facts: '',
    photoId: '',
  };
}
