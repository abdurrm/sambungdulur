import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGedcomText, serializeGedcom } from '../../src/gedcom/ast';
import { exportGedcom, importGedcom } from '../../src/gedcom/gedcom';
import { addChild, addParents, addPartner, deletePerson, updatePerson } from '../../src/model/relations';

const fixture = fs.readFileSync(path.join(__dirname, '../fixtures/synthetic.ged'), 'utf8');
const crlfBom = '\uFEFF' + fixture.replace(/\n/g, '\r\n');

function lines(text: string) {
  return text.replace(/^\uFEFF/, '').split(/\r\n|\n/);
}

describe('GEDCOM AST', () => {
  it('serializes an unedited file byte-identically (LF)', () => {
    expect(serializeGedcom(parseGedcomText(fixture))).toBe(fixture);
  });

  it('serializes an unedited file byte-identically (BOM + CRLF, odd spacing)', () => {
    expect(serializeGedcom(parseGedcomText(crlfBom))).toBe(crlfBom);
    expect(serializeGedcom(parseGedcomText(crlfBom + '\r\n'))).toBe(crlfBom + '\r\n');
  });
});

describe('GEDCOM import', () => {
  const { doc, stats } = importGedcom(crlfBom);

  it('counts records', () => {
    expect(stats).toEqual({ individuals: 4, families: 1, otherRecords: 2, media: 1 });
  });

  it('extracts person fields', () => {
    const budi = doc.persons.I1;
    expect(budi.givenName).toBe('Budi Santoso');
    expect(budi.surnameAtBirth).toBe('Wijaya');
    expect(budi.gender).toBe('male');
    expect(budi.birthDate).toBe('12 MAR 1950');
    expect(budi.birthPlace).toBe('Malang, Jawa Timur, Indonesia');
    expect(budi.deceased).toBe(true);
    expect(budi.deathDate).toBe('ABT 2010');
    expect(budi.profession).toBe('Guru');
    expect(budi.facts).toBe('Suka berkebun & membaca\nBaris kedua — ünïcödé ✓');
    expect(doc.media[budi.photoId].sourcePath).toBe('C:\\Photos\\P1_100_100.jpg');
    expect(doc.persons.I4.givenName).toBe('');
    expect(doc.persons.I4.gender).toBe('other');
  });

  it('builds families', () => {
    expect(doc.families.F1).toEqual({ id: 'F1', partners: ['I1', 'I2'], children: ['I3', 'I4'] });
  });

  it('exports unedited trees byte-identically', () => {
    expect(exportGedcom(doc)).toBe(crlfBom);
  });
});

