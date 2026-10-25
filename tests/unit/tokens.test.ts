import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { cssVars, themeCss, TOKENS } from '../../src/theme/tokens';
import { PALETTES } from '../../src/render/palette';
import { contrast, over } from '../../src/theme/color';
import type { Theme } from '../../src/model/types';

const THEMES: Theme[] = ['light', 'dark'];

describe('colour tokens', () => {
  it('derive the interface CSS and the canvas palette from the same values', () => {
    for (const th of THEMES) {
      const css = cssVars(th);
      const pal = PALETTES[th];
      const pairs: [string, string][] = [
        [css['--bg'], pal.bg],
        [css['--text'], pal.text],
        [css['--muted'], pal.muted],
        [css['--dim'], pal.dim],
        [css['--accent'], pal.emphasis],
        [css['--sogan'], pal.match],
        [css['--male'], pal.ring.male],
        [css['--female'], pal.ring.female],
        [css['--other'], pal.ring.other],
        [css['--on-accent'], pal.onHandle],
        [css['--shadow-color'], pal.shadow],
      ];
      for (const [a, b] of pairs) expect(a, th).toBe(b);
      // Every theme property in the generated stylesheet comes from cssVars.
      const block = themeCss().split('\n').find((l) => l.startsWith(`html[data-theme='${th}']`))!;
      for (const [name, value] of Object.entries(css)) expect(block).toContain(`${name}:${value}`);
    }
  });

  it('the stylesheet no longer hard-codes theme colours', () => {
    const css = fs.readFileSync('src/styles.css', 'utf8');
    expect(css).not.toMatch(/html\[data-theme='(light|dark)'\]\s*\{/);
    expect(css).not.toMatch(/--accent:\s*#/);
  });

  it('use the Nila & Sogan palette, with a teal "other" ring', () => {
    expect(TOKENS.light.primary).toBe('#4338ca');
    expect(TOKENS.light.primaryStrong).toBe('#3730a3');
    expect(TOKENS.light.accent).toBe('#b45309');
    expect(TOKENS.light.bg).toBe('#fafaf9');
    expect(TOKENS.dark.primary).toBe('#a5b4fc');
    expect(TOKENS.dark.accent).toBe('#fbbf24');
    expect(TOKENS.dark.bg).toBe('#0c0a09');
    expect(TOKENS.light.other).toBe('#0d9488');
    expect(TOKENS.light.male).toBe('#0284c7');
    expect(TOKENS.light.female).toBe('#db2777');
  });

  for (const th of THEMES) {
    it(`meet text 4.5:1 and graphics 3:1 in the ${th} theme`, () => {
      const k = TOKENS[th];
      const card = over(k.card, k.bg);
      const text: [string, string, ReturnType<typeof over> | string][] = [
        ['text on bg', k.text, k.bg],
        ['text on surface', k.text, k.surface],
        ['text on hover', k.text, k.hover],
        ['muted on surface', k.muted, k.surface],
        ['muted on hover', k.muted, k.hover],
        ['dim on surface', k.dim, k.surface],
        ['dim on bg', k.dim, k.bg],
        ['primary text on surface', k.primaryText, k.surface],
        ['primary text on primary soft', k.primaryText, over(k.primarySoft, k.surface)],
        ['on-primary on primary button', k.onPrimary, k.primaryStrong],
        ['sogan text on surface', k.accentText, k.surface],
        ['danger text on surface', k.dangerText, k.surface],
        ['danger text on danger soft', k.dangerText, over(k.dangerSoft, k.surface)],
        ['link on surface', k.info, k.surface],
        ['text on search mark', k.text, over(k.accentSoft, k.surface)],
        ['card text', k.text, card],
        ['card muted text', k.muted, card],
        ['card dim text', k.dim, card],
      ];
      for (const [name, fg, bg] of text) expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(4.5);
      const graphics: [string, string, ReturnType<typeof over> | string][] = [
        ['primary on bg', k.primary, k.bg],
        ['focus ring on surface', k.primary, k.surface],
        ['lineage on bg', k.primary, k.bg],
        ['match ring on card', k.accent, card],
        ['male ring on card', k.male, card],
        ['female ring on card', k.female, card],
        ['other ring on card', k.other, card],
        ['family line on bg', k.edge, k.bg],
        ['card button on card', k.primaryText, card],
        ['unsaved badge on surface', k.accent, k.surface],
      ];
      for (const [name, fg, bg] of graphics) expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(3);
      // The "other" ring must not be mistaken for the primary colour.
      expect(k.other).not.toBe(k.primary);
    });
  }

  it('the installed app and the browser bar use the brand colours', () => {
    const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(manifest.theme_color).toBe(TOKENS.light.bar);
    expect(manifest.background_color).toBe(TOKENS.light.bg);
    const html = fs.readFileSync('index.html', 'utf8');
    expect(html).toContain(`<meta name="theme-color" content="${TOKENS.light.bar}" media="(prefers-color-scheme: light)" />`);
    expect(html).toContain(`<meta name="theme-color" content="${TOKENS.dark.bar}" media="(prefers-color-scheme: dark)" />`);
  });
});
