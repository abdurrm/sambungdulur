import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const guide = fs.readFileSync('docs/PANDUAN.md', 'utf8');
const images = fs.readdirSync('docs/img').filter((f) => /\.(png|jpe?g|svg)$/i.test(f));
const referenced = [...guide.matchAll(/\]\(img\/([^)]+)\)/g)].map((m) => m[1]);

describe('illustrated guide (docs/PANDUAN.md)', () => {
  it('every referenced image exists', () => {
    for (const f of referenced) expect(fs.existsSync(path.join('docs/img', f)), f).toBe(true);
  });

  it('every image in docs/img is referenced', () => {
    for (const f of images) expect(referenced, f).toContain(f);
  });

  it('covers the spec #17 features with screenshots', () => {
    for (const f of ['31-popup-penyunting.png', '32-panel-tersemat.png', '34-latar-polos.png', '35-latar-motif.png', '36-latar-gambar.png', '37-mobile-kamera.png', '30-pintasan.png']) {
      expect(referenced, f).toContain(f);
    }
  });

  it('names Ctrl+H, F1 and ? for the shortcut list, with the new shortcuts in a table', () => {
    expect(guide).toMatch(/\*\*Ctrl\+H\*\*, \*\*F1\*\*, \*\*\?\*\*/);
    for (const keys of ['**Ctrl+O**', '**Ctrl+K**', '**Ctrl+,**', '**Ctrl+Shift+L**', '**M**', '**Home**', '**Alt+1**', '**Ctrl+Enter**', '**P** / **S** / **A** / **C**']) {
      expect(guide, keys).toContain(keys);
    }
  });
});