describe('GEDCOM export after edits', () => {
  const base = importGedcom(crlfBom).doc;

  it('changes only the edited lines and keeps unknown tags', () => {
    const edited = updatePerson(base, 'I3', { givenName: 'Ayu Lestari', birthDate: '5 JUL 1980', profession: 'Dokter' });
    const out = lines(exportGedcom(edited));
    const src = lines(crlfBom);
    expect(out).toContain('1 NAME Ayu Lestari //');
    expect(out).toContain('2 GIVN Ayu Lestari');
    expect(out).toContain('2 DATE 5 JUL 1980');
    expect(out).toContain('1 OCCU Dokter');
    // Everything not about I3 is untouched, including vendor tags and the odd "0  _PUBLISH" line.
    for (const keep of ['0  _PUBLISH', '1 _CUSTOM_HEADER keep me', '2 _PHOTO_RIN MH:P1', '2 PEDI birth', '3 CITY Malang', '2 PLAC Surabaya'])
      expect(out).toContain(keep);
    const removed = src.filter((l) => !out.includes(l));
    expect(removed.sort()).toEqual(['1 NAME Ayu //', '2 DATE 4 JUL 1980', '2 GIVN Ayu'].sort());
  });

  it('round-trips edits through re-import', () => {
    const edited = updatePerson(base, 'I1', {
      facts: 'Baris satu\nBaris dua ✓',
      deceased: false,
      surnameNow: 'Baru',
    });
    const again = importGedcom(exportGedcom(edited)).doc;
    expect(again.persons.I1.facts).toBe('Baris satu\nBaris dua ✓');
    expect(again.persons.I1.deceased).toBe(false);
    expect(again.persons.I1.surnameNow).toBe('Baru');
    expect(again.persons.I1.surnameAtBirth).toBe('Wijaya');
  });

  it('writes new relatives as INDI/FAM records with FAMC/FAMS pointers', () => {
    let d = addPartner(base, 'I3').doc;
    d = addChild(d, 'I3', { kind: 'withPartner', partnerId: 'I5' }).doc;
    d = addParents(importGedcom(exportGedcom(d)).doc, 'I5').doc;
    const again = importGedcom(exportGedcom(d)).doc;
    expect(again.order.length).toBe(8);
    expect(again.familyOrder.length).toBe(3);
    const fam = Object.values(again.families).find((f) => f.partners.includes('I3'))!;
    expect(fam.partners.sort()).toEqual(['I3', 'I5']);
    expect(fam.children).toEqual(['I6']);
    const parents = Object.values(again.families).find((f) => f.children.includes('I5'))!;
    expect(parents.partners.length).toBe(2);
    const text = exportGedcom(d);
    expect(text).toMatch(/0 @I3@ INDI[\s\S]*1 FAMC @F1@[\s\S]*1 FAMS @F2@/);
  });

  it('removes deleted people and their pointers', () => {
    const d = deletePerson(base, 'I4').doc;
    const out = exportGedcom(d);
    expect(out).not.toContain('@I4@');
    expect(importGedcom(out).doc.families.F1.children).toEqual(['I3']);
  });

  it('builds a valid GEDCOM from scratch for non-GEDCOM trees', () => {
    const { doc } = importGedcom(crlfBom);
    const fresh = { ...doc, gedcomSource: undefined };
    const text = exportGedcom(fresh);
    expect(text.startsWith('\uFEFF0 HEAD\r\n')).toBe(true);
    expect(text.trimEnd().endsWith('0 TRLR')).toBe(true);
    const re = importGedcom(text).doc;
    expect(re.order.length).toBe(4);
    expect(re.persons.I1.facts).toBe(doc.persons.I1.facts);
    expect(re.families.F1.children).toEqual(['I3', 'I4']);
  });
});

// ---------------------------------------------------------------------------
// Real MyHeritage export (local only; never committed). Skipped when absent.
// ---------------------------------------------------------------------------
const realPath = path.join(__dirname, '../../local-test-data/abdurrm2023.ged');
const hasReal = fs.existsSync(realPath);

describe.skipIf(!hasReal)('local MyHeritage GEDCOM (abdurrm2023.ged copy)', () => {
  const text = hasReal ? fs.readFileSync(realPath, 'utf8') : '';
  const { doc, stats } = hasReal ? importGedcom(text) : ({} as ReturnType<typeof importGedcom>);

  it('parses all individuals and families', () => {
    expect(stats.individuals).toBe(2336);
    expect(stats.families).toBe(658);
    expect(stats.media).toBe(133);
  });

  it('is byte-identical after an unedited round-trip', () => {
    expect(exportGedcom(doc)).toBe(text);
  });

  it('keeps every other line when one person is edited', () => {
    const id = doc.order[10];
    const edited = updatePerson(doc, id, { profession: 'Test profession ✓' });
    const out = exportGedcom(edited);
    const a = lines(text);
    const b = lines(out);
    expect(b.length).toBe(a.length + 1);
    expect(b.filter((l) => !a.includes(l))).toEqual(['1 OCCU Test profession ✓']);
    const re = importGedcom(out).doc;
    expect(re.persons[id].profession).toBe('Test profession ✓');
    expect(re.order.length).toBe(2336);
  });

  it('preserves relation counts', () => {
    const famc = (text.match(/\n1 FAMC /g) ?? []).length;
    const chil = Object.values(doc.families).reduce((n, f) => n + f.children.length, 0);
    expect(chil).toBe(famc);
  });
});
