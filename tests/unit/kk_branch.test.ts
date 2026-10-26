import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createDefaultTree } from '../../src/model/defaultTree';
import { emptyFields, type TreeDoc } from '../../src/model/types';
import { assignParents, childrenOf, linkPartner, parentsOf, partnersOf } from '../../src/model/relations';
import { exportBranch } from '../../src/model/exportBranch';
import { buildSambung, parseSambung } from '../../src/io/sambungFile';
import { exportGedcom, importGedcom } from '../../src/gedcom/gedcom';
import { exportGenealogyText } from '../../src/io/textExport';
import { computeLayout } from '../../src/layout/layout';
import { selectVisible } from '../../src/layout/visible';
import { parseKkTokens, withParentReferences, type KkToken } from '../../src/kk/parse';
import { applyKkDraft, candidates, initialChoice, type KkDraft } from '../../src/kk/review';

function family(): TreeDoc {
  const doc = createDefaultTree();
  doc.persons = Object.fromEntries(['Irjam','Child A','Child B','Grandchild','Outsider','Stepchild','Ancestor'].map((givenName, i) => [`I${i+1}`, { ...emptyFields(), id: `I${i+1}`, givenName }]));
  doc.order = Object.keys(doc.persons); doc.focusId = 'I1';
  doc.families = {
    F1: { id: 'F1', partners: ['I1'], children: ['I2','I3'] },
    F2: { id: 'F2', partners: ['I2','I5'], children: ['I4'] },
    F3: { id: 'F3', partners: ['I5'], children: ['I6'] },
    F4: { id: 'F4', partners: ['I7'], children: ['I1'] },
  }; doc.familyOrder = Object.keys(doc.families);
  return doc;
}
function draft(): KkDraft {
  const doc = createDefaultTree();
  const rows = withParentReferences([
    { key: '1:1', page: 1, row: 1, fields: { givenName: doc.persons.I1.givenName, nik: '0000000000000001', birthPlace: 'New place' }, fatherName: doc.persons.I2.givenName, motherName: doc.persons.I3.givenName },
    { key: '1:2', page: 1, row: 2, fields: { givenName: 'Sibling Demo', nik: '0000000000000002', birthDate: '2 FEB 2000' }, fatherName: doc.persons.I2.givenName, motherName: doc.persons.I3.givenName },
  ]);
  return { id: 'synthetic-hash', fileName: 'fictitious-kk.pdf', mime: 'application/pdf', anchorId: 'I1', anchorKey: '1:1', anchorConfirmed: true, rows,
    choices: Object.fromEntries(rows.map((r) => [r.key, initialChoice(doc,r,r.key === '1:1' ? 'I1' : r.key === '1:2' ? 'new' : r.fields.givenName === doc.persons.I2.givenName ? 'I2' : 'I3')])) };
}

describe('existing identity relationships', () => {
  it('links distant relatives without replacing their parent families; linking twice is idempotent', () => {
    const src = family();
    const next = linkPartner(src,'I3','I4').doc;
    expect(next.order).toEqual(src.order);
    expect(parentsOf(next,'I3')).toEqual(['I1']);
    expect(parentsOf(next,'I4')).toEqual(['I2','I5']);
    expect(partnersOf(next,'I3')).toEqual(['I4']);
    expect(linkPartner(next,'I4','I3').doc).toBe(next);
    expect(src.familyOrder).toHaveLength(4);
    const layout = computeLayout(next,selectVisible(next,'I1',-1,-1),{density:'normal',manual:false});
    expect(layout.nodes.size).toBe(next.order.length);
    const roundTrip = importGedcom(exportGedcom(next)).doc;
    expect(partnersOf(roundTrip,'I3')).toContain('I4');
  });
  it('rejects self marriage, missing identities and ancestry cycles without mutating the input', () => {
    const doc = family(); const original = JSON.stringify(doc);
    expect(() => linkPartner(doc,'I1','I1')).toThrow();
    expect(() => linkPartner(doc,'I1','missing')).toThrow();
    expect(() => assignParents(doc,'I1',['I4'])).toThrow();
    expect(JSON.stringify(doc)).toBe(original);
  });
  it('can fill a partial parent pair without changing a sibling parent family', () => {
    const src = family();
    const next = assignParents(src,'I3',['I1','I7']);
    expect(parentsOf(next,'I3')).toEqual(['I1','I7']);
    expect(parentsOf(next,'I2')).toEqual(['I1']);
    expect(parentsOf(src,'I3')).toEqual(['I1']);
  });
  it('does not turn a new spouse into the parent of existing children', () => {
    const src = family(), next = linkPartner(src,'I1','I5').doc;
    expect(parentsOf(next,'I2')).toEqual(['I1']);
    expect(parentsOf(next,'I3')).toEqual(['I1']);
    expect(childrenOf(next,'I5')).toEqual(['I4','I6']);
    expect(partnersOf(next,'I1')).toContain('I5');
  });
});

