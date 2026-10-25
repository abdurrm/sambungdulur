import type { Theme } from '../model/types';

/**
 * "Nila & Sogan" colour tokens: the single source for every colour in the app.
 *
 * Nila (indigo, the natural batik dye) is the primary colour: primary buttons, the active choice,
 * lineage highlight and focus rings. Sogan (the golden brown of Solo/Yogya batik) is the accent,
 * used sparingly for what needs attention: search matches and the "unsaved" badge. Neutrals are
 * warm stone. Danger stays red.
 *
 * Both the CSS custom properties of the interface (`cssVars`) and the canvas palette that is inlined
 * into the tree SVG for exports (`render/palette.ts`) are derived from this table, so the screen and
 * exported images can never drift apart.
 */
export interface ThemeTokens {
  /** Page and canvas background. */
  bg: string;
  /** Panels, popovers, dialogs and cards. */
  surface: string;
  /** Translucent panel (header, floating controls). */
  surfaceGlass: string;
  border: string;
  hover: string;
  inputBg: string;
  text: string;
  muted: string;
  dim: string;
  /** Nila: primary buttons, active choices, lineage, focus ring. */
  primary: string;
  /** Primary filled buttons (needs 4.5:1 with `onPrimary`). */
  primaryStrong: string;
  /** Text and icons in primary colour on surfaces. */
  primaryText: string;
  primarySoft: string;
  primaryGlow: string;
  onPrimary: string;
  /** Sogan: search matches, "unsaved", attention. */
  accent: string;
  accentText: string;
  accentSoft: string;
  danger: string;
  dangerText: string;
  dangerSoft: string;
  /** Links and the manual-layout bar. */
  info: string;
  male: string;
  female: string;
  /** Third gender ring: teal and dashed, so it never reads as the indigo primary. */
  other: string;
  tint: { male: string; female: string; other: string };
  initials: { male: string; female: string; other: string };
  /** Canvas-only roles. */
  grid: string;
  gridMajor: string;
  card: string;
  cardStroke: string;
  cardFrame: string;
  edge: string;
  edgeFar: string;
  /** Backdrop behind modal dialogs. */
  scrim: string;
  shadow: string;
  shadowColor: string;
  /** Browser / installed-app status bar colour. */
  bar: string;
}

