/**
 * Read-only importer for MyHeritage Family Tree Builder project backups (.zip containing
 * Database/<name>.ftb, a SQLite 3 database, plus Photos/ and Cfg/).
 *
 * The schema knowledge below was derived by inspecting a local backup (FTB 8.0, db with 39
 * tables). Only the subset needed for this app is read. The .ftb file is never written:
 * edits are saved as .sambung or exported to GEDCOM.
 */
import { unzipSync } from 'fflate';
import type { Database, SqlJsStatic } from 'sql.js';
import type { Gender, MediaItem, Person, TreeDoc } from '../model/types';
import { DEFAULT_SETTINGS, emptyFields } from '../model/types';
import { htmlToText } from '../gedcom/gedcom';

export interface FtbImportReport {
  databaseFile: string;
  sqliteHeader: boolean;
  tables: number;
  individuals: number;
  families: number;
  photosInArchive: number;
  photosLinked: number;
  notes: number;
  /** Things present in the database that this importer does not bring over. */
  notImported: string[];
}

export interface FtbImportResult {
  doc: TreeDoc;
  media: Map<string, { bytes: Uint8Array; mime: string }>;
  report: FtbImportReport;
}

const utf8 = new TextDecoder('utf-8');

/** FTB stores some text (dates, fact headers) as a tiny protobuf message: 0x0A <varint len> <utf8>… */
export function decodeFtbText(v: unknown): string {
  if (v == null) return '';
  const bytes = v instanceof Uint8Array ? v : new TextEncoder().encode(String(v));
  if (bytes.length > 1 && bytes[0] === 0x0a) {
    let len = 0;
    let shift = 0;
    let i = 1;
    for (; i < bytes.length; i++) {
      len |= (bytes[i] & 0x7f) << shift;
      shift += 7;
      if (!(bytes[i] & 0x80)) {
        i++;
        break;
      }
    }
    if (i + len <= bytes.length) return utf8.decode(bytes.subarray(i, i + len)).trim();
  }
  return utf8.decode(bytes).trim();
}

