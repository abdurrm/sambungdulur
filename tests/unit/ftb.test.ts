import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { zipSync, strToU8 } from 'fflate';
import { decodeFtbText, importFtbZip } from '../../src/ftb/importFtb';
import { importGedcom } from '../../src/gedcom/gedcom';

const init = () => initSqlJs();

describe('FTB helpers', () => {
  it('decodes protobuf-wrapped text', () => {
    const bytes = new Uint8Array([0x0a, 0x0b, ...new TextEncoder().encode('24 NOV 1990'), 0x22, 0x2d]);
    expect(decodeFtbText(bytes)).toBe('24 NOV 1990');
    expect(decodeFtbText('Plain text')).toBe('Plain text');
    const uni = new TextEncoder().encode('Bandung — ✓');
    expect(decodeFtbText(new Uint8Array([0x0a, uni.length, ...uni]))).toBe('Bandung — ✓');
  });

  it('rejects archives without an FTB database', async () => {
    const zip = zipSync({ 'tree.ged': strToU8('0 HEAD\n0 TRLR\n') });
    await expect(importFtbZip(zip, init)).rejects.toThrow(/No \.ftb database/);
  });

  it('imports a synthetic FTB database', async () => {
    const SQL = await init();
    const db = new SQL.Database();
    db.run(`
      create table individual_main_data(individual_id integer, gender text, is_alive int, delete_flag int);
      create table individual_data_set(individual_data_set_id integer, individual_id int, delete_flag int);
      create table individual_lang_data(individual_lang_data_id integer, individual_data_set_id int, data_language int, first_name text, last_name text, married_surname text);
      create table places_lang_data(place_id int, place text);
      create table individual_fact_main_data(individual_fact_id integer, individual_id int, token text, date blob, place_id int, delete_flag int);
      create table individual_fact_lang_data(individual_fact_id int, header blob);
      create table note_to_item_connection(note_id int, external_token_on_item_id int, delete_flag int);
      create table token_on_item(token_on_item_id int, entity_id int, item_type int);
      create table note_lang_data(note_id int, note_text text);
      create table family_main_data(family_id int, delete_flag int);
      create table family_individual_connection(family_individual_connection_id int, family_id int, individual_id int, individual_role_type int, child_order_in_family int, delete_flag int);
      create table image_to_individual_face_tagging(image_to_individual_face_tagging_id int, individual_id int, personal_photo_media_item int, delete_flag int, is_personal_photo int);
      create table media_item_to_item_connection(media_item_id int, external_token_on_item_id int, delete_flag int);
      create table family_fact_main_data(token text, delete_flag int);
      insert into individual_main_data values (1,'M',2,0),(2,'F',3,0),(3,'U',3,0);
      insert into individual_data_set values (10,1,0),(20,2,0);
      insert into individual_lang_data values (1,10,0,'Joko','Susilo',''),(2,20,0,'Rini','','Susilo');
      insert into places_lang_data values (7,'Jakarta');
      insert into individual_fact_main_data values (1,1,'BIRT',X'0A0B3132204A414E2031393430222D',7,0),(2,1,'OCCU',null,null,0),(3,1,'DEAT',X'0A0431393939',null,0);
      insert into individual_fact_lang_data values (2,'Petani');
      insert into token_on_item values (1,2,1);
      insert into note_to_item_connection values (1,1,0);
      insert into note_lang_data values (1,'<p>Catatan &amp; cerita</p>');
      insert into family_main_data values (5,0);
      insert into family_individual_connection values (1,5,1,2,0,0),(2,5,2,3,0,0),(3,5,3,5,1,0);
      insert into image_to_individual_face_tagging values (1,2,9,0,1);
      insert into family_fact_main_data values ('MARR',0);
    `);
    const zip = zipSync({
      'Database/x.ftb': db.export(),
      'Photos/P9_10_10.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
      'Photos/P9_AUX_5_5.jpg': new Uint8Array([0xff, 0xd8]),
    });
    db.close();
    const { doc, media, report } = await importFtbZip(zip, init);
    expect(report.individuals).toBe(3);
    expect(doc.persons.I1).toMatchObject({
      givenName: 'Joko',
      surnameAtBirth: 'Susilo',
      gender: 'male',
      birthDate: '12 JAN 1940',
      birthPlace: 'Jakarta',
      deceased: true,
      deathDate: '1999',
      profession: 'Petani',
    });
    expect(doc.persons.I2.facts).toBe('Catatan & cerita');
    expect(doc.persons.I2.surnameNow).toBe('Susilo');
    expect(doc.persons.I3.gender).toBe('other');
    expect(doc.families.F5).toEqual({ id: 'F5', partners: ['I1', 'I2'], children: ['I3'] });
    expect(doc.persons.I2.photoId).toBe('P9');
    expect(media.get('P9')?.bytes.length).toBe(3);
    expect(report.notImported.join(' ')).toContain('MARR');
  });
});

// ---------------------------------------------------------------------------
// Real backup (local copy only; never committed). Cross-checked against the GEDCOM export.
// ---------------------------------------------------------------------------
const zipPath = path.join(__dirname, '../../local-test-data/abdurrm2022.zip');
const gedPath = path.join(__dirname, '../../local-test-data/abdurrm2023.ged');
const hasReal = fs.existsSync(zipPath) && fs.existsSync(gedPath);

describe.skipIf(!hasReal)('local MyHeritage FTB backup (abdurrm2022.zip copy)', () => {
  it('imports and agrees with the GEDCOM export of the same tree', async () => {
    const { doc, report } = await importFtbZip(new Uint8Array(fs.readFileSync(zipPath)), init);
    expect(report.sqliteHeader).toBe(true);
    expect(report.tables).toBe(39);
    expect(report.individuals).toBe(2336);
    expect(report.families).toBe(658);
    const ged = importGedcom(fs.readFileSync(gedPath, 'utf8')).doc;
    const fields = ['givenName', 'surnameAtBirth', 'gender', 'birthDate', 'deceased', 'deathDate', 'profession'] as const;
    const mismatches: Record<string, number> = {};
    let compared = 0;
    let slashNames = 0;
    for (const id of ged.order) {
      const a = ged.persons[id];
      const b = doc.persons[id];
      expect(b, `person ${id} missing from FTB import`).toBeTruthy();
      compared++;
      for (const f of fields) {
        if (a[f] === b[f]) continue;
        // Known source ambiguity: a literal "/" inside an FTB first name collides with the GEDCOM
        // surname delimiter, so MyHeritage's own GEDCOM export truncates the given name there.
        if ((f === 'givenName' || f === 'surnameAtBirth') && b.givenName.includes('/') && b.givenName.startsWith(a.givenName)) {
          if (f === 'givenName') slashNames++;
          continue;
        }
        mismatches[f] = (mismatches[f] ?? 0) + 1;
      }
    }
    expect(slashNames).toBe(3);
    expect(compared).toBe(2336);
    // Report, then require exact agreement on core fields.
    console.log('FTB vs GEDCOM field mismatches:', mismatches, 'photos linked:', report.photosLinked, 'notes:', report.notes);
    for (const f of fields) expect(mismatches[f] ?? 0, f).toBe(0);
    // Same family structure.
    const key = (d: typeof doc) =>
      Object.values(d.families)
        .map((f) => `${[...f.partners].sort().join('+')}>${[...f.children].sort().join(',')}`)
        .sort();
    expect(key(doc)).toEqual(key(ged));
  });
});