describe('closed descendant exports', () => {
  it('excludes ancestors, spouses and stepchildren by default and ignores collapsed view state', () => {
    const src = family(); src.collapsed.I1 = 'both';
    src.gedcomSource = 'SECRET OTHER FAMILY';
    src.persons.I2.nik = '0000000000000001';
    src.media.K1 = { id: 'K1', fileName: 'private.pdf', mime: 'application/pdf', sourcePath: '', available: true, document: true };
    const next = exportBranch(src,'I1');
    expect(next.order).toEqual(['I1','I2','I3','I4']);
    expect(next.persons.I2.nik).toBeUndefined();
    expect(next.gedcomSource).toBeUndefined();
    expect(next.media.K1).toBeUndefined();
    const text = exportGenealogyText(next,{focusId:'I1',ancestors:0,descendants:-1,includeFacts:true,includeIndex:true,includeAllFamilies:true});
    for (const secret of ['Outsider','Stepchild','Ancestor','SECRET']) expect(text).not.toContain(secret);
    const ged = exportGedcom(next);
    expect(ged).not.toContain('SECRET');
    expect(importGedcom(ged).doc.order).toEqual(next.order);
    expect(parseSambung(buildSambung(next,new Map())).doc.order).toEqual(next.order);
    expect(src.collapsed.I1).toBe('both');
  });
  it('includes partners only when requested and never follows their other children', () => {
    const doc = exportBranch(family(),'I1',{partners:true});
    expect(doc.order).toContain('I5'); expect(doc.order).not.toContain('I6');
    expect(childrenOf(doc,'I5')).toEqual(['I4']);
  });
  it('deduplicates a person reached via two cousin branches', () => {
    let src = family(); src = linkPartner(src,'I3','I4').doc;
    src.persons.I8 = { ...emptyFields(),id:'I8',givenName:'Shared child' }; src.order.push('I8');
    src = assignParents(src,'I8',['I3','I4']);
    const next = exportBranch(src,'I1');
    expect(next.order.filter((id) => id === 'I8')).toHaveLength(1);
  });
  it('only includes original documents through explicit private export and backup options', () => {
    const doc = family();
    doc.media.K1 = { id:'K1', fileName:'fake.pdf', mime:'application/pdf', sourcePath:'', available:true, document:true };
    doc.kkSources = { sample:{id:'sample',fileName:'fake.pdf',anchorId:'I1',importedAt:'2026-01-01',mediaId:'K1',claims:[{personId:'I1',page:1,row:1,fields:{givenName:'Irjam'},fatherId:'I7'}]} };
    const bytes = new Map([['K1',new Uint8Array([1,2,3])]]);
    const restricted = exportBranch(doc,'I1');
    expect(restricted.kkSources).toEqual({});
    const privateBranch = exportBranch(doc,'I1',{privateData:true});
    expect(privateBranch.kkSources!.sample.claims[0].fatherId).toBeUndefined();
    expect(parseSambung(buildSambung(privateBranch,bytes)).doc.media.K1.available).toBe(false);
    const saved = parseSambung(buildSambung(privateBranch,bytes,{includeDocuments:true}));
    expect(saved.media.get('K1')).toEqual(bytes.get('K1'));
  });
});

