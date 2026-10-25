import { describe, expect, it } from 'vitest';
import { fitWithin } from '../../src/io/shrinkImage';
import { FADE_DEFAULT, resolveBackdrop, TILE_COLOR, type ImageBackground } from '../../src/model/background';
import { paletteOn } from '../../src/render/palette';
import { contrast } from '../../src/theme/color';

describe('image shrinker', () => {
  it('fits the longest side and keeps the aspect ratio', () => {
    expect(fitWithin(6000, 4000, 2560)).toEqual({ width: 2560, height: 1707 });
    expect(fitWithin(4000, 6000, 2560)).toEqual({ width: 1707, height: 2560 });
    expect(fitWithin(4000, 3000, 2560)).toEqual({ width: 2560, height: 1920 });
    const r = fitWithin(5183, 2911, 2560);
    expect(Math.max(r.width, r.height)).toBe(2560);
    expect(Math.abs(r.width / r.height - 5183 / 2911)).toBeLessThan(0.002);
  });
  it('never enlarges, and copes with empty sizes', () => {
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(2560, 10, 2560)).toEqual({ width: 2560, height: 10 });
    expect(fitWithin(10000, 1, 512)).toEqual({ width: 512, height: 1 });
    expect(fitWithin(0, 100, 512)).toEqual({ width: 0, height: 0 });
  });
});

describe('pattern and picture backgrounds', () => {
  it('resolve motifs with scale limits and a default colour per theme', () => {
    const light = resolveBackdrop({ kind: 'tiles', pattern: 'kawung', scale: 120 }, 'light');
    expect(light.tiles).toEqual({ pattern: 'kawung', scale: 120, color: TILE_COLOR.light });
    expect(resolveBackdrop({ kind: 'tiles', pattern: 'hex', scale: 120 }, 'dark').tiles!.color).toBe(TILE_COLOR.dark);
    expect(resolveBackdrop({ kind: 'tiles', pattern: 'dots', scale: 900, color: '#ABCDEF' }, 'light').tiles).toEqual({ pattern: 'dots', scale: 200, color: '#abcdef' });
    expect(resolveBackdrop({ kind: 'tiles', pattern: 'dots', scale: 10 }, 'light').tiles!.scale).toBe(50);
  });

  const picture = (average: string, fade = FADE_DEFAULT): ImageBackground => ({ kind: 'image', mediaId: 'B1', width: 100, height: 80, average, fit: 'cover', fade, blur: 0, fixed: true });
  it('pick lines from the picture seen through its veil', () => {
    const r = resolveBackdrop(picture('#000000', 0), 'light', () => 'blob:x');
    expect(r.image!.url).toBe('blob:x');
    expect(r.ink).toBe('#000000');
    // 70 % of the light theme's paper over black.
    expect(resolveBackdrop(picture('#000000'), 'light').ink).toBe('#afafae');
    expect(resolveBackdrop(picture('#ffffff', 0), 'dark').ink).toBe('#ffffff');
  });
  it('keep lines at 3:1 over bright and dark pictures with the default fade, in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const avg of ['#000000', '#ffffff', '#3b5b2a', '#d9c7a0', '#1d3557']) {
        const b = resolveBackdrop(picture(avg), theme);
        const pal = paletteOn(theme, b);
        expect(contrast(pal.edge, b.ink!), `${theme} ${avg}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
