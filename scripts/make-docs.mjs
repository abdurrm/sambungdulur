// Generates the screenshots used in docs/PANDUAN.md.
// Drives the production build (vite preview on :4173) with the locally installed Edge,
// using only synthetic data (docs/demo/keluarga-contoh.ged and a generated avatar).
// Numbered markers are drawn into the page just before each capture, so the PNGs carry
// the same annotations the guide describes.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const IMG = path.join(root, 'docs/img');
const DEMO = path.join(root, 'docs/demo');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/';
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(DEMO, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((r) => {
      const q = indexedDB.deleteDatabase('sambungdulur');
      q.onsuccess = q.onerror = q.onblocked = () => r();
    });
  });
  await page.reload();
  await page.getByTestId('tree-canvas').waitFor();
  await page.waitForTimeout(500);
  return { ctx, page };
}

/** Draws numbered markers + outlines over the given locators, captures, then removes them. */
async function shot(page, name, marks = [], opts = {}) {
  const boxes = [];
  for (const m of marks) {
    const b = await m.loc.first().boundingBox();
    if (!b) {
      console.warn(`  ! no box for marker ${m.n} in ${name}`);
      continue;
    }
    boxes.push({ n: m.n, pos: m.pos || 'tl', outline: m.outline !== false, ...b });
  }
  await page.evaluate((boxes) => {
    const layer = document.createElement('div');
    layer.id = 'sd-annotations';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    for (const b of boxes) {
      if (b.outline) {
        const o = document.createElement('div');
        o.style.cssText = `position:absolute;left:${b.x - 3}px;top:${b.y - 3}px;width:${b.width + 6}px;height:${b.height + 6}px;border:2.5px solid #e11d48;border-radius:10px;box-shadow:0 0 0 2px rgba(255,255,255,.85)`;
        layer.appendChild(o);
      }
      const c = document.createElement('div');
      const left = b.pos === 'tr' ? b.x + b.width - 14 : b.pos === 'tc' ? b.x + b.width / 2 - 13 : b.pos === 'bl' ? b.x - 13 : b.x - 13;
      const top = b.pos === 'bl' ? b.y + b.height - 13 : b.y - 13;
      c.textContent = String(b.n);
      c.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:26px;height:26px;border-radius:50%;background:#e11d48;color:#fff;font:700 14px/26px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff,0 2px 6px rgba(0,0,0,.35)`;
      layer.appendChild(c);
    }
    document.body.appendChild(layer);
  }, boxes);
  await page.screenshot({ path: path.join(IMG, `${name}.png`), ...opts });
  await page.evaluate(() => document.getElementById('sd-annotations')?.remove());
  console.log('shot', name);
}

const card = (page, name) => page.locator('g.person', { hasText: name }).first();
const tid = (page, id) => page.getByTestId(id);
async function pickCard(page, name) {
  await card(page, name).locator('.card-bg').click({ position: { x: 24, y: 24 } });
  await page.waitForTimeout(250);
}
async function importDemo(page) {
  await tid(page, 'btn-open').click();
  await tid(page, 'open-file-input').setInputFiles(path.join(DEMO, 'keluarga-contoh.ged'));
  await tid(page, 'open-report').waitFor();
}

