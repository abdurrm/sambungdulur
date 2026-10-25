/**
 * Native save format (.sambung): a ZIP archive that this app reopens losslessly.
 *
 *   manifest.json   { format: "sambungdulur", version, savedAt, counts }
 *   tree.json       TreeDoc without gedcomSource
 *   source.ged      original GEDCOM text (only for GEDCOM imports; keeps unknown fields for export)
 *   media/<id>.<ext> photo bytes
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { TreeDoc } from '../model/types';
import { DEFAULT_SETTINGS } from '../model/types';

export const SAMBUNG_FORMAT = 'sambungdulur';
/** 2: tree settings carry the canvas background. Version 1 files open with the default grid. */
export const SAMBUNG_VERSION = 2;

export interface SambungManifest {
  format: string;
  version: number;
  savedAt: string;
  individuals: number;
  families: number;
  media: number;
}

const extOf = (mime: string, name: string) =>
  name.includes('.') ? name.split('.').pop()!.toLowerCase() : mime === 'image/png' ? 'png' : 'jpg';

export function buildSambung(doc: TreeDoc, media: Map<string, Uint8Array>): Uint8Array {
  const { gedcomSource, ...rest } = doc;
  const files: Record<string, Uint8Array> = {};
  const manifest: SambungManifest = {
    format: SAMBUNG_FORMAT,
    version: SAMBUNG_VERSION,
    savedAt: new Date().toISOString(),
    individuals: doc.order.length,
    families: doc.familyOrder.length,
    media: media.size,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['tree.json'] = strToU8(JSON.stringify(rest));
  if (gedcomSource !== undefined) files['source.ged'] = strToU8(gedcomSource);
  for (const [id, bytes] of media) {
    const item = doc.media[id];
    if (!item) continue;
    files[`media/${id}.${extOf(item.mime, item.fileName)}`] = bytes;
  }
  // Media is already compressed; store it, deflate the JSON/GEDCOM.
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: k.startsWith('media/') ? 0 : 6 }]])),
  );
}

export function isSambung(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === 'manifest.json' });
    const m = JSON.parse(strFromU8(files['manifest.json'])) as SambungManifest;
    return m.format === SAMBUNG_FORMAT;
  } catch {
    return false;
  }
}

export function parseSambung(bytes: Uint8Array): { doc: TreeDoc; media: Map<string, Uint8Array>; manifest: SambungManifest } {
  const files = unzipSync(bytes);
  if (!files['manifest.json'] || !files['tree.json']) throw new Error('Not a SambungDulur file (manifest.json/tree.json missing).');
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as SambungManifest;
  if (manifest.format !== SAMBUNG_FORMAT) throw new Error('Not a SambungDulur file.');
  if (manifest.version > SAMBUNG_VERSION) throw new Error(`File version ${manifest.version} is newer than this app supports.`);
  const doc = JSON.parse(strFromU8(files['tree.json'])) as TreeDoc;
  if (files['source.ged']) doc.gedcomSource = strFromU8(files['source.ged']);
  // Forward-compatible defaults for fields added after a file was written.
  doc.settings = { ...DEFAULT_SETTINGS, ...doc.settings };
  doc.manual ??= { personDx: {}, familyDy: {} };
  doc.collapsed ??= {};
  doc.compactCards ??= {};
  doc.gallery ??= {};
  doc.media ??= {};
  const media = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(files)) {
    const m = /^media\/([^/.]+)\.\w+$/.exec(name);
    if (m && doc.media[m[1]]) {
      media.set(m[1], data);
      doc.media[m[1]] = { ...doc.media[m[1]], available: true };
    }
  }
  return { doc, media, manifest };
}
