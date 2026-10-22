// Renders public/icons/icon.svg to the PNG sizes required for PWA installability.
// Uses the locally installed Microsoft Edge through Playwright (no browser download).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const svg = fs.readFileSync(path.join(root, 'public/icons/icon.svg'), 'utf8');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
async function render(size, file, maskable = false) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#0f172a;display:grid;place-items:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`
    : svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.screenshot({ path: path.join(root, 'public/icons', file), omitBackground: !maskable });
  console.log('wrote', file);
}
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', true);
await browser.close();
