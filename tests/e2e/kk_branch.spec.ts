import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { kkPdf, kkTree } from '../fixtures/kkFixture';
import AxeBuilder from '@axe-core/playwright';

async function start(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('sambungdulur.lang','en'); localStorage.setItem('sambungdulur.onboarded','1'); });
  await page.goto('/'); await expect(page.getByTestId('tree-canvas')).toBeVisible();
  await page.getByTestId('btn-open').click();
  await page.getByTestId('open-file-input').setInputFiles({name:'fictitious.ged',mimeType:'text/plain',buffer:Buffer.from(kkTree)});
  await expect(page.getByTestId('open-report')).toBeVisible(); await page.getByTestId('open-close').click();
  await page.locator('g.person').filter({hasText:'Root Demo'}).first().click();
}
async function openKk(page: Page) {
  await page.getByTestId('btn-open').click(); await page.getByTestId('open-import-kk').click();
  await expect(page.getByTestId('kk-dialog')).toBeVisible();
}

test('existing relatives can marry without duplicate identities; descendant exports isolate the selected branch', async ({page}) => {
  await start(page);
  await page.getByTestId('add-partner').click(); await page.getByTestId('partner-existing').check();
  await page.getByTestId('partner-person').selectOption('I4'); await page.getByTestId('add-partner-submit').click();
  await expect(page.locator('g.person')).toHaveCount(4);
  await page.getByTestId('btn-export').click(); await page.getByTestId('export-kind-txt').click();
  await page.getByTestId('export-scope-branch').click(); await page.getByTestId('export-branch-root').selectOption('I1');
  await expect(page.getByTestId('export-branch-count')).toContainText('1 people');
  const [download] = await Promise.all([page.waitForEvent('download'),page.getByTestId('export-run').click()]);
  const text = fs.readFileSync((await download.path())!,'utf8');
  expect(text).toContain('Root Demo'); expect(text).not.toContain('Father Demo'); expect(text).not.toContain('Mother Demo'); expect(text).not.toContain('Sibling Demo');
  for (const kind of ['ged','svg','png','jpeg']) {
    await page.getByTestId('btn-export').click(); await page.getByTestId(`export-kind-${kind}`).click();
    await page.getByTestId('export-scope-branch').click(); await page.getByTestId('export-branch-root').selectOption('I1');
    const [file] = await Promise.all([page.waitForEvent('download'),page.getByTestId('export-run').click()]);
    const bytes = fs.readFileSync((await file.path())!);
    if (kind === 'ged' || kind === 'svg') { expect(bytes.toString()).toContain('Root Demo'); expect(bytes.toString()).not.toContain('Father Demo'); expect(bytes.toString()).not.toContain('Sibling Demo'); }
    else if (kind === 'png') expect([...bytes.subarray(0,4)]).toEqual([137,80,78,71]);
    else expect([...bytes.subarray(0,2)]).toEqual([255,216]);
  }
  await page.getByTestId('btn-export').click(); await page.getByTestId('export-kind-sambung').click(); await page.getByTestId('export-scope-branch').click();
  await page.getByTestId('export-branch-root').selectOption('I1'); await page.getByTestId('export-branch-partners').check();
  const [copy] = await Promise.all([page.waitForEvent('download'),page.getByTestId('export-run').click()]);
  const archive = unzipSync(fs.readFileSync((await copy.path())!));
  const doc = JSON.parse(strFromU8(archive['tree.json']));
  expect(doc.order).toEqual(['I1','I4']); expect(archive['source.ged']).toBeUndefined();
  await expect(page.locator('g.person')).toHaveCount(4);
});

test('KK PDF stays local, anchors matching, updates a sibling, saves source options and supports undo', async ({page}) => {
  await start(page);
  const external: string[] = [];
  page.on('request',(r) => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== 'http://127.0.0.1:4173') external.push(r.url()); });
  await openKk(page);
  await page.getByTestId('kk-file-input').setInputFiles([{name:'fictitious-kk.pdf',mimeType:'application/pdf',buffer:kkPdf()},{name:'second-reference.pdf',mimeType:'application/pdf',buffer:kkPdf()}]);
  await page.getByTestId('kk-read').click();
  await expect(page.getByTestId('kk-row')).toHaveCount(4);
  await expect(page.getByTestId('kk-apply')).toBeDisabled();
  const rows = page.getByTestId('kk-row');
  await rows.nth(1).getByTestId('kk-match').selectOption('I4');
  await rows.nth(2).getByTestId('kk-match').selectOption('I2');
  await rows.nth(3).getByTestId('kk-match').selectOption('I3');
  await page.getByTestId('kk-confirm-anchor').check();
  await expect(page.getByTestId('kk-summary')).toContainText('0 new people');
  await expect(page.getByTestId('kk-apply')).toBeEnabled();
  await page.getByTestId('kk-apply').click();
  await expect(page.getByTestId('kk-row')).toHaveCount(0);
  await expect(page.getByTestId('kk-dialog')).toContainText('2/2');
  await page.getByTestId('kk-anchor').selectOption('I4'); await page.getByTestId('kk-read').click();
  await expect(page.getByTestId('kk-anchor-row')).toHaveValue('1:2');
  await expect(page.getByTestId('kk-summary')).toContainText('0 new people');
  await page.getByTestId('kk-dialog').getByRole('button',{name:'Close',exact:true}).first().click();
  await expect(page.locator('g.person')).toHaveCount(4);
  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('save-options')).toBeVisible();
  const [saved] = await Promise.all([page.waitForEvent('download'),page.getByTestId('save-options-submit').click()]);
  let archive = unzipSync(fs.readFileSync((await saved.path())!));
  const doc = JSON.parse(strFromU8(archive['tree.json']));
  expect(doc.persons.I1.birthPlace).toBe('Original City');
  expect(doc.persons.I4.birthDate).toBe('2 FEB 2000');
  expect(doc.persons.I1.nik).toBe('0000000000000001');
  expect(Object.keys(doc.kkSources)).toHaveLength(1);
  expect(Object.keys(archive).some((key) => key.endsWith('.pdf'))).toBe(false);
  await page.getByTestId('btn-save').click(); await page.getByTestId('save-originals').check();
  const [full] = await Promise.all([page.waitForEvent('download'),page.getByTestId('save-options-submit').click()]);
  archive = unzipSync(fs.readFileSync((await full.path())!));
  expect(Object.keys(archive).some((key) => key.endsWith('.pdf'))).toBe(true);
  await openKk(page);
  await page.getByTestId('kk-file-input').setInputFiles({name:'same-again.pdf',mimeType:'application/pdf',buffer:kkPdf()});
  await page.getByTestId('kk-read').click(); await expect(page.getByTestId('kk-resume')).toBeVisible();
  await expect(page.getByTestId('kk-summary')).toContainText('0 new people');
  await page.getByTestId('kk-dialog').getByRole('button',{name:'Close',exact:true}).first().click();
  await page.getByTestId('tree-canvas').focus(); await page.keyboard.press('Control+z');
  await openKk(page); await expect(page.getByText('Saved KK references',{exact:true})).toHaveCount(0);
  expect(external).toEqual([]);
});

