import type { Gender, Theme } from '../model/types';
import { TOKENS } from '../theme/tokens';

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
  };
}

export const PALETTES: Record<Theme, Palette> = { light: paletteFor('light'), dark: paletteFor('dark') };

export const FONT_SANS = "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Liberation Mono', ui-monospace, monospace";