function rows(db: Database, sql: string): Record<string, unknown>[] {
  const res = db.exec(sql);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

const mimeOf = (ext: string) =>
  ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

export async function importFtbZip(bytes: Uint8Array, initSql: () => Promise<SqlJsStatic>, title = 'FTB import'): Promise<FtbImportResult> {
  const files = unzipSync(bytes);
  const dbName = Object.keys(files).find((n) => /\.ftb$/i.test(n));
  if (!dbName) throw new Error('No .ftb database found in this archive; it is not a Family Tree Builder backup.');
  const dbBytes = files[dbName];
  const sqliteHeader = utf8.decode(dbBytes.subarray(0, 15)) === 'SQLite format 3';
  if (!sqliteHeader) throw new Error(`${dbName} is not a SQLite database; unsupported FTB variant.`);

  const SQL = await initSql();
  const db = new SQL.Database(dbBytes);
  try {
    const tables = rows(db, "select count(*) as c from sqlite_master where type='table'")[0].c as number;
    const persons: Record<string, Person> = {};
    const order: string[] = [];
    for (const r of rows(db, 'select individual_id id, gender, is_alive from individual_main_data where delete_flag=0 order by individual_id')) {
      const id = `I${r.id}`;
      const g = String(r.gender ?? 'U').toUpperCase();
      const gender: Gender = g === 'M' ? 'male' : g === 'F' ? 'female' : 'other';
      persons[id] = { ...emptyFields(), id, gender, deceased: r.is_alive === 2 };
      order.push(id);
    }
    const named = new Set<string>();
    for (const r of rows(
      db,
      `select d.individual_id id, l.first_name, l.last_name, l.married_surname from individual_data_set d
       join individual_lang_data l on l.individual_data_set_id=d.individual_data_set_id
       where d.delete_flag=0 order by l.data_language, l.individual_lang_data_id`,
    )) {
      const id = `I${r.id}`;
      const p = persons[id];
      if (!p || named.has(id)) continue;
      named.add(id);
      p.givenName = decodeFtbText(r.first_name);
      p.surnameAtBirth = decodeFtbText(r.last_name);
      p.surnameNow = decodeFtbText(r.married_surname);
    }
    const places = new Map<number, string>();
    for (const r of rows(db, 'select place_id, place from places_lang_data')) {
      if (!places.has(r.place_id as number)) places.set(r.place_id as number, decodeFtbText(r.place));
    }
    const skippedFacts = new Map<string, number>();
    for (const r of rows(
      db,
      `select f.individual_id id, f.token, cast(f.date as blob) date, f.place_id, cast(l.header as blob) header
       from individual_fact_main_data f left join individual_fact_lang_data l on l.individual_fact_id=f.individual_fact_id
       where f.delete_flag=0 order by f.individual_fact_id`,
    )) {
      const p = persons[`I${r.id}`];
      if (!p) continue;
      const token = String(r.token);
      const date = decodeFtbText(r.date);
      const place = places.get(r.place_id as number) ?? '';
      if (token === 'BIRT') {
        p.birthDate ||= date;
        p.birthPlace ||= place;
      } else if (token === 'DEAT') {
        p.deceased = true;
        p.deathDate ||= date;
      } else if (token === 'OCCU') {
        p.profession ||= decodeFtbText(r.header);
      } else {
        skippedFacts.set(token, (skippedFacts.get(token) ?? 0) + 1);
      }
    }
    let notes = 0;
    for (const r of rows(
      db,
      `select t.entity_id id, cast(l.note_text as blob) txt from note_to_item_connection n
       join token_on_item t on t.token_on_item_id=n.external_token_on_item_id
       join note_lang_data l on l.note_id=n.note_id
       where n.delete_flag=0 and t.item_type=1 and t.entity_id>0`,
    )) {
      const p = persons[`I${r.id}`];
      if (!p || p.facts) continue;
      p.facts = htmlToText(decodeFtbText(r.txt));
      notes++;
    }

    // Families
    const families: TreeDoc['families'] = {};
    const familyOrder: string[] = [];
    for (const r of rows(db, 'select family_id id from family_main_data where delete_flag=0 order by family_id')) {
      const id = `F${r.id}`;
      families[id] = { id, partners: [], children: [] };
      familyOrder.push(id);
    }
    let otherChildRoles = 0;
    for (const r of rows(
      db,
      `select family_id fid, individual_id iid, individual_role_type role from family_individual_connection
       where delete_flag=0 order by family_id, individual_role_type, child_order_in_family, family_individual_connection_id`,
    )) {
      const f = families[`F${r.fid}`];
      const pid = `I${r.iid}`;
      if (!f || !persons[pid]) continue;
      if (r.role === 2 || r.role === 3) f.partners.push(pid);
      else {
        if (r.role !== 5) otherChildRoles++;
        f.children.push(pid);
      }
    }

    // Photos
    const archivePhotos = new Map<number, string>();
    for (const name of Object.keys(files)) {
      const m = /(?:^|\/)Photos\/P(\d+)_(\d+)_(\d+)\.(\w+)$/i.exec(name);
      if (m) archivePhotos.set(+m[1], name);
    }
    const mediaItems: Record<string, MediaItem> = {};
    const mediaBytes = new Map<string, { bytes: Uint8Array; mime: string }>();
    const register = (mediaItemId: number): string => {
      const name = archivePhotos.get(mediaItemId);
      if (!name) return '';
      const id = `P${mediaItemId}`;
      if (!mediaItems[id]) {
        const fileName = name.split('/').pop()!;
        const ext = fileName.split('.').pop()!.toLowerCase();
        mediaItems[id] = { id, fileName, mime: mimeOf(ext), sourcePath: `media/${fileName}`, available: true };
        mediaBytes.set(id, { bytes: files[name], mime: mimeOf(ext) });
      }
      return id;
    };
    let linked = 0;
    for (const r of rows(
      db,
      'select individual_id id, personal_photo_media_item mid from image_to_individual_face_tagging where delete_flag=0 and is_personal_photo=1 order by image_to_individual_face_tagging_id',
    )) {
      const p = persons[`I${r.id}`];
      if (!p || p.photoId) continue;
      const mid = register(r.mid as number);
      if (mid) {
        p.photoId = mid;
        linked++;
      }
    }
    const gallery: Record<string, string[]> = {};
    for (const r of rows(
      db,
      `select t.entity_id id, m.media_item_id mid from media_item_to_item_connection m
       join token_on_item t on t.token_on_item_id=m.external_token_on_item_id
       where m.delete_flag=0 and t.item_type=1`,
    )) {
      const pid = `I${r.id}`;
      if (!persons[pid]) continue;
      const mid = register(r.mid as number);
      if (mid && mid !== persons[pid].photoId) (gallery[pid] ??= []).includes(mid) || gallery[pid].push(mid);
    }

    const notImported: string[] = [];
    for (const [tok, n] of skippedFacts) notImported.push(`${n} individual fact(s) of type ${tok}`);
    const famFacts = rows(db, 'select token, count(*) c from family_fact_main_data where delete_flag=0 group by token');
    for (const r of famFacts) notImported.push(`${r.c} family fact(s) of type ${r.token}`);
    if (otherChildRoles) notImported.push(`${otherChildRoles} child link(s) with a non-birth role type (imported as plain children)`);
    notImported.push('face-tag rectangles, citations/sources, project configuration (Cfg/)');

    const doc: TreeDoc = {
      title,
      persons,
      families,
      order,
      familyOrder,
      focusId: order[0] ?? '',
      settings: {
        ...DEFAULT_SETTINGS,
        ancestorGenerations: order.length > 60 ? 3 : -1,
        descendantGenerations: order.length > 60 ? 3 : -1,
      },
      manual: { personDx: {}, familyDy: {} },
      media: mediaItems,
      origin: 'ftb',
      collapsed: {},
      gallery,
      compactCards: {},
    };
    return {
      doc,
      media: mediaBytes,
      report: {
        databaseFile: dbName,
        sqliteHeader,
        tables,
        individuals: order.length,
        families: familyOrder.length,
        photosInArchive: archivePhotos.size,
        photosLinked: linked,
        notes,
        notImported,
      },
    };
  } finally {
    db.close();
  }
}
