import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { inkFor, resolveBackdrop, SOLID_PRESETS } from '../../src/model/background';
import { paletteOn, PALETTES } from '../../src/render/palette';
import { contrast } from '../../src/theme/color';
import { buildSambung, parseSambung } from '../../src/io/sambungFile';
import { createDefaultTree } from '../../src/model/defaultTree';

describe('canvas background', () => {
  it('picks dark ink on light backgrounds and light ink on dark ones', () => {
    expect(inkFor('#ffffff')).toBe('dark');
    expect(inkFor('#fafaf9')).toBe('dark');
    expect(inkFor('#f3e3cf')).toBe('dark');
    expect(inkFor('#000000')).toBe('light');
    expect(inkFor('#262262')).toBe('light');
    expect(inkFor('#0c0a09')).toBe('light');
    // Mid tones go to whichever ink contrasts more.
    expect(inkFor('#777777')).toBe('dark');
    expect(inkFor('#606060')).toBe('light');
  });

  it('resolves presets per theme, custom colours as picked, and defaults to the grid', () => {
    expect(resolveBackdrop(undefined, 'light')).toEqual({ kind: 'grid', color: '#fafaf9', grid: true });
    expect(resolveBackdrop({ kind: 'grid' }, 'dark')).toEqual({ kind: 'grid', color: '#0c0a09', grid: true });
    expect(resolveBackdrop({ kind: 'solid', preset: 'nila' }, 'light').color).toBe('#e8e9f8');
    expect(resolveBackdrop({ kind: 'solid', preset: 'nila' }, 'dark').color).toBe('#15142c');
    expect(resolveBackdrop({ kind: 'solid', custom: '#ABCDEF' }, 'dark')).toEqual({ kind: 'solid', color: '#abcdef', grid: false });
    expect(resolveBackdrop({ kind: 'solid', custom: 'nonsense' }, 'light').color).toBe('#fafaf9');
    expect(SOLID_PRESETS).toHaveLength(8);
  });

  it('keeps family lines and the lineage highlight at 3:1 on every preset, in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const p of SOLID_PRESETS) {
        const bd = resolveBackdrop({ kind: 'solid', preset: p.id }, theme);
        const pal = paletteOn(theme, bd);
        expect(contrast(pal.edge, bd.color), `${theme} ${p.id} edge`).toBeGreaterThanOrEqual(3);
        expect(contrast(pal.emphasis, bd.color), `${theme} ${p.id} lineage`).toBeGreaterThanOrEqual(3);
        expect(contrast(pal.caption, bd.color), `${theme} ${p.id} caption`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // The default grid keeps the theme palette.
    expect(paletteOn('light', resolveBackdrop(undefined, 'light')).edge).toBe(PALETTES.light.edge);
  });

  it('is saved in .sambung files; files from before the background open with the grid', () => {
    const doc = createDefaultTree();
    doc.settings = { ...doc.settings, background: { kind: 'solid', preset: 'sky' } };
    const back = parseSambung(buildSambung(doc, new Map()));
    expect(back.manifest.version).toBe(2);
    expect(back.doc.settings.background).toEqual({ kind: 'solid', preset: 'sky' });

    const { background: _drop, ...oldSettings } = createDefaultTree().settings;
    const old = zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'sambungdulur', version: 1, savedAt: '2026-01-01', individuals: 3, families: 1, media: 0 })),
      'tree.json': strToU8(JSON.stringify({ ...createDefaultTree(), settings: oldSettings })),
    });
    expect(parseSambung(old).doc.settings.background).toEqual({ kind: 'grid' });
  });
});
