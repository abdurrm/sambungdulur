// Records the demo video: drives the real app (production build on :4173) with Edge,
// pacing every action to the narration sentences, then muxes the Andika narration.
//
//   node scripts/video/record.mjs            full recording + mux  -> docs/video/*
//   DRY=1 node scripts/video/record.mjs      fast selector check, no recording
//
// Needs: temp/video/audio/<scene>.wav from scripts/video/tts.ps1, ffmpeg/ffprobe on PATH.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const DRY = !!process.env.DRY;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const TMP = path.join(root, 'temp/video');
const AUDIO = path.join(TMP, 'audio');
const REC = path.join(TMP, 'rec');
const OUT = path.join(root, 'docs/video');
const DEMO = path.join(root, 'docs/demo/keluarga-contoh.ged');
const AVATAR = path.join(root, 'docs/demo/foto-contoh.png');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'scripts/video/scenes.json'), 'utf8'));
const scenes = cfg.scenes.map((s) => ({
  ...s,
  dur: Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(AUDIO, `${s.id}.wav`)]).toString().trim()),
}));
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(REC, { recursive: true, force: true });

const SLOW = DRY ? 0.35 : 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SLOW));

// ---------------------------------------------------------------------------
// In-page overlay: cursor, click ripple, highlight ring, caption bar
// ---------------------------------------------------------------------------
const overlay = `(() => {
  const isStage = location.pathname.endsWith('/__stage');
  const top = window.top === window;
  const boot = () => {
    if (document.getElementById('sd-ov')) return;
    const st = document.createElement('style');
    st.id = 'sd-ov';
    st.textContent = \`
      #sd-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:transform .42s cubic-bezier(.22,.9,.3,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
      .sd-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #e11d48;animation:sd-rip .55s ease-out forwards}
      @keyframes sd-rip{to{transform:scale(4.2);opacity:0}}
      #sd-ring{position:fixed;z-index:2147483645;pointer-events:none;border:3px solid #e11d48;border-radius:12px;box-shadow:0 0 0 3px rgba(255,255,255,.85),0 0 22px rgba(225,29,72,.45);transition:all .25s ease;opacity:0}
      #sd-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483644;pointer-events:none;max-width:86%;text-align:center;background:rgba(15,23,42,.9);color:#fff;font:600 27px/1.3 system-ui,'Segoe UI',sans-serif;padding:12px 26px;border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.35);transition:opacity .3s}\`;
    document.head.appendChild(st);
    if (!(isStage && top)) {
      const c = document.createElement('div');
      c.id = 'sd-cursor';
      c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L9 19z" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.appendChild(c);
      document.addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
      document.addEventListener('mousedown', (e) => {
        const r = document.createElement('div');
        r.className = 'sd-ripple';
        r.style.left = e.clientX + 'px';
        r.style.top = e.clientY + 'px';
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 650);
      }, true);
    }
    if (top) {
      const ring = document.createElement('div'); ring.id = 'sd-ring'; document.body.appendChild(ring);
      const cap = document.createElement('div'); cap.id = 'sd-cap'; cap.style.opacity = 0; document.body.appendChild(cap);
      window.__sdRing = (b) => {
        const r = document.getElementById('sd-ring');
        if (!b) { r.style.opacity = 0; return; }
        r.style.left = (b.x - 6) + 'px'; r.style.top = (b.y - 6) + 'px';
        r.style.width = (b.width + 12) + 'px'; r.style.height = (b.height + 12) + 'px'; r.style.opacity = 1;
      };
      window.__sdCap = (t) => { const e = document.getElementById('sd-cap'); e.textContent = t; e.style.opacity = t ? 1 : 0; };
    }
  };
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();`;

