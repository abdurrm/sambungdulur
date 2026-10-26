import type { Worker as OcrWorker } from 'tesseract.js';
import { parseKkTokens, type KkRow, type KkToken } from './parse';
import { t } from '../i18n';
import { prepareScan } from './prepareScan';

export interface KkReadResult { id: string; rows: KkRow[]; text: string; pages: number }
export async function fingerprint(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Documents stay in memory; all engine and language assets come from the same application origin. */
export async function readKk(file: File, rotation: number, progress: (message: string) => void, signal?: AbortSignal): Promise<KkReadResult> {
  signal?.throwIfAborted();
  if (file.size > 30 * 1024 * 1024) throw new Error(t('kkFileTooLarge'));
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) throw new Error(t('errUnsupported', { file: file.name }));
  const bytes = await file.arrayBuffer();
  const id = await fingerprint(bytes);
  let worker: OcrWorker | undefined;
  const abortable = async <T>(promise: Promise<T>): Promise<T> => {
    if (!signal) return promise;
    let stop: () => void = () => {};
    const abort = new Promise<never>((_, reject) => { stop = () => reject(signal.reason ?? new DOMException('Aborted','AbortError')); signal.addEventListener('abort',stop,{once:true}); if (signal.aborted) stop(); });
    try { return await Promise.race([promise,abort]); } finally { signal.removeEventListener('abort',stop); }
  };
  const rows: KkRow[] = [];
  const texts: string[] = [];
  const ocr = async (canvas: HTMLCanvasElement, page: number): Promise<KkToken[]> => {
    if (!worker) {
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      const assets = new URL(`${import.meta.env.BASE_URL}kk-assets/`, location.href).href;
      worker = await createWorker('ind', OEM.LSTM_ONLY, {
        workerPath: `${assets}worker.min.js`, corePath: assets, langPath: assets, workerBlobURL: false,
        logger: ({ progress: value }) => progress(t('kkReading', { page, percent: Math.round(value * 100) })),
      });
      signal?.throwIfAborted();
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
    }
    const result = await abortable(worker.recognize(prepareScan(canvas), {}, { text: true, tsv: true }));
    texts.push(result.data.text);
    return (result.data.tsv ?? '').split('\n').slice(1).flatMap((line): KkToken[] => {
      const col = line.split('\t');
      if (col[0] !== '5' || !col[11]?.trim()) return [];
      return [{ text: col.slice(11).join('\t'), x: +col[6] / canvas.width, y: +col[7] / canvas.height, w: +col[8] / canvas.width, h: +col[9] / canvas.height }];
    });
  };
  const rotated = (canvas: HTMLCanvasElement, degrees: number) => {
    if (!degrees) return canvas;
    const out = document.createElement('canvas');
    const quarter = Math.abs(degrees % 180) === 90;
    out.width = quarter ? canvas.height : canvas.width;
    out.height = quarter ? canvas.width : canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.translate(out.width / 2, out.height / 2); ctx.rotate(degrees * Math.PI / 180);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return out;
  };
  try {
    if (/\.pdf$/i.test(file.name)) {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
      try {
        const pdf = await task.promise;
        if (pdf.numPages > 20) throw new Error(t('kkTooManyPages'));
        for (let number = 1; number <= pdf.numPages; number++) {
          signal?.throwIfAborted();
          progress(t('kkReading', { page: number, percent: 0 }));
          const page = await pdf.getPage(number);
          const viewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          let tokens = content.items.flatMap((item): KkToken[] => {
            if (!('str' in item) || !item.str.trim()) return [];
            const point = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            return [{ text: item.str, x: point[0] / viewport.width, y: (point[1] - item.height) / viewport.height, w: item.width / viewport.width, h: item.height / viewport.height }];
          });
          const fromText = rotation === 0 ? parseKkTokens(tokens, number) : [];
          texts.push(tokens.map((t) => t.text).join(' '));
          if (fromText.length) rows.push(...fromText);
          else {
            const view = page.getViewport({ scale: Math.min(3, 3000 / Math.max(viewport.width, viewport.height)) });
            const canvas = document.createElement('canvas'); canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
            await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: view }).promise;
            tokens = await ocr(rotated(canvas, rotation), number);
            rows.push(...parseKkTokens(tokens, number));
          }
          page.cleanup();
        }
        return { id, rows, text: texts.join('\n\n'), pages: pdf.numPages };
      } finally { await task.destroy(); }
    }
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      rows.push(...parseKkTokens(await ocr(rotated(canvas, rotation), 1), 1));
    } finally { bitmap.close(); }
    return { id, rows, text: texts.join('\n\n'), pages: 1 };
  } finally { if (worker) await worker.terminate(); }
}