export const TOKENS: Record<Theme, ThemeTokens> = {
  light: {
    bg: '#fafaf9',
    surface: '#ffffff',
    surfaceGlass: 'rgba(255, 255, 255, 0.94)',
    border: '#e7e5e4',
    hover: '#f5f5f4',
    inputBg: '#ffffff',
    text: '#1c1917',
    muted: '#57534e',
    dim: '#78716c',
    primary: '#4338ca',
    primaryStrong: '#3730a3',
    primaryText: '#4338ca',
    primarySoft: 'rgba(67, 56, 202, 0.09)',
    primaryGlow: 'rgba(67, 56, 202, 0.26)',
    onPrimary: '#ffffff',
    accent: '#b45309',
    accentText: '#b45309',
    accentSoft: 'rgba(217, 119, 6, 0.22)',
    danger: '#e11d48',
    dangerText: '#be123c',
    dangerSoft: 'rgba(225, 29, 72, 0.08)',
    info: '#0e7490',
    male: '#0284c7',
    female: '#db2777',
    other: '#0d9488',
    tint: { male: 'rgba(14, 165, 233, 0.14)', female: 'rgba(236, 72, 153, 0.14)', other: 'rgba(20, 184, 166, 0.16)' },
    initials: { male: '#0369a1', female: '#be185d', other: '#0f766e' },
    grid: '#efedeb',
    gridMajor: '#e4e1de',
    card: '#ffffff',
    cardStroke: '#d6d3d1',
    cardFrame: '#a8a29e',
    edge: '#8a817c',
    edgeFar: '#8a817c',
    scrim: 'rgba(28, 25, 23, 0.45)',
    shadow: '0 10px 30px rgba(28, 25, 23, 0.08), 0 1px 3px rgba(28, 25, 23, 0.06)',
    shadowColor: 'rgba(28, 25, 23, 0.14)',
    bar: '#4338ca',
  },
  dark: {
    bg: '#0c0a09',
    surface: '#1c1917',
    surfaceGlass: 'rgba(28, 25, 23, 0.9)',
    border: '#292524',
    hover: '#292524',
    inputBg: '#141211',
    text: '#e7e5e4',
    muted: '#d6d3d1',
    dim: '#a8a29e',
    primary: '#a5b4fc',
    primaryStrong: '#a5b4fc',
    primaryText: '#a5b4fc',
    primarySoft: 'rgba(165, 180, 252, 0.13)',
    primaryGlow: 'rgba(165, 180, 252, 0.34)',
    onPrimary: '#1e1b4b',
    accent: '#fbbf24',
    accentText: '#fbbf24',
    accentSoft: 'rgba(251, 191, 36, 0.24)',
    danger: '#fb7185',
    dangerText: '#fda4af',
    dangerSoft: 'rgba(251, 113, 133, 0.1)',
    info: '#22d3ee',
    male: '#38bdf8',
    female: '#f472b6',
    other: '#2dd4bf',
    tint: { male: 'rgba(56, 189, 248, 0.16)', female: 'rgba(244, 114, 182, 0.16)', other: 'rgba(45, 212, 191, 0.16)' },
    initials: { male: '#7dd3fc', female: '#f9a8d4', other: '#5eead4' },
    grid: '#1a1715',
    gridMajor: '#262220',
    card: 'rgba(28, 25, 23, 0.92)',
    cardStroke: '#44403c',
    cardFrame: '#78716c',
    edge: '#857c76',
    edgeFar: '#857c76',
    scrim: 'rgba(0, 0, 0, 0.55)',
    shadow: '0 12px 34px rgba(0, 0, 0, 0.45)',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    bar: '#1e1b4b',
  },
};

/** CSS custom properties of the interface, derived from the tokens. */
export function cssVars(theme: Theme): Record<string, string> {
  const k = TOKENS[theme];
  return {
    '--bg': k.bg,
    '--panel': k.surfaceGlass,
    '--panel-solid': k.surface,
    '--panel-border': k.border,
    '--text': k.text,
    '--muted': k.muted,
    '--dim': k.dim,
    '--accent': k.primary,
    '--accent-soft': k.primarySoft,
    '--accent-text': k.primaryText,
    '--accent-strong': k.primaryStrong,
    '--on-accent': k.onPrimary,
    '--sogan': k.accent,
    '--sogan-text': k.accentText,
    '--sogan-soft': k.accentSoft,
    '--danger': k.danger,
    '--danger-text': k.dangerText,
    '--danger-soft': k.dangerSoft,
    '--info': k.info,
    '--male': k.male,
    '--female': k.female,
    '--other': k.other,
    '--shadow': k.shadow,
    '--shadow-color': k.shadowColor,
    '--scrim': k.scrim,
    '--input-bg': k.inputBg,
    '--hover': k.hover,
  };
}

/** Stylesheet text for both themes (`html[data-theme=…]`). */
export function themeCss(): string {
  return (Object.keys(TOKENS) as Theme[])
    .map((th) => {
      const vars = Object.entries(cssVars(th)).map(([n, v]) => `${n}:${v}`).join(';');
      return `html[data-theme='${th}']{${vars};color-scheme:${th}}`;
    })
    .join('\n');
}

/** Installs the theme stylesheet once, before the first render. */
export function installThemeCss() {
  if (typeof document === 'undefined' || document.getElementById('theme-tokens')) return;
  const style = document.createElement('style');
  style.id = 'theme-tokens';
  style.textContent = themeCss();
  document.head.prepend(style);
}