// A synthetic avatar (no real photo): gradient + initials, generated in the browser.
async function makeAvatar(page, file) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 600;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 600, 600);
    g.addColorStop(0, '#38bdf8');
    g.addColorStop(1, '#6366f1');
    x.fillStyle = g;
    x.fillRect(0, 0, 600, 600);
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.arc(300, 235, 95, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.ellipse(300, 520, 190, 150, 0, Math.PI, 0);
    x.fill();
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------------------
// Part A: starter tree
// ---------------------------------------------------------------------------
{
  const { ctx, page } = await newPage();
  await shot(page, '01-ikhtisar', [
    { loc: tid(page, 'sidebar'), n: 1 },
    { loc: tid(page, 'btn-open'), n: 2 },
    { loc: tid(page, 'btn-save'), n: 3 },
    { loc: tid(page, 'btn-export'), n: 4 },
    { loc: tid(page, 'btn-search'), n: 5 },
    { loc: tid(page, 'gen-control'), n: 6 },
    { loc: tid(page, 'btn-settings'), n: 7 },
    { loc: tid(page, 'btn-manual'), n: 8 },
    { loc: card(page, 'Saya'), n: 9 },
    { loc: page.locator('.zoom-controls'), n: 10, pos: 'tl' },
    { loc: tid(page, 'btn-help'), n: 11 },
  ]);

  // Edit person
  await tid(page, 'edit-person').click();
  await tid(page, 'f-given').fill('Dimas');
  await tid(page, 'f-surname-now').fill('Santoso');
  await tid(page, 'f-dob-day').selectOption('14');
  await tid(page, 'f-dob-month').selectOption('2');
  await tid(page, 'f-dob-year').selectOption('1985');
  await shot(page, '02-ubah-data', [
    { loc: tid(page, 'tab-personal'), n: 1 },
    { loc: tid(page, 'f-given'), n: 2 },
    { loc: tid(page, 'f-surname-now'), n: 3 },
    { loc: tid(page, 'f-gender-male'), n: 4 },
    { loc: tid(page, 'f-dob-day'), n: 5 },
    { loc: tid(page, 'f-deceased'), n: 6 },
    { loc: tid(page, 'f-save'), n: 7 },
  ]);
  await tid(page, 'tab-biography').click();
  await tid(page, 'f-place').fill('Indonesia');
  await tid(page, 'f-profession').fill('Arsitek');
  await tid(page, 'f-facts').fill('Gemar mendaki gunung dan memotret.');
  await shot(page, '03-ubah-biografi', [
    { loc: tid(page, 'tab-biography'), n: 1 },
    { loc: tid(page, 'f-place'), n: 2 },
    { loc: tid(page, 'f-profession'), n: 3 },
    { loc: tid(page, 'f-facts'), n: 4 },
    { loc: tid(page, 'f-save'), n: 5 },
  ]);
  await tid(page, 'f-save').click();
  await tid(page, 'tab-personal').click();
  await page.waitForTimeout(300);
  await shot(page, '04-hasil-ubah', [
    { loc: tid(page, 'selected-name'), n: 1 },
    { loc: tid(page, 'personal-table'), n: 2 },
    { loc: card(page, 'Dimas'), n: 3 },
  ]);

  // Add relatives
  await tid(page, 'add-partner').click();
  await page.waitForTimeout(400);
  await pickCard(page, 'Dimas');
  await shot(page, '05-tambah-kerabat', [
    { loc: tid(page, 'add-parents'), n: 1 },
    { loc: tid(page, 'add-sibling'), n: 2 },
    { loc: tid(page, 'add-partner'), n: 3 },
    { loc: tid(page, 'add-child'), n: 4 },
    { loc: card(page, 'Pasangan dari Dimas'), n: 5 },
  ]);
  await tid(page, 'add-child').click();
  await shot(page, '06-dialog-anak', [
    { loc: page.locator('.choice').nth(0), n: 1 },
    { loc: page.locator('.choice').nth(1), n: 2 },
    { loc: page.locator('.choice').nth(2), n: 3 },
    { loc: tid(page, 'add-child-submit'), n: 4 },
  ]);
  await tid(page, 'add-child-submit').click();
  await page.waitForTimeout(500);
  await shot(page, '07-anak-ditambah', [{ loc: card(page, 'Anak dari Dimas'), n: 1 }, { loc: tid(page, 'selected-name'), n: 2 }]);

  // Photo
  await pickCard(page, 'Dimas');
  await tid(page, 'tab-image').click();
  const avatar = path.join(DEMO, 'foto-contoh.png');
  await makeAvatar(page, avatar);
  await tid(page, 'upload-image').setInputFiles(avatar);
  await tid(page, 'crop-dialog').waitFor();
  await page.waitForTimeout(300);
  await shot(page, '08-potong-foto', [
    { loc: page.locator('.crop-stage'), n: 1 },
    { loc: page.locator('.crop-stage ~ label input, .modal input[type=range]'), n: 2 },
    { loc: tid(page, 'crop-apply'), n: 3 },
  ]);
  await tid(page, 'crop-apply').click();
  await page.waitForTimeout(700);
  await shot(page, '09-foto-terpasang', [{ loc: card(page, 'Dimas').locator('circle.ring'), n: 1 }, { loc: tid(page, 'delete-image'), n: 2 }]);

  // Delete rules
  await pickCard(page, 'Dimas');
  await tid(page, 'delete-person').click();
  await page.waitForTimeout(200);
  await shot(page, '10-hapus-ditolak', [{ loc: tid(page, 'message-dialog'), n: 1 }]);
  await tid(page, 'message-ok').click();
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Part B: imported demo family
// ---------------------------------------------------------------------------
{
  const { ctx, page } = await newPage();
  await tid(page, 'btn-open').click();
  await page.waitForTimeout(250);
  await shot(page, '11-dialog-buka', [
    { loc: page.locator('.choice').nth(0), n: 1 },
    { loc: page.locator('.choice').nth(1), n: 2 },
    { loc: page.locator('.choice').nth(3), n: 3 },
  ]);
  await tid(page, 'open-file-input').setInputFiles(path.join(DEMO, 'keluarga-contoh.ged'));
  await tid(page, 'open-report').waitFor();
  await shot(page, '12-laporan-impor', [{ loc: tid(page, 'open-report'), n: 1 }]);
  await tid(page, 'open-close').click();
  await page.waitForTimeout(900);
  await pickCard(page, 'Dimas');
  await shot(page, '13-pohon-lengkap', [
    { loc: card(page, 'Hadi'), n: 1 },
    { loc: card(page, 'Dimas'), n: 2 },
    { loc: card(page, 'Naura'), n: 3 },
    { loc: page.locator('.view-info'), n: 4 },
  ]);

  // Generations: 1 up / 1 down around Dimas
  await tid(page, 'focus-person').click();
  for (let i = 0; i < 11; i++) await tid(page, 'gen-up-minus').click();
  await tid(page, 'gen-up-plus').click();
  for (let i = 0; i < 11; i++) await tid(page, 'gen-down-minus').click();
  await tid(page, 'gen-down-plus').click();
  await page.waitForTimeout(700);
  await shot(page, '14-kontrol-generasi', [
    { loc: tid(page, 'gen-control'), n: 1 },
    { loc: tid(page, 'gen-up-value'), n: 2 },
    { loc: tid(page, 'gen-down-value'), n: 3 },
    { loc: page.locator('.view-info'), n: 4 },
    { loc: card(page, 'Dimas'), n: 5 },
  ]);
  // back to All
  for (let i = 0; i < 11; i++) await tid(page, 'gen-up-plus').click();
  for (let i = 0; i < 11; i++) await tid(page, 'gen-down-plus').click();
  await page.waitForTimeout(500);

  // Search
  await tid(page, 'btn-search').click();
  await tid(page, 'search-input').fill('mal');
  await page.waitForTimeout(300);
  await shot(page, '15-pencarian', [
    { loc: tid(page, 'search-input'), n: 1 },
    { loc: tid(page, 'search-count'), n: 2, pos: 'tr' },
    { loc: page.locator('.search-results'), n: 3 },
  ]);
  await tid(page, 'search-input').fill('naura');
  await tid(page, 'search-input').press('Enter');
  await page.waitForTimeout(800);
  await shot(page, '16-hasil-cari', [{ loc: card(page, 'Naura'), n: 1 }, { loc: tid(page, 'selected-name'), n: 2 }]);

  // Settings
  await tid(page, 'btn-settings').click();
  await tid(page, 'set-date-format').selectOption('DD.MM.YYYY');
  await tid(page, 'set-profession').check();
  await tid(page, 'set-tree-style').selectOption('framed');
  await page.waitForTimeout(400);
  await shot(page, '17-pengaturan-pohon', [
    { loc: tid(page, 'set-date-format'), n: 1 },
    { loc: tid(page, 'set-font-size'), n: 2 },
    { loc: tid(page, 'set-tree-style'), n: 3 },
    { loc: tid(page, 'set-profession'), n: 4 },
    { loc: tid(page, 'set-theme-dark'), n: 5 },
    { loc: tid(page, 'settings-menu').getByTestId('lang-select'), n: 6 },
    { loc: tid(page, 'set-trace'), n: 7 },
  ]);
  // Dark + lineage animation highlight
  await tid(page, 'set-theme-dark').click();
  await tid(page, 'set-tree-style').selectOption('plain');
  await tid(page, 'set-trace').check();
  await page.keyboard.press('Escape'); // closes the settings popover
  await page.waitForTimeout(200);
  await pickCard(page, 'Dimas');
  await page.waitForTimeout(600);
  await shot(page, '18-tema-gelap', [{ loc: card(page, 'Dimas'), n: 1 }, { loc: page.locator('circle.ring[data-gender=female]').first(), n: 2 }]);
  await tid(page, 'btn-theme').click();
  await page.waitForTimeout(300);

  // Manual layout
  await tid(page, 'btn-center').click();
  await page.waitForTimeout(700);
  await tid(page, 'btn-manual').click();
  await page.waitForTimeout(600);
  await shot(page, '19-info-manual', [{ loc: tid(page, 'manual-info'), n: 1 }]);
  await page.waitForTimeout(3200);
  await tid(page, 'manual-continue').click();
  await page.waitForTimeout(500);
  const handle = card(page, 'Fajar').locator('.move-handle rect');
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 90, hb.y + hb.height / 2, { steps: 8 });
  await page.mouse.up();
  await shot(page, '20-mode-manual', [
    { loc: card(page, 'Fajar').locator('.move-handle'), n: 1 },
    { loc: page.locator('.control-point').first(), n: 2, outline: false },
    { loc: tid(page, 'manual-save'), n: 3 },
    { loc: tid(page, 'manual-cancel'), n: 4 },
  ]);
  await tid(page, 'manual-save').click();
  await page.waitForTimeout(400);

  // Export (wait for the manual-layout toast to disappear first)
  await page.waitForTimeout(3500);
  await tid(page, 'btn-export').click();
  await page.waitForTimeout(250);
  await shot(page, '21-dialog-ekspor', [
    { loc: tid(page, 'export-kind-png'), n: 1 },
    { loc: tid(page, 'export-kind-ged'), n: 2 },
    { loc: tid(page, 'export-kind-txt'), n: 3 },
    { loc: tid(page, 'export-scope-view'), n: 4 },
    { loc: tid(page, 'export-density-compact'), n: 5 },
    { loc: tid(page, 'export-run'), n: 6 },
  ]);
  await tid(page, 'export-scope-all').click();
  for (const d of ['compact', 'normal', 'detailed']) {
    await tid(page, `export-density-${d}`).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), tid(page, 'export-run').click()]);
    fs.copyFileSync(await dl.path(), path.join(IMG, `ekspor-${d}.png`));
    console.log('export', d);
    await tid(page, 'btn-export').click();
    await tid(page, 'export-kind-png').click();
    await tid(page, 'export-scope-all').click();
  }
  await tid(page, 'export-kind-txt').click();
  const [txt] = await Promise.all([page.waitForEvent('download'), tid(page, 'export-run').click()]);
  fs.copyFileSync(await txt.path(), path.join(DEMO, 'contoh-dokumen-silsilah.txt'));
  await tid(page, 'btn-export').click();
  await tid(page, 'export-kind-ged').click();
  const [ged] = await Promise.all([page.waitForEvent('download'), tid(page, 'export-run').click()]);
  fs.copyFileSync(await ged.path(), path.join(DEMO, 'contoh-ekspor.ged'));
  // Save as .sambung so the status chip reads 'tersimpan'
  const [saved] = await Promise.all([page.waitForEvent('download'), tid(page, 'btn-save').click()]);
  await saved.path();
  await page.waitForTimeout(500);
  await shot(page, '22-simpan-selesai', [{ loc: page.locator('.status-chip'), n: 1 }, { loc: tid(page, 'toast'), n: 2 }]);

  // Bahasa Jawa
  await tid(page, 'btn-settings').click();
  await tid(page, 'settings-menu').getByTestId('lang-select').selectOption('jv');
  await page.waitForTimeout(500);
  await shot(page, '23-bahasa-jawa', [{ loc: tid(page, 'settings-menu').getByTestId('lang-select'), n: 1 }, { loc: tid(page, 'btn-open'), n: 2 }, { loc: tid(page, 'sidebar'), n: 3 }]);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Part C: mobile