const stageHtml = `<!doctype html><html><head><meta charset="utf-8"><title>stage</title>
<style>
  html,body{margin:0;height:100%;background:radial-gradient(circle at 30% 20%,#1e293b,#020617);font-family:system-ui,'Segoe UI',sans-serif;color:#e2e8f0;overflow:hidden}
  .wrap{height:100%;display:flex;align-items:center;justify-content:center;gap:90px}
  .phone{width:390px;height:844px;border:11px solid #0b0f19;border-radius:46px;box-shadow:0 0 0 2px #334155,0 30px 80px rgba(0,0,0,.6);overflow:hidden;background:#fff;flex:none}
  iframe{width:390px;height:844px;border:0;display:block}
  .txt{max-width:520px}.txt h1{font-size:54px;margin:0 0 18px;letter-spacing:-.02em}.txt li{font-size:28px;line-height:1.7;list-style:none;padding-left:0}
  .txt li::before{content:'✓ ';color:#34d399}
</style></head><body><div class="wrap">
  <div class="txt"><h1>Di ponsel</h1><ul style="padding:0;margin:0"><li>Panel bawah untuk mengubah data</li><li>Cubit untuk zoom</li><li>Dapat dipasang sebagai aplikasi</li><li>Berjalan tanpa internet</li></ul></div>
  <div class="phone"><iframe src="/" title="app"></iframe></div>
</div></body></html>`;

// ---------------------------------------------------------------------------
// Browser, helpers
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({
  // The screencast is captured at CSS-pixel size, so the viewport IS the video resolution.
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  serviceWorkers: 'block', // page.route must see the synthetic /__stage page
  acceptDownloads: true,
  ...(DRY ? {} : { recordVideo: { dir: REC, size: { width: 1920, height: 1080 } } }),
});
await ctx.addInitScript({ content: overlay });
const page = await ctx.newPage();
ctx.on('page', (p) => {
  if (p !== page) p.close().catch(() => {});
});
const t0 = Date.now();
page.on('dialog', (d) => d.dismiss());
await page.route('**/__stage', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: stageHtml }));

const tid = (id) => page.getByTestId(id).first();
const card = (name) => page.locator('g.person', { hasText: name }).first();

async function boxOf(loc) {
  const b = await loc.first().boundingBox();
  if (!b) throw new Error('no bounding box for ' + loc);
  return b;
}
async function glide(loc, dx = 0, dy = 0) {
  const b = await boxOf(loc);
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 2 });
  await sleep(470);
  return b;
}
async function click(loc, dx = 0, dy = 0) {
  await glide(loc, dx, dy);
  await page.mouse.down();
  await sleep(70);
  await page.mouse.up();
  await sleep(380);
}
async function ring(loc, ms = 1300) {
  const b = await boxOf(loc);
  await page.evaluate((x) => window.__sdRing && window.__sdRing(x), b);
  await sleep(ms);
  await page.evaluate(() => window.__sdRing && window.__sdRing(null));
}
const caption = (text) => page.evaluate((t) => window.__sdCap && window.__sdCap(t), text);
async function type(loc, text) {
  await click(loc);
  await loc.first().fill('');
  await loc.first().pressSequentially(text, { delay: DRY ? 0 : 75 });
  await sleep(300);
}
async function pick(loc, value) {
  await glide(loc);
  await loc.first().selectOption(value);
  await sleep(450);
}

const timeline = [];
const sentenceSplit = (s) => s.split(/(?<=[.?!])\s+/).filter(Boolean);

async function scene(sc, fn) {
  const start = Date.now() - t0;
  const sents = sentenceSplit(sc.speak);
  const chars = sents.map((s) => s.length);
  const total = chars.reduce((a, b) => a + b, 0);
  const startsFrac = chars.map((_, i) => chars.slice(0, i).reduce((a, b) => a + b, 0) / total);
  const audioStart = start + 350;
  const S = {
    /** Wait until sentence i of the narration starts (relative to this scene's audio). */
    sent: async (i) => {
      const target = audioStart + startsFrac[i] * sc.dur * 1000;
      const wait = target - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
    },
  };
  await caption(sc.caption);
  console.log(`> ${sc.id} (${sc.dur.toFixed(1)}s, ${sents.length} sentences)`);
  try {
    await fn(S);
  } catch (e) {
    await page.screenshot({ path: path.join(TMP, `fail-${sc.id}.png`) }).catch(() => {});
    throw e;
  }
  const end = audioStart + sc.dur * 1000 + 700;
  const left = end - (Date.now() - t0);
  if (left > 0) await sleep(left);
  else if (!DRY) console.warn(`  ! ${sc.id}: actions overran narration by ${(-left / 1000).toFixed(1)}s`);
  timeline.push({ id: sc.id, start: audioStart / 1000, dur: sc.dur, sents: sents.length, startsFrac, text: sc.text });
}
const byId = (id) => scenes.find((s) => s.id === id);

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
await page.goto(BASE);
await page.getByTestId('tree-canvas').waitFor();
await sleep(1000);

