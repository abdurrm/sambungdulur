import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TreeDoc } from '../model/types';
import { computeLayout } from '../layout/layout';
import type { Density } from '../layout/metrics';
import { selectVisible } from '../layout/visible';
import { PALETTES } from '../render/palette';
import { TreeSvg } from '../render/TreeSvg';
import { t } from '../i18n';

export type ImageBackground = 'theme' | 'white' | 'transparent';

export interface ImageExportOptions {
  density: Density;
  background: ImageBackground;
  /** Pixel ratio for raster output; reduced automatically to fit browser canvas limits. */
  scale: number;
  legend: boolean;
  focusId: string;
  ancestors: number;
  descendants: number;
}

/** Browser canvas limits (Chromium: 32767 px per side, ~268M px area; Safari is lower). */
const MAX_SIDE = 16384;
const MAX_AREA = 120_000_000;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function buildExportSvg(
  doc: TreeDoc,
  opts: ImageExportOptions,
  getMediaBlob: (id: string) => Promise<Blob | undefined>,
): Promise<{ svg: string; width: number; height: number }> {
  const vis = selectVisible(doc, opts.focusId, opts.ancestors, opts.descendants);
  const layout = computeLayout(doc, vis, { density: opts.density, manual: true });
  const urls = new Map<string, string>();
  const showPhotos = opts.density === 'detailed' || doc.settings.showImage;
  if (showPhotos) {
    for (const id of vis.gen.keys()) {
      const mid = doc.persons[id].photoId;
      if (!mid || urls.has(mid)) continue;
      const blob = await getMediaBlob(mid);
      if (blob) urls.set(mid, await blobToDataUrl(blob));
    }
  }
  const palette = { ...PALETTES[doc.settings.theme] };
  if (opts.background === 'white') palette.bg = '#ffffff';
  const markup = renderToStaticMarkup(
    createElement(TreeSvg, {
      doc,
      layout,
      palette,
      density: opts.density,
      mediaUrl: (id: string) => urls.get(id),
      background: opts.background !== 'transparent',
      legend: opts.legend,
      padding: 48,
      title: doc.title,
    }),
  );
  const width = Math.ceil(layout.width + 96);
  const height = Math.ceil(layout.height + 96 + (opts.legend ? 40 : 0));
  return { svg: `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`, width, height };
}

export function fitScale(width: number, height: number, wanted: number): number {
  let s = wanted;
  s = Math.min(s, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_AREA / (width * height)));
  return Math.max(0.05, s);
}

export async function rasterize(svg: string, width: number, height: number, scale: number, type: 'image/png' | 'image/jpeg', jpegBg: string): Promise<{ blob: Blob; scale: number }> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(t('renderFailed')));
      img.src = url;
    });
    let s = fitScale(width, height, scale);
    for (;;) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * s));
      canvas.height = Math.max(1, Math.round(height * s));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (type === 'image/jpeg') {
          ctx.fillStyle = jpegBg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
        if (blob) return { blob, scale: s };
      }
      // Canvas allocation failed (memory/limits): retry smaller, as the original does.
      if (s <= 0.1) throw new Error(t('tooLargeImage'));
      s *= 0.7;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

export function safeFileName(title: string): string {
  return (title || 'family-tree').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'family-tree';
}
