/** Entirely fictitious KK-shaped document, generated without private source data. */
export function kkPdf(): Buffer {
  const tokens: [string,number,number][] = [
    ['KARTU KELUARGA - DATA FIKTIF',300,650],
    ['Nama Lengkap',60,565],['NIK',300,565],['Jenis Kelamin',430,565],['Tempat Lahir',540,565],['Tanggal Lahir',640,565],['Agama',725,565],['Pendidikan',795,565],['Pekerjaan',880,565],
    ['1',20,525],['Root Demo',60,525],['0000000000000001',300,525],['LAKI-LAKI',430,525],['Kota Baru',540,525],['04-07-1994',640,525],['ISLAM',725,525],['SMA',795,525],['GURU',880,525],
    ['2',20,500],['Sibling Demo',60,500],['0000000000000002',300,500],['PEREMPUAN',430,500],['Kota Demo',540,500],['02-02-2000',640,500],['ISLAM',725,500],['SMA',795,500],['DOKTER',880,500],
    ['Nama Orang Tua',620,390],['Ayah',650,365],['Ibu',850,365],
    ['1',20,325],['WNI',300,325],['Father Demo',560,325],['Mother Demo',770,325],
    ['2',20,300],['WNI',300,300],['Father Demo',560,300],['Mother Demo',770,300],
  ];
  const stream = tokens.map(([text,x,y]) => `BT /F1 10 Tf ${x} ${y} Td (${text}) Tj ET`).join('\n');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 700] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj,i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export const kkTree = `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Root Demo
1 SEX M
1 BIRT
2 PLAC Original City
1 FAMC @F1@
0 @I2@ INDI
1 NAME Father Demo
1 SEX M
1 FAMS @F1@
0 @I3@ INDI
1 NAME Mother Demo
1 SEX F
1 FAMS @F1@
0 @I4@ INDI
1 NAME Sibling Demo
1 SEX F
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
1 CHIL @I4@
0 TRLR
`;
