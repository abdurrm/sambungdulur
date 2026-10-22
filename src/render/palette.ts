import type { Gender, Theme } from '../model/types';

/**
 * Archify-inspired palette: slate canvas with a fine grid, translucent cards with crisp strokes,
 * monospace metadata, and a teal emphasis colour for focus/lineage tracing.
 * Colours are inlined into the SVG so exports render identically outside the app.
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
}

export const PALETTES: Record<Theme, Palette> = {
  light: {
    bg: '#f8fafc',
    grid: '#e8edf3',
    gridMajor: '#dbe3ec',
    card: '#ffffff',
    cardStroke: '#cbd5e1',
    cardFrame: '#94a3b8',
    text: '#0f172a',
    muted: '#475569',
    dim: '#64748b',
    edge: '#94a3b8',
    edgeFar: '#a78bfa',
    emphasis: '#059669',
    emphasisGlow: 'rgba(5,150,105,0.28)',
    match: '#f59e0b',
    ring: { male: '#0284c7', female: '#db2777', other: '#7c3aed' },
    tint: { male: 'rgba(14,165,233,0.14)', female: 'rgba(236,72,153,0.14)', other: 'rgba(139,92,246,0.14)' },
    initials: { male: '#0369a1', female: '#be185d', other: '#6d28d9' },
    handle: '#0891b2',
  },
  dark: {
    bg: '#020617',
    grid: '#0f1b2d',
    gridMajor: '#1e293b',
    card: 'rgba(15,23,42,0.92)',
    cardStroke: '#334155',
    cardFrame: '#64748b',
    text: '#f1f5f9',
    muted: '#cbd5e1',
    dim: '#94a3b8',
    edge: '#64748b',
    edgeFar: '#a78bfa',
    emphasis: '#34d399',
    emphasisGlow: 'rgba(52,211,153,0.35)',
    match: '#fbbf24',
    ring: { male: '#38bdf8', female: '#f472b6', other: '#a78bfa' },
    tint: { male: 'rgba(56,189,248,0.16)', female: 'rgba(244,114,182,0.16)', other: 'rgba(167,139,250,0.16)' },
    initials: { male: '#7dd3fc', female: '#f9a8d4', other: '#c4b5fd' },
    handle: '#22d3ee',
  },
};

export const FONT_SANS = "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Liberation Mono', ui-monospace, monospace";