await scene(byId('01-pembuka'), async (S) => {
  await S.sent(0);
  await page.mouse.move(800, 420, { steps: 2 });
  await sleep(1200);
  await S.sent(1);
  await ring(page.locator('.brand'), 2200);
  await glide(card('Saya'), 90, 0);
});

await scene(byId('02-layar'), async (S) => {
  await S.sent(1);
  await ring(tid('sidebar'), 2400);
  await S.sent(2);
  for (const id of ['btn-open', 'btn-save', 'btn-export', 'btn-search', 'btn-settings']) {
    await glide(tid(id));
    await ring(tid(id), 1000);
  }
  await S.sent(3);
  await glide(card('Ayah Saya').locator('circle.ring'));
  await ring(card('Ayah Saya').locator('circle.ring'), 1700);
  await glide(card('Ibu Saya').locator('circle.ring'));
  await ring(card('Ibu Saya').locator('circle.ring'), 1700);
  await ring(page.locator('.view-info'), 1500);
});

await scene(byId('03-ubah-tambah'), async (S) => {
  await S.sent(0);
  await click(card('Saya'));
  await click(tid('edit-person'));
  await type(tid('f-given'), 'Dimas');
  await type(tid('f-surname-now'), 'Santoso');
  await pick(tid('f-dob-day'), '14');
  await pick(tid('f-dob-month'), '2');
  await pick(tid('f-dob-year'), '1985');
  await click(tid('f-save'));
  await S.sent(1);
  await ring(card('Dimas'), 1500);
  await S.sent(2);
  for (const id of ['add-parents', 'add-sibling']) {
    await glide(tid(id));
    await ring(tid(id), 900);
  }
  await click(tid('add-partner'));
  await S.sent(3);
  await click(card('Dimas'));
  await click(tid('add-child'));
  for (let i = 0; i < 3; i++) await ring(page.locator('.choice').nth(i), 1300);
  await click(tid('add-child-submit'));
});

await scene(byId('04-foto'), async (S) => {
  await S.sent(0);
  await click(card('Dimas'));
  await click(tid('tab-image'));
  await glide(page.locator('label.btn', { hasText: 'Unggah gambar' }));
  await tid('upload-image').setInputFiles(AVATAR);
  await tid('crop-dialog').waitFor();
  await sleep(1500);
  await S.sent(1);
  await click(tid('crop-apply'));
  await sleep(900);
  await click(tid('tab-personal'));
});

await scene(byId('05-impor'), async (S) => {
  await S.sent(0);
  await click(tid('btn-open'));
  await S.sent(1);
  await glide(page.locator('.choice').nth(0));
  await tid('open-file-input').setInputFiles(DEMO);
  await tid('open-report').waitFor();
  await S.sent(2);
  await ring(tid('open-report'), 2600);
  await S.sent(3);
  await click(tid('open-close'));
  await sleep(1800);
});

await scene(byId('06-generasi-cari'), async (S) => {
  await S.sent(0);
  await click(card('Dimas'));
  await click(tid('focus-person'));
  await S.sent(1);
  await glide(tid('gen-up-minus'));
  for (let i = 0; i < 11; i++) await tid('gen-up-minus').click();
  await tid('gen-up-plus').click();
  await glide(tid('gen-down-minus'));
  for (let i = 0; i < 11; i++) await tid('gen-down-minus').click();
  await tid('gen-down-plus').click();
  await ring(page.locator('.view-info'), 1500);
  await S.sent(2);
  await page.keyboard.press('Control+f');
  await sleep(500);
  await tid('search-input').pressSequentially('naura', { delay: DRY ? 0 : 130 });
  await sleep(900);
  await page.keyboard.press('Enter');
  await sleep(1500);
});

