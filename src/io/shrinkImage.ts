/**
 * Shared image shrinker for camera photos and canvas background pictures.
 * `fitWithin` is the pure part (output size); `shrinkImage` decodes with the browser, which applies the
 * EXIF orientation (`imageOrientation: 'from-image'`), and re-encodes as JPEG.
 */

/** Size that fits inside `max` × `max`, keeping the aspect ratio; never enlarges. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export interface ShrunkImage {
  blob: Blob;
  width: number;
  height: number;
  /** Average colour of the picture (from a 16 × 16 copy), as #rrggbb. */
  average: string;
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older engines without the options bag still honour EXIF by default.
    return await createImageBitmap(file);
  }
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Shrinks to `maxSide` on the longest edge (keeps smaller images as they are) and encodes as JPEG. */
export async function shrinkImage(file: Blob, maxSide: number, quality = 0.85): Promise<ShrunkImage> {
  const bmp = await decode(file);
  try {
    const size = fitWithin(bmp.width, bmp.height, maxSide);
    const c = canvasOf(size.width, size.height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // JPEG has no transparency
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('Image encoding failed');
    const tiny = canvasOf(16, 16);
    const tctx = tiny.getContext('2d')!;
    tctx.drawImage(c, 0, 0, 16, 16);
    const px = tctx.getImageData(0, 0, 16, 16).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < px.length; i += 4) (r += px[i]), (g += px[i + 1]), (b += px[i + 2]);
    const n = px.length / 4;
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
    return { blob, width: size.width, height: size.height, average: `#${hex(r)}${hex(g)}${hex(b)}` };
  } finally {
    bmp.close();
  }
}
