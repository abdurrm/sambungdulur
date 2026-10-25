// Generates every app icon from the logo geometry in src/brand/logo.json:
//   public/icons/icon.svg              app icon (rounded square), also the SVG favicon
//   public/icons/icon-192.png, -512    "any" PNG icons
//   public/icons/icon-maskable-512.png full-bleed, logo inside the 80 % safe circle
//   public/icons/icon-monochrome-512.png  white silhouette for Android themed icons
//   public/icons/favicon-32.png        PNG favicon
//   public/icons/apple-touch-icon.png  180 px, opaque (iOS ignores transparency)
// PNGs are rendered with the locally installed Microsoft Edge through Playwright (no browser download).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const logo = JSON.parse(fs.readFileSync(path.join(root, 'src/brand/logo.json'), 'utf8'));
const out = path.join(root, 'public/icons');

// Brand colours (src/theme/tokens.ts, light theme).
const NILA = '#4338ca';
const SOGAN = '#b45309';
const PAPER = '#fafaf9';

/** The mark, scaled by `k` around its visual centre and re-centred in the 64-unit square. */
function mark({ k = 1, primary = NILA, accent = SOGAN } = {}) {
  const [cx, cy] = logo.center;
  const h = logo.size / 2;
  const branches = logo.branches.map((d) => `<path d="${d}"/>`).join('');
  const nodes = logo.nodes.map((n) => `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${n.tone === 'accent' ? accent : primary}"/>`).join('');
  return (
    `<g transform="translate(${h} ${h}) scale(${k}) translate(${-cx} ${-cy})">` +
    `<g fill="none" stroke="${primary}" stroke-width="${logo.stroke}" stroke-linecap="round" stroke-linejoin="round">${branches}</g>${nodes}</g>`
  );
}
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${logo.size} ${logo.size}">${body}</svg>`;

const ICONS = {
  // Rounded square on warm paper; the mark fills most of it so it reads at 16-48 px.
  any: svg(`<rect width="64" height="64" rx="14" fill="${PAPER}"/>${mark({ k: 0.92 })}`),
  // Adaptive icons are cropped to a circle (or squircle) of 80 % of the side: keep the mark well inside.
  maskable: svg(`<rect width="64" height="64" fill="${PAPER}"/>${mark({ k: 0.7 })}`),
  // Android 13+ themed icons use only the alpha channel, masked like maskable icons.
  monochrome: svg(mark({ k: 0.7, primary: '#ffffff', accent: '#ffffff' })),
  apple: svg(`<rect width="64" height="64" fill="${PAPER}"/>${mark({ k: 0.8 })}`),
};

fs.writeFileSync(path.join(out, 'icon.svg'), ICONS.any + '\n');
console.log('wrote icon.svg');

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
async function render(markup, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(out, file), omitBackground: true });
  console.log('wrote', file);
}
await render(ICONS.any, 192, 'icon-192.png');
await render(ICONS.any, 512, 'icon-512.png');
await render(ICONS.maskable, 512, 'icon-maskable-512.png');
await render(ICONS.monochrome, 512, 'icon-monochrome-512.png');
await render(ICONS.any, 32, 'favicon-32.png');
await render(ICONS.apple, 180, 'apple-touch-icon.png');
await browser.close();
