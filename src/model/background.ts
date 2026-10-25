import type { Theme } from './types';
import { contrast, over, parseColor, toHex } from '../theme/color';
import { TOKENS } from '../theme/tokens';

/**
 * Canvas background, stored per tree (in the tree settings, so it follows autosave, undo and the
 * .sambung file). `grid` is the default. Ready-made solid colours are stored by preset id so they
 * switch to their dark variant in the dark theme; a custom colour stays as picked.
 */
export type SolidPreset = 'paper' | 'cream' | 'sogan' | 'nila' | 'leaf' | 'sky' | 'stone' | 'night';

export type TilePattern = 'dots' | 'diagonal' | 'hex' | 'kawung' | 'parang' | 'truntum';
export const TILE_PATTERNS: TilePattern[] = ['dots', 'diagonal', 'hex', 'kawung', 'parang', 'truntum'];
export type ImageFit = 'cover' | 'contain' | 'tile';

export interface ImageBackground {
  kind: 'image';
  /** Media id; the picture lives in the media store like person photos (and in .sambung files). */
  mediaId: string;
  /** Natural size of the stored (shrunk) picture. */
  width: number;
  height: number;
  /** Average colour of the picture, measured once from a 16 × 16 copy; picks the line variant. */
  average: string;
  fit: ImageFit;
  /** Theme-coloured veil over the picture, 0-90 %. */
  fade: number;
  /** Blur radius, 0-12 px. */
  blur: number;
  /** Stays put while the tree pans (true) or moves with it. */
  fixed: boolean;
}

export type CanvasBackground =
  | { kind: 'grid' }
  | { kind: 'solid'; preset: SolidPreset }
  | { kind: 'solid'; custom: string }
  | { kind: 'tiles'; pattern: TilePattern; scale: number; color?: string }
  | ImageBackground;

export const FADE_DEFAULT = 70;
export const TILE_SCALE = { min: 50, max: 200 };
/** Longest side of a stored background picture, and its JPEG quality. */
export const BACKGROUND_MAX_SIDE = 2560;
export const BACKGROUND_QUALITY = 0.85;

/** Default motif colour: a quiet step from the canvas colour, per theme. */
export const TILE_COLOR: Record<Theme, string> = { light: '#dcd7d2', dark: '#2e2926' };

export const DEFAULT_BACKGROUND: CanvasBackground = { kind: 'grid' };

/** Eight colours per theme that sit well with the Nila & Sogan palette. */
export const SOLID_PRESETS: { id: SolidPreset; light: string; dark: string }[] = [
  { id: 'paper', light: '#fafaf9', dark: '#0c0a09' },
  { id: 'cream', light: '#f6f0e6', dark: '#1a1612' },
  { id: 'sogan', light: '#f3e3cf', dark: '#26190e' },
  { id: 'nila', light: '#e8e9f8', dark: '#15142c' },
  { id: 'leaf', light: '#e5efe4', dark: '#0f1a12' },
  { id: 'sky', light: '#e2eef6', dark: '#0d1821' },
  { id: 'stone', light: '#e7e5e4', dark: '#292524' },
  { id: 'night', light: '#262262', dark: '#1e1b4b' },
];

/** What the renderer draws: a base colour, with the grid, a motif or a picture on top. */
export interface Backdrop {
  kind: CanvasBackground['kind'];
  /** Base colour (behind a motif, or the veil over a picture). */
  color: string;
  grid: boolean;
  /** The colour that lines are drawn against (picture + veil mixed), for the ink choice. */
  ink?: string;
  tiles?: { pattern: TilePattern; scale: number; color: string };
  image?: { url?: string; width: number; height: number; fit: ImageFit; fade: number; blur: number; fixed: boolean };
}

export function resolveBackdrop(bg: CanvasBackground | undefined, theme: Theme, mediaUrl?: (id: string) => string | undefined): Backdrop {
  if (!bg || bg.kind === 'grid') return { kind: 'grid', color: TOKENS[theme].bg, grid: true };
  if (bg.kind === 'tiles') {
    const scale = Math.min(TILE_SCALE.max, Math.max(TILE_SCALE.min, bg.scale || 100));
    return { kind: 'tiles', color: TOKENS[theme].bg, grid: false, tiles: { pattern: bg.pattern, scale, color: validHex(bg.color) ?? TILE_COLOR[theme] } };
  }
  if (bg.kind === 'image') {
    const veil = TOKENS[theme].bg;
    const fade = Math.min(90, Math.max(0, bg.fade));
    const seen = toHex(over({ ...parseColor(veil), a: fade / 100 }, validHex(bg.average) ?? veil));
    return {
      kind: 'image',
      color: veil,
      grid: false,
      ink: seen,
      image: { url: mediaUrl?.(bg.mediaId), width: bg.width, height: bg.height, fit: bg.fit, fade, blur: Math.min(12, Math.max(0, bg.blur)), fixed: bg.fixed },
    };
  }
  if ('preset' in bg) {
    const p = SOLID_PRESETS.find((x) => x.id === bg.preset) ?? SOLID_PRESETS[0];
    return { kind: 'solid', color: p[theme], grid: false };
  }
  return { kind: 'solid', color: validHex(bg.custom) ?? TOKENS[theme].bg, grid: false };
}

const validHex = (c: string | undefined) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : undefined);

/** The colour lines are drawn against. */
export const inkColor = (b: Backdrop) => b.ink ?? b.color;

/**
 * Lines, captions and shadows drawn straight on the canvas use the light-theme ("dark ink") or the
 * dark-theme ("light ink") variant, whichever stands out more against the background colour.
 */
export type Ink = 'dark' | 'light';
export function inkFor(color: string): Ink {
  return contrast(color, TOKENS.light.text) >= contrast(color, TOKENS.dark.text) ? 'dark' : 'light';
}

export function sameBackground(a: CanvasBackground | undefined, b: CanvasBackground | undefined): boolean {
  return JSON.stringify(a ?? DEFAULT_BACKGROUND) === JSON.stringify(b ?? DEFAULT_BACKGROUND);
}
