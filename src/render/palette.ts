import type { Gender, Theme } from '../model/types';
import { TOKENS } from '../theme/tokens';
import { contrast } from '../theme/color';
import { inkColor, inkFor, type Backdrop } from '../model/background';

/**
 * Canvas palette: warm stone canvas with a fine grid, crisp cards, monospace metadata, and the Nila
 * primary colour for focus and lineage tracing. Derived from the same tokens as the interface CSS
 * (theme/tokens.ts) and inlined into the SVG, so exports render identically outside the app.
 */
export interface Palette {
  bg: string;
  grid: string;
  gridMajor: string;
  card: string;
  cardStroke: string;
  cardFrame: string;
  text: string;
  muted: string;
  dim: string;
  edge: string;
  edgeFar: string;
  emphasis: string;
  emphasisGlow: string;
  match: string;
  ring: Record<Gender, string>;
  tint: Record<Gender, string>;
  initials: Record<Gender, string>;
  handle: string;
  /** Text on a filled `handle` (manual-layout move handle). */
  onHandle: string;
  shadow: string;
  /** Text drawn straight on the canvas (export legend). */
  caption: string;
}

function paletteFor(theme: Theme): Palette {
  const k = TOKENS[theme];
  return {
    bg: k.bg,
    grid: k.grid,
    gridMajor: k.gridMajor,
    card: k.card,
    cardStroke: k.cardStroke,
    cardFrame: k.cardFrame,
    text: k.text,
    muted: k.muted,
    dim: k.dim,
    edge: k.edge,
    edgeFar: k.edgeFar,
    emphasis: k.primary,
    emphasisGlow: k.primaryGlow,
    match: k.accent,
    ring: { male: k.male, female: k.female, other: k.other },
    tint: { ...k.tint },
    initials: { ...k.initials },
    handle: k.primaryText,
    onHandle: k.onPrimary,
    shadow: k.shadowColor,
    caption: k.muted,
  };
}

export const PALETTES: Record<Theme, Palette> = { light: paletteFor('light'), dark: paletteFor('dark') };

/**
 * The theme palette on a given background: family lines, the lineage highlight and card shadows take
 * the light-theme or dark-theme variant, whichever stands out against the background (cards keep the
 * theme's own colours).
 */
export function paletteOn(theme: Theme, backdrop: Backdrop): Palette {
  const base = PALETTES[theme];
  const against = inkColor(backdrop);
  const dark = inkFor(against) === 'dark';
  const ink = PALETTES[dark ? 'light' : 'dark'];
  // Mid-tone backgrounds (a picture seen through its veil, a grey colour): step to a stronger shade of
  // the same ink until lines reach 3:1 and captions 4.5:1.
  const first = (min: number, shades: string[]) => shades.find((c) => contrast(c, against) >= min) ?? shades[shades.length - 1];
  const L = TOKENS.light, D = TOKENS.dark;
  const edge = first(3, dark ? [L.edge, L.muted, L.text] : [D.edge, D.dim, D.text]);
  return {
    ...base,
    bg: backdrop.color,
    edge,
    edgeFar: edge,
    emphasis: first(3, dark ? [L.primary, L.primaryStrong, '#1e1b4b'] : [D.primary, '#c7d2fe', '#e0e7ff']),
    emphasisGlow: ink.emphasisGlow,
    shadow: ink.shadow,
    caption: first(4.5, dark ? [L.muted, L.text] : [D.muted, D.text]),
  };
}

export const FONT_SANS = "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Liberation Mono', ui-monospace, monospace";
