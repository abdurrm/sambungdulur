import type { Theme } from './types';
import { contrast } from '../theme/color';
import { TOKENS } from '../theme/tokens';

/**
 * Canvas background, stored per tree (in the tree settings, so it follows autosave, undo and the
 * .sambung file). `grid` is the default. Ready-made solid colours are stored by preset id so they
 * switch to their dark variant in the dark theme; a custom colour stays as picked.
 */
export type SolidPreset = 'paper' | 'cream' | 'sogan' | 'nila' | 'leaf' | 'sky' | 'stone' | 'night';

export type CanvasBackground =
  | { kind: 'grid' }
  | { kind: 'solid'; preset: SolidPreset }
  | { kind: 'solid'; custom: string };

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

/** What the renderer draws: a colour, with or without the grid on top. */
export interface Backdrop {
  kind: CanvasBackground['kind'];
  color: string;
  grid: boolean;
}

export function resolveBackdrop(bg: CanvasBackground | undefined, theme: Theme): Backdrop {
  if (!bg || bg.kind === 'grid') return { kind: 'grid', color: TOKENS[theme].bg, grid: true };
  if ('preset' in bg) {
    const p = SOLID_PRESETS.find((x) => x.id === bg.preset) ?? SOLID_PRESETS[0];
    return { kind: 'solid', color: p[theme], grid: false };
  }
  return { kind: 'solid', color: /^#[0-9a-f]{6}$/i.test(bg.custom) ? bg.custom.toLowerCase() : TOKENS[theme].bg, grid: false };
}

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