await scene(byId('07-tampilan'), async (S) => {
  await S.sent(0);
  // back to the whole family so every card is visible again
  await glide(tid('gen-up-plus'));
  for (let i = 0; i < 11; i++) await tid('gen-up-plus').click();
  for (let i = 0; i < 11; i++) await tid('gen-down-plus').click();
  await click(tid('btn-center'));
  await click(tid('btn-settings'));
  await pick(tid('set-date-format'), 'DD.MM.YYYY');
  await pick(tid('set-tree-style'), 'framed');
  await click(tid('set-theme-dark'));
  await sleep(500);
  await click(page.getByRole('button', { name: 'Tutup' }));
  await S.sent(1);
  await click(tid('btn-manual'));
  await tid('manual-continue').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid=manual-continue]')?.disabled, null, { timeout: 8000 });
  await click(tid('manual-continue'));
  await sleep(500);
  const handle = card('Rina').locator('.move-handle rect');
  const hb = await boxOf(handle);
  await glide(handle);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(hb.x + hb.width / 2 + i * 6, hb.y + hb.height / 2, { steps: 1 });
    await sleep(40);
  }
  await page.mouse.up();
  await sleep(500);
  await click(tid('manual-save'));
  await click(tid('btn-theme'));
});

await scene(byId('08-simpan-ekspor'), async (S) => {
  await S.sent(0);
  await click(tid('btn-save'));
  await sleep(1500);
  await S.sent(1);
  await click(tid('btn-export'));
  await click(tid('export-kind-ged'));
  await S.sent(2);
  await click(tid('export-kind-png'));
  await click(tid('export-density-compact'));
  await sleep(600);
  await click(tid('export-density-normal'));
  await sleep(600);
  await click(tid('export-density-detailed'));
  await S.sent(3);
  await click(tid('export-kind-txt'));
  await sleep(900);
  await click(tid('export-run'));
  await sleep(900);
});

await scene(byId('09-bahasa-ponsel'), async (S) => {
  await S.sent(0);
  await click(tid('btn-settings'));
  const lang = page.getByTestId('settings-menu').getByTestId('lang-select');
  await pick(lang, 'jv');
  await sleep(650);
  await pick(lang, 'en');
  await sleep(650);
  await pick(lang, 'id');
  await click(page.getByRole('button', { name: 'Tutup' }));
  await S.sent(1);
  await sleep(700); // let autosave flush before the phone frame loads the stored tree
  await page.goto(BASE + '__stage');
  await caption(byId('09-bahasa-ponsel').caption);
  const frame = page.frameLocator('iframe');
  await frame.getByTestId('tree-canvas').waitFor();
  await sleep(900);
  // The phone menu: show only 1 generation each way so the cards are readable on a small screen.
  await click(frame.getByTestId('btn-more'));
  const more = frame.getByTestId('more-menu');
  for (let i = 0; i < 11; i++) await more.getByTestId('gen-up-minus').click();
  await more.getByTestId('gen-up-plus').click();
  for (let i = 0; i < 11; i++) await more.getByTestId('gen-down-minus').click();
  await more.getByTestId('gen-down-plus').click();
  await sleep(700);
  await page.keyboard.press('Escape');
  await sleep(1000);
  const dims = frame.locator('g.person', { hasText: 'Dimas' }).first().locator('.card-bg');
  await glide(dims);
  await page.mouse.down();
  await sleep(70);
  await page.mouse.up();
  await sleep(1500);
});

await scene(byId('10-penutup'), async (S) => {
  await S.sent(0);
  await page.goto(BASE);
  await page.getByTestId('tree-canvas').waitFor();
  await caption(byId('10-penutup').caption);
  await sleep(1500);
  await S.sent(2);
  await glide(tid('btn-help'));
  await ring(tid('btn-help'), 1800);
  await click(tid('btn-settings'));
  await ring(tid('link-source'), 2000);
  await S.sent(3);
  await click(page.getByRole('button', { name: 'Tutup' }));
});

await caption('');
await sleep(700);
await ctx.close();
await browser.close();
if (DRY) {
  console.log('DRY run finished (no video).');
  process.exit(0);
}

// Timeline for the muxer, then narration + subtitles + poster.
fs.writeFileSync(path.join(TMP, 'timeline.json'), JSON.stringify(timeline, null, 2));
execFileSync('node', [path.join(root, 'scripts/video/mux.mjs')], { stdio: 'inherit' });