// ---------------------------------------------------------------------------
{
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tid(page, 'btn-open').tap();
  await tid(page, 'open-file-input').setInputFiles(path.join(DEMO, 'keluarga-contoh.ged'));
  await tid(page, 'open-report').waitFor();
  await tid(page, 'open-close').tap();
  await page.waitForTimeout(900);
  const tapCard = async (name) => {
    await card(page, name).locator('.card-bg').tap({ force: true }); // small scale: text overlays the hit point
    await page.waitForTimeout(500);
  };
  // Re-root on Dimas, then limit to 1 generation each way so the cards are readable on a phone.
  await tapCard('Dimas');
  await tid(page, 'focus-person').tap();
  await page.locator('.sidebar-grip').tap();
  await tid(page, 'btn-more').tap();
  const more = tid(page, 'more-menu');
  for (let i = 0; i < 11; i++) await more.getByTestId('gen-up-minus').tap();
  await more.getByTestId('gen-up-plus').tap();
  for (let i = 0; i < 11; i++) await more.getByTestId('gen-down-minus').tap();
  await more.getByTestId('gen-down-plus').tap();
  await shot(page, '26-mobile-menu', [
    { loc: more.getByTestId('gen-control'), n: 1 },
    { loc: more.getByTestId('lang-select'), n: 2 },
    { loc: more.getByRole('button', { name: 'Tata Letak Manual' }), n: 3 },
    { loc: more.getByRole('button', { name: 'Tema gelap' }), n: 4 },
  ]);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  await shot(page, '24-mobile-pohon', [
    { loc: tid(page, 'btn-open'), n: 1 },
    { loc: tid(page, 'btn-more'), n: 2 },
    { loc: page.locator('.sidebar-grip'), n: 3 },
    { loc: page.locator('.zoom-controls'), n: 4 },
    { loc: page.locator('.view-info'), n: 5 },
  ]);
  await page.locator('.sidebar-grip').tap();
  await page.waitForTimeout(500);
  await page.locator('.sidebar-body').evaluate((e) => (e.scrollTop = 0));
  await page.waitForTimeout(200);
  await shot(page, '25-mobile-editor', [{ loc: tid(page, 'sidebar'), n: 1 }, { loc: tid(page, 'edit-person'), n: 2 }, { loc: page.locator('.sidebar-grip'), n: 3 }]);
  await ctx.close();
}

await browser.close();
console.log('done');