describe('KK reading and reviewed identity updates', () => {
  it('joins tables by row numbers and deduplicates repeated parent mentions', () => {
    const token = (text:string,x:number,y:number,w=.07):KkToken => ({text,x,y,w,h:.01});
    const tokens = [token('1',.02,.25),token('Demo Child',.06,.25,.15),token('0000000000000001',.3,.25),token('LAKI-LAKI',.43,.25),token('MALANG',.53,.25),token('02-02-2000',.62,.25),token('Ayah',.65,.5),token('Ibu',.85,.5),token('1',.02,.55),token('Demo Father',.56,.55),token('Demo Mother',.77,.55)];
    const rows = parseKkTokens(tokens,1);
    expect(rows[0].fields.givenName).toBe('Demo Child');
    expect(rows[0].fields.birthDate).toBe('2 FEB 2000');
    expect(rows[0].fatherName).toBe('Demo Father');
    expect(rows[0].motherName).toBe('Demo Mother');
    expect(withParentReferences([...rows,{...rows[0],key:'1:2',row:2}])).toHaveLength(4);
  });
  it('prioritizes family context; equal names do not suppress NIK conflicts', () => {
    const doc = family(); doc.persons.I2.nik = '0000000000000001';
    const row = { key:'r',page:1,row:1,fields:{givenName:'Child A',nik:'0000000000000002'},fatherName:'',motherName:'' };
    expect(candidates(doc,row,'I1')[0]).toMatchObject({id:'I2',conflict:true});
    expect(candidates(doc,{...row,fields:{givenName:'Stepchild'}},'I1').some((c) => c.id === 'I6')).toBe(false);
    expect(candidates(doc,{...row,fields:{givenName:'Stepchild'}},'I1',true).some((c) => c.id === 'I6')).toBe(true);
  });
  it('updates confirmed family identities and adds a sibling with shared existing parents without duplication', () => {
    const doc = createDefaultTree(); const d = draft();
    const next = applyKkDraft(doc,d);
    expect(next.order).toHaveLength(4);
    expect(parentsOf(next,next.order[3])).toEqual(['I2','I3']);
    expect(next.persons.I1.birthPlace).toBe(doc.persons.I1.birthPlace); // conflict unchecked
    expect(next.persons.I1.nik).toBe('0000000000000001');
    expect(next.kkSources![d.id].claims).toHaveLength(4);
    expect(applyKkDraft(next,d).order).toEqual(next.order);
    expect(doc.order).toHaveLength(3);
    expect(parseSambung(buildSambung(next,new Map())).doc.kkSources).toEqual(next.kkSources);
    expect(importGedcom(exportGedcom(next)).doc.persons.I1.nik).toBe('0000000000000001');
  });
  it('requires the anchor confirmation and rejects duplicate NIK atomically', () => {
    const doc = createDefaultTree(); const d = draft();
    expect(() => applyKkDraft(doc,{...d,anchorConfirmed:false})).toThrow();
    d.rows[1].fields.nik = d.rows[0].fields.nik;
    expect(() => applyKkDraft(doc,d)).toThrow();
    expect(doc.order).toHaveLength(3); expect(doc.kkSources).toBeUndefined();
  });
  it('only links a KK spouse to its confirmed household head after an explicit relationship choice', () => {
    const doc = createDefaultTree(), d = draft();
    d.rows[0].householdRole = 'KEPALA KELUARGA'; d.rows[1].householdRole = 'ISTRI';
    expect(partnersOf(applyKkDraft(doc,d),'I1')).toHaveLength(0);
    d.choices[d.rows[1].key].partner = true;
    expect(partnersOf(applyKkDraft(doc,d),'I1')).toHaveLength(1);
  });
  it('does not read the KK number as a member and joins split NIK cells', () => {
    const token = (text:string,x:number,y:number,w=.04):KkToken => ({text,x,y,w,h:.01});
    const tokens = [token('No.',.10,.07),token('0000000000000099',.30,.07),token('NIK',.3,.2),token('1',.02,.25),token('Demo',.06,.25),token('00000000',.30,.25),token('00000001',.35,.25),token('02-02-2000',.62,.25),token('Ayah',.65,.5),token('Ibu',.85,.5)];
    const rows = parseKkTokens(tokens,1);
    expect(rows).toHaveLength(1); expect(rows[0].fields.nik).toBe('0000000000000001');
  });
  it('rejects reviewed parent cycles without exposing partial updates', () => {
    const doc = createDefaultTree(); const d = draft();
    const fatherRow = d.rows.find((r) => r.referenceOnly && d.choices[r.key].target === 'I2')!;
    fatherRow.referenceOnly = false; fatherRow.fatherName = doc.persons.I1.givenName;
    d.choices[fatherRow.key].parents = true;
    expect(() => applyKkDraft(doc,d)).toThrow(); expect(doc.order).toHaveLength(3);
  });
  it('requires explicit parent disambiguation when two confirmed people share a name', () => {
    const doc = createDefaultTree(), d = draft();
    const father = d.rows.find((r) => d.choices[r.key].target === 'I2')!;
    const duplicate = { ...father, key:'separate-father-mention', fields:{...father.fields} };
    d.rows.push(duplicate); d.choices[duplicate.key] = initialChoice(doc,duplicate,'new');
    expect(() => applyKkDraft(doc,d)).toThrow();
    d.choices['1:2'].fatherKey = father.key;
    const next = applyKkDraft(doc,d);
    expect(next.order).toHaveLength(5);
    expect(parentsOf(next,'I4')).toEqual(['I2','I3']);
  });
});