test('scanned KK uses bundled local OCR and allows rotation correction', async ({page}) => {
  test.setTimeout(120000);
  await start(page); await openKk(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  const external: string[] = [];
  page.on('request',(r) => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== 'http://127.0.0.1:4173') external.push(r.url()); });
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1400;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0,0,2400,1400); ctx.fillStyle = 'black'; ctx.font = '26px Arial';
    const put = (text:string,x:number,y:number) => ctx.fillText(text,x,y);
    put('KARTU KELUARGA - DATA FIKTIF',600,100);
    put('Nama Lengkap',140,240); put('NIK',720,240); put('Jenis Kelamin',1040,240); put('Tanggal Lahir',1530,240);
    put('1',48,350); put('Root Demo',140,350); put('0000000000000001',720,350); put('LAKI-LAKI',1040,350); put('04-07-1994',1530,350);
    put('Ayah',1560,740); put('Ibu',2040,740); put('1',48,850); put('Father Demo',1344,850); put('Mother Demo',1848,850);
    const sideways = document.createElement('canvas'); sideways.width = canvas.height; sideways.height = canvas.width;
    const out = sideways.getContext('2d')!; out.translate(sideways.width/2,sideways.height/2); out.rotate(Math.PI/2); out.drawImage(canvas,-canvas.width/2,-canvas.height/2);
    return sideways.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('kk-file-input').setInputFiles({name:'fictitious-scan.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.getByTestId('kk-rotation').selectOption('270');
  await page.getByTestId('kk-read').click();
  await expect(page.getByTestId('kk-row').first()).toBeVisible({timeout:90000});
  await expect(page.getByTestId('kk-row').first().getByLabel('First name')).toHaveValue(/Root Demo/i);
  expect(external).toEqual([]);
});

test('reviewed additional fields remain editable and duplicate NIK cannot be saved', async ({page}) => {
  await start(page);
  await page.getByTestId('edit-person').click(); await page.getByTestId('tab-biography').click();
  await page.getByTestId('f-nik').fill('0000000000000001'); await page.getByTestId('f-save').click();
  await page.keyboard.press('Escape'); // dismiss the editor pop-up before choosing a card beneath it
  await page.locator('g.person').filter({hasText:'Sibling Demo'}).first().click();
  await page.getByTestId('edit-person').click(); await page.getByTestId('tab-biography').click(); await page.getByTestId('f-nik').fill('0000000000000001'); await page.getByTestId('f-save').click();
  await expect(page.getByRole('alert')).toContainText('already belongs');
  await page.getByTestId('f-nik').fill('0000000000000002'); await page.getByTestId('f-education').fill('University Demo'); await page.getByTestId('f-save').click();
  const [download] = await Promise.all([page.waitForEvent('download'),page.getByTestId('btn-save').click()]);
  const doc = JSON.parse(strFromU8(unzipSync(fs.readFileSync((await download.path())!))['tree.json']));
  expect(doc.persons.I4.education).toBe('University Demo'); expect(doc.persons.I4.nik).toBe('0000000000000002');
});

test('KK review and branch export fit touch screens and have no serious accessibility violations @mobile', async ({page}) => {
  await start(page); await openKk(page);
  await page.getByTestId('kk-file-input').setInputFiles({name:'fictitious-kk.pdf',mimeType:'application/pdf',buffer:kkPdf()});
  await page.getByTestId('kk-read').click(); await expect(page.getByTestId('kk-row')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  const violations = (await new AxeBuilder({page}).include('[data-testid="kk-dialog"]').analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(violations).toEqual([]);
  await page.getByTestId('kk-dialog').getByRole('button',{name:'Close',exact:true}).first().click();
  await page.getByTestId('btn-export').click(); await page.getByTestId('export-scope-branch').click();
  await expect(page.getByTestId('export-branch-count')).toContainText('Root Demo');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});
