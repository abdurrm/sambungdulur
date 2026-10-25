import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const fixture = path.resolve('tests/fixtures/synthetic.ged');

async function fresh(page: Page, lang: 'en' | 'id' | 'jv' | null = 'en', opts: { onboarding?: boolean } = {}) {
  // The first-visit tips are covered by their own test; elsewhere they would only sit on top of the canvas.
  if (!opts.onboarding) await page.addInitScript(() => localStorage.setItem('sambungdulur.onboarded', '1'));
  // Every test runs in a new browser context, so storage starts empty. Most tests assert English labels
  // (the Indonesian default is covered separately): pick the language before the app first loads, so the
  // starter tree is created in it. A language chosen later in the test (settings, localStorage) is kept.
  if (lang) {
    await page.addInitScript((l) => {
      if (!localStorage.getItem('sambungdulur.lang')) localStorage.setItem('sambungdulur.lang', l);
    }, lang);
  }
  await page.goto('/');
  await expect(page.getByTestId('tree-canvas')).toBeVisible();
}

async function setLangViaSettings(page: Page, lang: string) {
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('settings-menu').getByTestId('lang-select').selectOption(lang);
  await page.keyboard.press('Escape');
}

const persons = (page: Page) => page.locator('g.person');
const card = (page: Page, name: string) => page.locator('g.person', { hasText: name }).first();

async function importFile(page: Page, file: string) {
  await page.getByTestId('btn-open').click();
  await page.getByTestId('open-file-input').setInputFiles(file);
  await expect(page.getByTestId('open-report')).toBeVisible();
  await page.getByTestId('open-close').click();
}

test.describe('family tree editor', () => {
  test.beforeEach(async ({ page }) => fresh(page));

  test('starts with the three-person tree and gender-coloured photo rings', async ({ page }) => {
    await expect(persons(page)).toHaveCount(3);
    await expect(page.getByTestId('selected-name')).toHaveText('Me');
    const rings = await page.locator('circle.ring').evaluateAll((els) => els.map((e) => [e.getAttribute('data-gender'), e.getAttribute('stroke')]));
    const male = rings.filter((r) => r[0] === 'male').map((r) => r[1]);
    const female = rings.filter((r) => r[0] === 'female').map((r) => r[1]);
    expect(new Set(male).size).toBe(1);
    expect(female.length).toBe(1);
    expect(male[0]).not.toBe(female[0]);
    await expect(page.getByTestId('add-parents')).toBeDisabled();
  });

  test('adds relatives, edits a person and enforces delete rules', async ({ page }) => {
    await page.getByTestId('add-sibling').click();
    await expect(persons(page)).toHaveCount(4);
    await expect(page.getByTestId('selected-name')).toHaveText('Sibling of Me');

    await card(page, 'Me').locator('.card-bg').click({ position: { x: 20, y: 20 } });
    await page.getByTestId('add-partner').click();
    await expect(persons(page)).toHaveCount(5);
    const partnerName = await page.getByTestId('selected-name').textContent();
    expect(partnerName).toBe('Partner of Me');

    // Add child with the existing partner via the dialog.
    await page.getByTestId('add-child').click();
    await expect(page.getByTestId('add-child-dialog')).toContainText('Add child with Me');
    await page.getByTestId('add-child-submit').click();
    await expect(persons(page)).toHaveCount(6);

    // Edit the child (Personal + Biography tabs).
    await page.getByTestId('edit-person').click();
    await page.getByTestId('f-given').fill('Ayu Lestari ✓');
    await page.getByTestId('f-gender-female').check();
    await page.getByTestId('f-dob-day').selectOption('5');
    await page.getByTestId('f-dob-month').selectOption('3');
    await page.getByTestId('f-dob-year').selectOption('2020');
    await page.getByTestId('tab-biography').click();
    await page.getByTestId('f-profession').fill('Pelajar');
    await page.getByTestId('f-save').click();
    await expect(page.getByTestId('selected-name')).toHaveText('Ayu Lestari ✓');
    await expect(card(page, 'Ayu Lestari ✓')).toContainText('03/05/2020');
    await expect(card(page, 'Ayu Lestari ✓').locator('circle.ring')).toHaveAttribute('data-gender', 'female');

    // "Partner of Me" now links the child to the tree: deleting "Me" would split it.
    await card(page, 'Me').locator('.card-bg').click({ position: { x: 20, y: 20 } });
    await page.getByTestId('delete-person').click();
    await expect(page.getByTestId('message-dialog')).toContainText('split');
    await page.getByTestId('message-ok').click();

    // A leaf can be deleted after confirmation.
    await card(page, 'Sibling of Me').locator('.card-bg').click({ position: { x: 20, y: 20 } });
    await page.getByTestId('delete-person').click();
    await page.getByTestId('confirm-ok').click();
    await expect(persons(page)).toHaveCount(5);

    // Persistence: reload keeps everything.
    await page.waitForTimeout(700);
    await page.reload();
    await expect(persons(page)).toHaveCount(5);
    await expect(card(page, 'Ayu Lestari ✓')).toBeVisible();
  });

  test('tree settings change the cards', async ({ page }) => {
    await page.getByTestId('btn-settings').click();
    await page.getByTestId('set-date-format').selectOption('DD.MM.YYYY');
    await expect(card(page, 'Me')).toContainText('04.07.1994');
    await page.getByTestId('set-date-format').selectOption('YYYY');
    await expect(card(page, 'Me')).toContainText('1994');
    await page.getByTestId('set-font-size').selectOption('large');
    await expect(page.getByTestId('set-facts')).toBeDisabled();
    await page.getByTestId('set-dob').uncheck();
    await expect(page.getByTestId('set-dod')).not.toBeChecked();
    await page.getByTestId('set-theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('imports GEDCOM, searches, limits generations and exports GEDCOM losslessly', async ({ page }) => {
    await importFile(page, fixture);
    await expect(page.getByTestId('view-info')).toContainText('4/4 shown');

    // Search by partial, accent-insensitive name.
    await page.getByTestId('btn-search').click();
    await page.getByTestId('search-input').fill('siti');
    await expect(page.getByTestId('search-count')).toContainText('1 match');
    await page.getByTestId('search-hit-I2').click();
    await expect(page.getByTestId('selected-name')).toHaveText('Siti Aminah');

    // Generation control: focus on Budi (I1) and hide descendants.
    await page.getByTestId('btn-search').click();
    await page.getByTestId('search-input').fill('budi');
    await page.getByTestId('search-input').press('Enter');
    await page.getByTestId('focus-person').click();
    await page.getByTestId('gen-down-minus').click(); // All -> 10
    for (let i = 0; i < 10; i++) await page.getByTestId('gen-down-minus').click();
    await expect(page.getByTestId('gen-down-value')).toHaveText('0');
    await expect(page.getByTestId('view-info')).toContainText('2/4 shown');
    await page.getByTestId('gen-down-plus').click();
    await expect(page.getByTestId('view-info')).toContainText('4/4 shown');

    // Edit one field and export.
    await page.getByTestId('edit-person').click();
    await page.getByTestId('tab-biography').click();
    await page.getByTestId('f-profession').fill('Kepala Sekolah');
    await page.getByTestId('f-save').click();
    await page.getByTestId('btn-export').click();
    await page.getByTestId('export-kind-ged').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    const out = fs.readFileSync((await dl.path())!, 'utf8');
    const src = fs.readFileSync(fixture, 'utf8');
    expect(out).toContain('1 OCCU Kepala Sekolah');
    expect(out).not.toContain('1 OCCU Guru');
    const changed = out.split('\n').filter((l) => !src.split('\n').includes(l));
    expect(changed).toEqual(['1 OCCU Kepala Sekolah']);
  });

  test('saves a .sambung file and reopens it after reset', async ({ page }) => {
    await page.getByTestId('add-sibling').click();
    await page.getByTestId('tree-title').fill('Keluarga Uji');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('btn-save').click()]);
    expect(dl.suggestedFilename()).toBe('keluarga-uji.sambung');
    const saved = (await dl.path())!;
    await page.getByTestId('btn-reset').click();
    await page.getByTestId('confirm-ok').click();
    await expect(persons(page)).toHaveCount(3);
    await page.getByTestId('btn-open').click();
    await page.getByTestId('open-file-input').setInputFiles({ name: 'keluarga-uji.sambung', mimeType: 'application/zip', buffer: fs.readFileSync(saved) });
    await expect(page.getByTestId('open-report')).toContainText('People: 4');
    await page.getByTestId('open-close').click();
    await expect(persons(page)).toHaveCount(4);
    await expect(page.getByTestId('tree-title')).toHaveValue('Keluarga Uji');
  });

  test('exports PNG in compact, normal and detailed density, plus text and SVG', async ({ page }) => {
    const sizes: Record<string, { w: number; h: number }> = {};
    for (const d of ['compact', 'normal', 'detailed']) {
      await page.getByTestId('btn-export').click();
      await page.getByTestId('export-kind-png').click();
      await page.getByTestId(`export-density-${d}`).click();
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
      expect(dl.suggestedFilename()).toBe(`my-family-tree-${d}.png`);
      const buf = fs.readFileSync((await dl.path())!);
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      sizes[d] = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    expect(sizes.compact.w).toBeLessThan(sizes.normal.w);
    expect(sizes.normal.w).toBeLessThan(sizes.detailed.w);

    await page.getByTestId('btn-export').click();
    await page.getByTestId('export-kind-txt').click();
    const [txt] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    const text = fs.readFileSync((await txt.path())!, 'utf8');
    expect(text).toContain('ANCESTORS of Me');
    expect(text).toContain('2. My Father');
    expect(text).toContain('3. My Mother');

    await page.getByTestId('btn-export').click();
    await page.getByTestId('export-kind-svg').click();
    const [svg] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    expect(fs.readFileSync((await svg.path())!, 'utf8')).toContain('<svg');
  });

  test('manual layout moves a person and survives reload', async ({ page }) => {
    // The view settles first (fit, then room for the editor pop-up).
    const before = await stableBox(card(page, 'My Father').locator('.card-bg'));
    await page.getByTestId('btn-manual').click();
    await expect(page.getByTestId('manual-continue')).toBeDisabled();
    await expect(page.getByTestId('manual-continue')).toBeEnabled({ timeout: 6000 });
    await page.getByTestId('manual-continue').click();
    await expect(page.getByTestId('manual-save')).toBeDisabled();
    // The editor pop-up closes in manual layout; the canvas does not move.
    await expect(page.getByTestId('editor-popup')).toHaveCount(0);
    const handle = card(page, 'My Father').locator('.move-handle rect');
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 - 120, hb.y + hb.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.getByTestId('manual-save').click();
    const after = await card(page, 'My Father').locator('.card-bg').boundingBox();
    expect(after!.x).toBeLessThan(before!.x - 40);
    await page.waitForTimeout(700);
    await page.reload();
    const reloaded = await stableBox(card(page, 'My Father').locator('.card-bg'));
    expect(Math.abs(reloaded!.x - after!.x)).toBeLessThan(80);
  });

  test('zoom buttons respect limits and centre works', async ({ page }) => {
    const info = page.getByTestId('view-info');
    const pct = async () => +(/(\d+)%/.exec((await info.textContent())!)![1]);
    const start = await pct();
    await page.getByTestId('btn-zoom-in').click();
    await expect.poll(pct).toBeGreaterThan(start);
    for (let i = 0; i < 40; i++) {
      if (await page.getByTestId('btn-zoom-out').isDisabled()) break;
      await page.getByTestId('btn-zoom-out').click();
    }
    await expect.poll(pct).toBeLessThanOrEqual(6);
    await page.getByTestId('btn-center').click();
    await expect.poll(pct).toBeGreaterThan(20);
  });

  test('works offline as an installable PWA', async ({ page, context }) => {
    const manifest = await page.locator('link[rel=manifest]').getAttribute('href');
    const res = await page.request.get(new URL(manifest!, page.url()).toString());
    const json = await res.json();
    expect(json.display).toBe('standalone');
    expect(json.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(persons(page)).toHaveCount(3);
    await context.setOffline(false);
  });
});

test('mobile layout has no horizontal overflow and a bottom sheet editor @mobile', async ({ page }) => {
  await fresh(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Every toolbar button must be on screen (the title input yields space).
  for (const id of ['btn-open', 'btn-save', 'btn-export', 'btn-search', 'btn-more']) {
    await expect(page.getByTestId(id)).toBeEnabled(); // some menus load on demand
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.x, id).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, id).toBeLessThanOrEqual(390);
  }
  await card(page, 'My Mother').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await expect(page.getByTestId('selected-name')).toHaveText('My Mother');
  await expect(page.getByTestId('sidebar')).not.toHaveClass(/hidden/);
  await page.getByTestId('btn-more').tap();
  const menu = page.getByTestId('more-menu');
  await expect(menu).toBeVisible();
  // The overflow menu docks to the bottom of the screen and sits above the editor sheet.
  const mb = (await menu.boundingBox())!;
  expect(mb.y + mb.height).toBeGreaterThan(844 - 40);
  const onTop = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-testid="more-menu"]'), [mb.x + mb.width / 2, mb.y + mb.height - 20]);
  expect(onTop).toBe(true);
});

test('defaults to Indonesian and switches to Javanese and English', async ({ page }) => {
  await fresh(page, null);
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect(page.getByTestId('btn-open')).toContainText('Buka');
  await expect(page.getByTestId('selected-name')).toHaveText('Saya');
  await expect(card(page, 'Ayah Saya')).toContainText('l. 03/07/1965');
  await page.getByTestId('add-sibling').click();
  await expect(page.getByTestId('selected-name')).toHaveText('Saudara dari Saya');

  await setLangViaSettings(page, 'jv');
  await expect(page.locator('html')).toHaveAttribute('lang', 'jv');
  await expect(page.getByTestId('btn-open')).toContainText('Bukak');
  await expect(page.getByTestId('add-partner')).toContainText('Tambah bojo');
  await page.getByTestId('add-partner').click();
  await expect(page.getByTestId('selected-name')).toHaveText('Bojoné Saudara dari Saya');

  await setLangViaSettings(page, 'en');
  await expect(page.getByTestId('btn-open')).toContainText('Open');
  await page.reload();
  await expect(page.getByTestId('btn-open')).toContainText('Open');

  // Text export follows the language.
  await setLangViaSettings(page, 'id');
  await page.getByTestId('btn-export').click();
  await page.getByTestId('export-kind-txt').click();
  const [txt] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
  const text = fs.readFileSync((await txt.path())!, 'utf8');
  expect(text).toContain('SILSILAH KELUARGA');
  expect(text).toContain('LELUHUR');
  expect(text).toContain('Maret 1965');
});

test('a freshly imported tree is fitted into view', async ({ page }) => {
  await fresh(page);
  await importFile(page, path.resolve('docs/demo/keluarga-contoh.ged'));
  await expect(page.getByTestId('view-info')).toContainText('14/14');
  await page.waitForTimeout(700);
  const box = await page.getByTestId('tree-canvas').boundingBox();
  const cards = await persons(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  expect(cards.length).toBe(14);
  for (const c of cards) {
    expect(c.left).toBeGreaterThanOrEqual(box!.x - 1);
    expect(c.right).toBeLessThanOrEqual(box!.x + box!.width + 1);
    expect(c.top).toBeGreaterThanOrEqual(box!.y - 1);
    expect(c.bottom).toBeLessThanOrEqual(box!.y + box!.height + 1);
  }
});

test('help and source links point to the public repository', async ({ page }) => {
  await fresh(page);
  const help = page.getByTestId('btn-help');
  await expect(help).toHaveAttribute('href', 'https://github.com/abdurrm/sambungdulur/blob/main/docs/PANDUAN.md');
  await expect(help).toHaveAttribute('target', '_blank');
  await expect(help).toHaveAttribute('rel', /noopener/);
  // Still on screen at a typical laptop width (toolbar must not clip it).
  const b = (await help.boundingBox())!;
  expect(b.x + b.width).toBeLessThanOrEqual(1400);
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('link-source')).toHaveAttribute('href', 'https://github.com/abdurrm/sambungdulur');
});

test('header toolbar never overflows at common widths and in every language', async ({ page }) => {
  await fresh(page);
  for (const lang of ['id', 'jv', 'en']) {
    await page.evaluate((l) => localStorage.setItem('sambungdulur.lang', l), lang);
    await page.reload();
    await expect(page.getByTestId('tree-canvas')).toBeVisible();
    for (const width of [360, 390, 412, 768, 820, 1024, 1080, 1100, 1280, 1366, 1440, 1536, 1600, 1700, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = width <= 760 ? 'narrow' : width >= 1100 ? 'wide' : 'medium';
      await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
      await expect(page.getByTestId('status-chip'), 'save status visible at ' + width).toBeVisible();
      const m = await page.evaluate(() => {
        const bar = document.querySelector('.toolbar')!;
        const header = document.querySelector('.header')!;
        const last = [...bar.querySelectorAll('.tool-btn')].filter((b) => (b as HTMLElement).offsetParent).pop()!;
        return {
          over: Math.max(header.scrollWidth - header.clientWidth, bar.scrollWidth - bar.clientWidth),
          lastRight: last.getBoundingClientRect().right,
          vw: window.innerWidth,
        };
      });
      expect(m.over, 'header overflow at ' + width + ' (' + lang + ')').toBeLessThanOrEqual(1);
      expect(m.lastRight, 'last button at ' + width + ' (' + lang + ')').toBeLessThanOrEqual(m.vw);
    }
  }
});

test('dialogs trap focus, close with Escape and return focus to their trigger', async ({ page }) => {
  await fresh(page);
  const trigger = page.getByTestId('btn-export');
  await trigger.click();
  const dialog = page.getByTestId('export-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Export your family tree' })).toBeVisible();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement)), 'focus stays in dialog after Tab #' + i).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  // Dialogs opened from the editor return focus there too.
  await page.getByTestId('editor-popup').getByTestId('add-child').click();
  await expect(page.getByTestId('add-child-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('add-child-dialog')).toBeHidden();
  await expect(page.getByTestId('add-child')).toBeFocused();
});

test('header popovers and the overflow menu are keyboard friendly; reset is set apart', async ({ page }) => {
  await fresh(page);
  // Opening one header popup closes the other.
  await page.getByTestId('btn-search').click();
  await expect(page.getByTestId('search-panel')).toBeVisible();
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('settings-menu')).toBeVisible();
  await expect(page.getByTestId('search-panel')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-menu')).toBeHidden();
  await expect(page.getByTestId('btn-settings')).toBeFocused();

  // Medium width: secondary tools live in the overflow menu.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'medium');
  await expect(page.getByTestId('btn-theme')).toHaveCount(0);
  const more = page.getByTestId('btn-more');
  await expect(more).toBeEnabled(); // the menu module loads on demand
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('more-menu')).toBeVisible();
  // Arrow keys move through items; Enter runs one and closes the menu.
  // (The menu may still be settling when the first key arrives, so step until the item is reached.)
  await expect(async () => {
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('more-theme')).toHaveAttribute('data-highlighted', '', { timeout: 250 });
  }).toPass({ timeout: 5000 });
  const before = await page.locator('html').getAttribute('data-theme');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('more-menu')).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before!);
  await expect(more).toBeFocused();

  // Reset tree is separated from view settings and always asks first.
  await more.click();
  const reset = page.getByTestId('more-reset');
  await expect(reset).toHaveClass(/danger/);
  await expect(page.getByTestId('more-menu').locator('.danger-sep')).toHaveCount(1);
  await reset.click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-cancel').click();
  await expect(persons(page)).toHaveCount(3);
});

test('editor explains unavailable actions and its tabs follow the arrow keys', async ({ page }) => {
  await fresh(page);
  // "Me" already has parents: the button says why instead of silently greying out.
  const addParents = page.getByTestId('add-parents');
  await expect(addParents).toBeDisabled();
  await expect(page.getByTestId('add-parents-reason')).toHaveText('Parents already added');
  await expect(addParents).toHaveAccessibleDescription('Parents already added');

  await page.getByTestId('tab-personal').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('tab-biography')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('biography-table')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.getByTestId('tab-image')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('tab-personal')).toBeFocused();

  // Indonesian reason text.
  await setLangViaSettings(page, 'id');
  await expect(page.getByTestId('add-parents-reason')).toHaveText('Orang tua sudah ada');
});

test('starter hint names the editor where it really is on phones @mobile', async ({ page }) => {
  await fresh(page);
  await expect(card(page, 'Me')).toContainText('sheet');
  await expect(card(page, 'Me')).not.toContainText('left');
});

async function sheetTop(page: Page) {
  return (await page.getByTestId('sidebar').boundingBox())!.y;
}
async function expectAboveSheet(page: Page, name: string) {
  await expect
    .poll(async () => {
      const b = (await card(page, name).locator('.card-bg').boundingBox())!;
      return b.y + b.height <= (await sheetTop(page)) && b.y >= 0;
    }, { message: name + ' card is fully above the editor sheet' })
    .toBe(true);
}

test('the tapped person stays visible above the editor sheet @mobile', async ({ page }) => {
  await fresh(page);
  // "Me" sits at the bottom of the starter tree, exactly where the sheet opens.
  await card(page, 'Me').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await expect(page.getByTestId('sidebar')).not.toHaveClass(/hidden/);
  await expectAboveSheet(page, 'Me');

  // Search results are centred in the uncovered part of the canvas, not behind the sheet.
  await page.getByTestId('btn-search').tap();
  await page.getByTestId('search-input').fill('mother');
  await page.getByTestId('search-input').press('Enter');
  await expect(page.getByTestId('selected-name')).toHaveText('My Mother');
  await expectAboveSheet(page, 'My Mother');
});

async function stableBox(loc: ReturnType<Page['locator']>) {
  let last = '';
  await expect
    .poll(async () => {
      const b = (await loc.boundingBox())!;
      const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)}`;
      const still = key === last;
      last = key;
      return still;
    }, { intervals: [150] })
    .toBe(true);
  return (await loc.boundingBox())!;
}

async function dragSheet(page: Page, dy: number) {
  // Wait until the sheet has finished its snap animation before grabbing it.
  let last = -1;
  await expect
    .poll(async () => {
      const y = (await page.getByTestId('sheet-drag').boundingBox())!.y;
      const still = Math.abs(y - last) < 0.5;
      last = y;
      return still;
    }, { intervals: [120] })
    .toBe(true);
  const b = (await page.getByTestId('sheet-drag').boundingBox())!;
  const x = b.x + 30, y = b.y + 6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + (dy * i) / 10);
  await page.mouse.up();
}

test('the phone editor is a draggable sheet with bar, half and full heights @mobile', async ({ page }) => {
  await fresh(page);
  const sheet = page.getByTestId('sidebar');
  await expect(sheet).toHaveAttribute('data-snap', 'bar');

  // Tapping a card opens the half sheet with the add-relative actions in reach.
  await card(page, 'Me').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await expect(sheet).toHaveAttribute('data-snap', 'half');
  await expect(page.getByTestId('add-sibling')).toBeInViewport({ ratio: 1 });
  await expectAboveSheet(page, 'Me');

  // Dragging up reaches full height; dragging down steps back one point at a time.
  await dragSheet(page, -300);
  await expect(sheet).toHaveAttribute('data-snap', 'full');
  await dragSheet(page, 280);
  await expect(sheet).toHaveAttribute('data-snap', 'half');
  await dragSheet(page, 250);
  await expect(sheet).toHaveAttribute('data-snap', 'bar');

  // "Edit" opens the full sheet; the back button returns to half without leaving the app.
  await page.getByTestId('sheet-grip').tap();
  await expect(sheet).toHaveAttribute('data-snap', 'half');
  await page.getByTestId('edit-person').tap();
  await expect(sheet).toHaveAttribute('data-snap', 'full');
  await expect(page.getByTestId('edit-form')).toBeVisible();
  const url = page.url();
  await page.goBack();
  await expect(sheet).toHaveAttribute('data-snap', 'half');
  expect(page.url()).toBe(url);
  await expect(page.getByTestId('tree-canvas')).toBeVisible();

  // Tapping empty canvas collapses the sheet to its bar.
  await page.getByTestId('tree-canvas').tap({ position: { x: 20, y: 80 } });
  await expect(sheet).toHaveAttribute('data-snap', 'bar');
});

test('the back button closes a dialog on phones before leaving the app @mobile', async ({ page }) => {
  await fresh(page);
  await card(page, 'Me').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await page.getByTestId('add-child').tap();
  await expect(page.getByTestId('add-child-dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('add-child-dialog')).toBeHidden();
  await expect(page.getByTestId('tree-canvas')).toBeVisible();
  // Closing a dialog in-app removes its history entry again: no stale back steps pile up.
  await page.getByTestId('add-child').tap();
  await page.getByTestId('add-child-dialog').getByRole('button', { name: 'Cancel' }).tap();
  await expect(page.getByTestId('add-child-dialog')).toBeHidden();
  const len = await page.evaluate(() => history.length);
  await page.getByTestId('add-child').tap();
  await page.getByTestId('add-child-dialog').getByRole('button', { name: 'Cancel' }).tap();
  expect(await page.evaluate(() => history.length)).toBe(len);
});

test('on tablets the editor is a drawer over a full-width canvas', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await fresh(page);
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'medium');
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).toHaveClass(/hidden/);
  const canvasBox = (await page.getByTestId('tree-canvas').boundingBox())!;
  expect(canvasBox.width).toBeGreaterThan(810);

  // Picking a person opens the drawer, and the card is not hidden behind it.
  await card(page, 'My Father').locator('.card-bg').click({ position: { x: 20, y: 20 } });
  await expect(sidebar).not.toHaveClass(/hidden/);
  await expect(page.getByTestId('selected-name')).toHaveText('My Father');
  await expect
    .poll(async () => {
      const s = (await sidebar.boundingBox())!;
      const c = (await card(page, 'My Father').locator('.card-bg').boundingBox())!;
      return c.x >= s.x + s.width;
    })
    .toBe(true);
  // The canvas keeps its full width; Escape closes the drawer again.
  expect((await page.getByTestId('tree-canvas').boundingBox())!.width).toBeGreaterThan(810);
  await page.keyboard.press('Escape');
  await expect(sidebar).toHaveClass(/hidden/);
});

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('desktop: the editor is a pop-up beside the selected card over a full-width canvas', async ({ page }) => {
  await fresh(page);
  // No left panel: the canvas spans the viewport.
  await expect(page.locator('aside.sidebar')).toHaveCount(0);
  await expect(page.getByTestId('sidebar-toggle')).toHaveCount(0);
  expect((await page.getByTestId('tree-canvas').boundingBox())!.width).toBeGreaterThan(1390);
  // The starter tree no longer points to a left menu.
  await expect(card(page, 'Me')).not.toContainText('left');
  await expect(card(page, 'Me')).toContainText('editor');

  // Clicking a card opens a pop-up named after the person, next to (not over) the card.
  const father = card(page, 'My Father').locator('.card-bg');
  await stableBox(father);
  await father.click({ position: { x: 20, y: 20 }, force: true });
  const popup = page.getByRole('dialog', { name: 'Editor: My Father' });
  await expect(popup).toBeVisible();
  const pop = page.getByTestId('editor-popup');
  const cardBox = await stableBox(father);
  const popBox = await stableBox(pop);
  expect(overlaps(cardBox, popBox)).toBe(false);
  // It leaves the zoom buttons and the view info free.
  for (const id of ['btn-zoom-in', 'btn-zoom-out', 'btn-center', 'view-info']) {
    expect(overlaps(popBox, (await page.getByTestId(id).boundingBox())!), id).toBe(false);
  }

  // Panning the canvas carries the pop-up along with its card.
  const c = (await page.getByTestId('tree-canvas').boundingBox())!;
  await page.mouse.move(c.x + 40, c.y + 600);
  await page.mouse.down();
  // Sideways: the pop-up may already rest against the margin under the header.
  await page.mouse.move(c.x - 80, c.y + 600, { steps: 8 });
  await page.mouse.up();
  const card2 = await stableBox(father);
  const pop2 = await stableBox(pop);
  expect(Math.round(card2.x - cardBox.x)).toBe(-120);
  expect(Math.abs(pop2.x - popBox.x - (card2.x - cardBox.x)) + Math.abs(pop2.y - popBox.y - (card2.y - cardBox.y))).toBeLessThan(3);
  // A card panned off screen hides its pop-up; it comes back with the card.
  await page.mouse.move(c.x + 40, c.y + 600);
  await page.mouse.down();
  await page.mouse.move(c.x + 1300, c.y + 600, { steps: 10 });
  await page.mouse.up();
  await expect(pop).toBeHidden();
  await page.mouse.move(c.x + 1300, c.y + 600);
  await page.mouse.down();
  await page.mouse.move(c.x + 40, c.y + 600, { steps: 10 });
  await page.mouse.up();
  await expect(pop).toBeVisible();

  // Another card moves the pop-up there (the canvas stays clickable while it is open); Escape and the
  // empty canvas close it, and focus returns to the canvas.
  await card(page, 'Me').locator('.card-bg').click({ position: { x: 20, y: 20 } });
  await expect(page.getByRole('dialog', { name: 'Editor: Me' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
  await expect(page.getByTestId('tree-canvas')).toBeFocused();
  await card(page, 'My Mother').locator('.card-bg').click({ position: { x: 20, y: 20 }, force: true });
  await expect(pop).toBeVisible();
  await page.getByTestId('editor-close').click();
  await expect(pop).toHaveCount(0);
  // Clicking the (still selected) card again reopens it; its top-left corner holds the ⋯ button.
  await card(page, 'My Mother').locator('.card-bg').click({ position: { x: 100, y: 150 }, force: true });
  await expect(pop).toBeVisible();
  await page.getByTestId('tree-canvas').click({ position: { x: 40, y: 600 } });
  await expect(pop).toHaveCount(0);
  await expect(page.getByTestId('tree-canvas')).toBeFocused();
});

test('desktop pop-up: arrows move it without taking focus, Enter edits; closed in manual layout', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('dialog', { name: 'Editor: Me' })).toBeVisible();
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('dialog', { name: 'Editor: My Father' })).toBeVisible();
  await expect(page.getByTestId('tree-canvas')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Editor: My Mother' })).toBeVisible();
  await expect(page.getByTestId('tree-canvas')).toBeFocused();
  // Enter opens the form inside the pop-up with the first field focused; it scrolls when tall.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('edit-form')).toBeVisible();
  await expect(page.getByTestId('f-given')).toBeFocused();
  const pop = page.getByTestId('editor-popup');
  const box = (await pop.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(56);
  expect(box.y + box.height).toBeLessThanOrEqual(900);
  await page.getByTestId('f-given').fill('Mum');
  await page.getByTestId('f-save').click();
  await expect(page.getByRole('dialog', { name: 'Editor: Mum' })).toBeVisible();
  // Focus lands on "Edit" instead of being pulled back into the pop-up later.
  await expect(page.getByTestId('editor-popup').getByTestId('edit-person')).toBeFocused();
  await page.getByTestId('tree-canvas').focus();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('tree-canvas')).toBeFocused();

  // Toasts stay clear of the pop-up.
  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('toast')).toBeVisible();
  expect(overlaps((await pop.boundingBox())!, (await page.getByTestId('toast').boundingBox())!)).toBe(false);

  // Manual layout closes it, so the move handles stay free.
  await page.evaluate(() => localStorage.setItem('sambungdulur.manualInfoSeen', '1'));
  await page.getByTestId('btn-manual').click();
  await expect(page.getByTestId('manual-bar')).toBeVisible();
  await expect(pop).toHaveCount(0);
  await page.getByTestId('manual-cancel').click();
  await expect(pop).toBeVisible();
});

test('cards have an action menu: right-click, the ⋯ button and double-click to edit', async ({ page }) => {
  await fresh(page);
  // Right-click opens the menu for that card, not the browser menu.
  await card(page, 'My Father').locator('.card-bg').click({ button: 'right', force: true });
  const menu = page.getByTestId('person-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('My Father');
  await page.getByTestId('pm-addChild').click();
  await expect(page.getByTestId('add-child-dialog')).toContainText('My Father');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('add-child-dialog')).toBeHidden();

  // Unavailable actions keep their reason in the menu.
  await card(page, 'Me').locator('.card-bg').click({ button: 'right', force: true });
  await expect(page.getByTestId('pm-addParents')).toHaveAttribute('data-disabled', '');
  await expect(page.getByTestId('pm-addParents-reason')).toHaveText('Parents already added');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // The selected card has a visible ⋯ button that works from the keyboard and gets focus back.
  const more = page.getByTestId('card-more');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();

  // Menu actions run on the card's person: add a sibling for Me.
  await more.click();
  await page.getByTestId('pm-addSibling').click();
  await expect(persons(page)).toHaveCount(4);

  // Double-click a card to edit it.
  await card(page, 'My Mother').locator('.card-bg').dblclick({ force: true });
  await expect(page.getByTestId('edit-form')).toBeVisible();
  await expect(page.getByTestId('f-given')).toHaveValue('My Mother');
});

test('long-press on a card opens its action menu without panning @mobile', async ({ page }) => {
  await fresh(page);
  const bg = card(page, 'My Father').locator('.card-bg');
  await stableBox(bg); // the starter tree is still fitting into view
  // A short press is just a tap: it selects, no menu.
  await card(page, 'My Mother').locator('.card-bg').tap({ position: { x: 30, y: 30 } });
  await expect(page.getByTestId('selected-name')).toHaveText('My Mother');
  await expect(page.getByTestId('person-menu')).toBeHidden();
  const before = await stableBox(bg);
  const x = before.x + 30, y = before.y + 30;
  const opts = { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1 };
  await bg.dispatchEvent('pointerdown', opts);
  await page.waitForTimeout(650);
  await bg.dispatchEvent('pointerup', { ...opts, buttons: 0 });
  await expect(page.getByTestId('person-menu')).toBeVisible();
  const after = (await bg.boundingBox())!;
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeLessThan(2);
  await page.getByTestId('pm-addPartner').tap(); // adds exactly one person
  await expect(persons(page)).toHaveCount(4);

});

/** Interactive elements that are visible and not covered: each must offer a 44 × 44 px target. */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="separator"][tabindex]';
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement | SVGElement>(sel)) {
      const target = (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') ? el.closest('label') : el) ?? el;
      // SVG card buttons are measured by their (invisible) press area.
      const hit = el.querySelector?.('.card-hit') ?? target;
      const r = (hit as Element).getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(target as Element);
      if (cs.visibility === 'hidden' || (el as HTMLElement).closest?.('[hidden],.sr-only')) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      if (top && !(hit as Element).contains(top) && !target.contains(top) && !el.contains(top)) continue; // covered by a sheet or popup
      if (r.width < 43.5 || r.height < 43.5) {
        const name = el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.textContent?.trim().slice(0, 30) || el.tagName;
        out.push(`${name} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return out;
  });
}

test('every visible control offers a 44 px touch target @mobile', async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId('btn-more')).toBeEnabled();
  expect(await smallTargets(page), 'main view').toEqual([]);

  await card(page, 'Me').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-snap', 'half');
  await page.waitForTimeout(450);
  expect(await smallTargets(page), 'half sheet').toEqual([]);

  await page.getByTestId('edit-person').tap();
  await expect(page.getByTestId('edit-form')).toBeVisible();
  await page.waitForTimeout(450);
  expect(await smallTargets(page), 'edit form').toEqual([]);
  await page.getByRole('button', { name: 'Cancel' }).tap();

  await page.getByTestId('btn-settings').tap();
  await expect(page.getByTestId('settings-menu')).toBeVisible();
  expect(await smallTargets(page), 'settings').toEqual([]);
});

test('card buttons stay easy to tap from 50 % to 200 % zoom @mobile', async ({ page }) => {
  await fresh(page);
  const zoomPct = async () => parseInt((await page.getByTestId('view-info').textContent())!.match(/(\d+)%/)![1]);
  const hitSizes = () => page.locator('.card-btn .card-hit').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  // Down to about 50 %.
  for (let i = 0; i < 10 && (await zoomPct()) > 52; i++) await page.getByTestId('btn-zoom-out').tap();
  expect(await zoomPct()).toBeLessThanOrEqual(52);
  const atHalf = await hitSizes();
  expect(atHalf.length).toBeGreaterThan(0);
  for (const w of atHalf) expect(w).toBeGreaterThanOrEqual(43.5);
  // Up to 200 %.
  for (let i = 0; i < 20 && (await zoomPct()) < 200; i++) await page.getByTestId('btn-zoom-in').tap();
  for (const w of await hitSizes()) expect(w).toBeGreaterThanOrEqual(43.5);
});

test('generation control is one tap away on phones @mobile', async ({ page }) => {
  await fresh(page);
  await page.getByTestId('gen-chip').tap();
  await expect(page.getByTestId('gen-popover')).toBeVisible();
  await page.getByTestId('gen-popover').getByTestId('gen-down-minus').tap(); // All -> 10
  await expect(page.getByTestId('gen-chip')).toContainText('10');
});

const zoomPctOf = async (page: Page) => parseInt((await page.getByTestId('view-info').textContent())!.match(/(\d+)%/)![1]);

test('keyboard: arrows move between relatives, Enter edits, Delete asks, ? lists shortcuts', async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId('selected-name')).toHaveText('Me');
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('selected-name')).toHaveText('My Father');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('selected-name')).toHaveText('My Mother');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('selected-name')).toHaveText('My Father');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('selected-name')).toHaveText('Me');

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('edit-form')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-testid="confirm-dialog"], [data-testid="message-dialog"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(persons(page)).toHaveCount(3);

  // Zoom keys.
  await page.getByTestId('tree-canvas').focus();
  const z0 = await zoomPctOf(page);
  await page.keyboard.press('+');
  await expect.poll(() => zoomPctOf(page)).toBeGreaterThan(z0);
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  await expect.poll(() => zoomPctOf(page)).toBeLessThan(z0);

  // Typing in a field never triggers shortcuts.
  await page.getByTestId('tree-title').focus();
  const zt = await zoomPctOf(page);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('+');
  await expect(page.getByTestId('selected-name')).toHaveText('My Father');
  expect(await zoomPctOf(page)).toBe(zt);
  await page.keyboard.press('Escape');

  // "?" lists the shortcuts in the current language.
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('?');
  const help = page.getByTestId('shortcuts-dialog');
  await expect(help).toContainText('Select a parent');
  await expect(help).toContainText('F');
  await page.keyboard.press('Escape');
  await setLangViaSettings(page, 'id');
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('?');
  await expect(help).toContainText('Pilih orang tua');
});

test('double-tap zooms in at that point on phones @mobile', async ({ page }) => {
  await fresh(page);
  await stableBox(card(page, 'Me').locator('.card-bg'));
  const z0 = await zoomPctOf(page);
  const c = (await page.getByTestId('tree-canvas').boundingBox())!;
  await page.touchscreen.tap(c.x + 40, c.y + 120);
  await page.touchscreen.tap(c.x + 40, c.y + 120);
  await expect.poll(() => zoomPctOf(page)).toBeGreaterThan(z0 + 20);
});

test('undo and redo: Ctrl+Z, Ctrl+Shift+Z and the "Undo" toast after deleting', async ({ page }) => {
  await fresh(page);
  const status = page.getByTestId('status-chip');
  await expect(status).toContainText('saved');
  await expect(status).not.toContainText('unsaved');

  // Add a sibling, then undo it from the keyboard: the save status follows.
  await page.getByTestId('add-sibling').click();
  await expect(persons(page)).toHaveCount(4);
  const sibling = (await page.getByTestId('selected-name').textContent())!;
  await expect(status).toContainText('unsaved');
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(persons(page)).toHaveCount(3);
  await expect(status).not.toContainText('unsaved');
  await page.keyboard.press('Control+Shift+z');
  await expect(persons(page)).toHaveCount(4);

  // Delete the new sibling, then bring it back from the toast.
  await card(page, sibling).locator('.card-bg').click({ force: true });
  await expect(page.getByTestId('selected-name')).toHaveText(sibling);
  await page.getByTestId('delete-person').click();
  await page.getByTestId('confirm-ok').click();
  await expect(persons(page)).toHaveCount(3);
  await expect(page.getByTestId('toast')).toContainText('deleted');
  await page.getByTestId('toast-action').click();
  await expect(persons(page)).toHaveCount(4);
  await expect(card(page, sibling)).toBeVisible();

  // Typing a title is one undo step, not one per letter.
  const title = page.getByTestId('tree-title');
  const before = await title.inputValue();
  await title.fill(before + ' Baru');
  await title.press('End');
  await page.keyboard.type('!');
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(title).toHaveValue(before);
});

test('opening a file starts a fresh undo history', async ({ page }) => {
  await fresh(page);
  await page.getByTestId('add-sibling').click();
  await importFile(page, fixture);
  await expect(page.getByTestId('view-info')).toContainText('4/4 shown');
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('view-info')).toContainText('4/4 shown');
});

test('icon tools show a quick tooltip with their shortcut; primary actions are labelled', async ({ page }) => {
  await fresh(page);
  const search = page.getByTestId('btn-search');
  await expect(search).toContainText('Search');
  await expect(search).not.toHaveAttribute('title', /.*/); // no slow native tooltip on top of ours
  await search.hover();
  const tip = page.getByTestId('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Search people');
  await expect(tip).toContainText(/Ctrl\+F|⌘F/);
  // Moving to the next tool switches the tooltip straight away.
  await page.getByTestId('btn-zoom-in').hover();
  await expect(tip).toContainText('Zoom in (+)');
  await page.mouse.move(700, 450);
  await expect(tip).toBeHidden();

  // Keyboard focus shows it too.
  await page.getByTestId('tree-title').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('btn-open')).toBeFocused();
  await expect(tip).toContainText('Open / import');
});

test('touch screens get no tooltips: a tap just runs the action @mobile', async ({ page }) => {
  await fresh(page);
  await page.getByTestId('btn-search').tap();
  await expect(page.getByTestId('search-panel')).toBeVisible();
  await expect(page.getByTestId('tooltip')).toHaveCount(0);
});

async function seriousA11yIssues(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test('no serious accessibility violations: main view, dark theme, dialog and card menu', async ({ page }) => {
  await fresh(page);
  await stableBox(card(page, 'Me').locator('.card-bg'));
  expect(await seriousA11yIssues(page), 'main view').toEqual([]);
  await expect(page.getByTestId('editor-popup')).toBeVisible();
  await page.getByTestId('editor-popup').getByTestId('edit-person').click();
  await expect(page.getByTestId('edit-form')).toBeVisible();
  expect(await seriousA11yIssues(page), 'editor pop-up, editing').toEqual([]);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByTestId('btn-export').click();
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  expect(await seriousA11yIssues(page), 'export dialog').toEqual([]);
  await page.keyboard.press('Escape');
  await card(page, 'My Father').locator('.card-bg').click({ button: 'right', force: true });
  await expect(page.getByTestId('person-menu')).toBeVisible();
  expect(await seriousA11yIssues(page), 'card menu').toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByTestId('btn-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await seriousA11yIssues(page), 'dark theme').toEqual([]);
});

test('no serious accessibility violations on phones: sheet and menu @mobile', async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId('btn-more')).toBeEnabled();
  expect(await seriousA11yIssues(page), 'main view').toEqual([]);
  await card(page, 'Me').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-snap', 'half');
  expect(await seriousA11yIssues(page), 'half sheet').toEqual([]);
  await page.getByTestId('btn-more').tap();
  await expect(page.getByTestId('more-menu')).toBeVisible();
  expect(await seriousA11yIssues(page), 'overflow menu').toEqual([]);
});

test('cards have spoken names, changes are announced, reduced motion is respected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page);
  const me = page.locator('g.person[aria-current="true"]');
  await expect(me).toHaveAttribute('aria-label', /^Me, born 1994, focus person$/);
  await expect(card(page, 'My Father')).toHaveAttribute('aria-label', 'My Father, born 1965, parent of Me');

  await page.getByTestId('add-sibling').click();
  await expect(page.getByTestId('live-region')).toContainText('Added');
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('live-region')).toContainText(/Selected: My (Father|Mother), born \d{4}, parent of Me/);

  // Reduced motion: zoom and centring jump instead of animating.
  const z0 = await zoomPctOf(page);
  await page.getByTestId('btn-center').click();
  const t0 = await page.locator('svg.tree-svg > g').first().getAttribute('transform');
  await page.waitForTimeout(60);
  expect(await page.locator('svg.tree-svg > g').first().getAttribute('transform')).toBe(t0);
  expect(z0).toBeGreaterThan(0);
});

test('large text: at 200 % zoom the header and editor still fit without overlap', async ({ page }) => {
  // 1400 × 900 at 200 % browser zoom is a 700 × 450 CSS-pixel viewport.
  await page.setViewportSize({ width: 700, height: 450 });
  await fresh(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const id of ['btn-open', 'btn-save', 'btn-export', 'btn-search', 'btn-settings', 'btn-more']) {
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
  }
  await card(page, 'Me').locator('.card-bg').click({ force: true });
  const header = (await page.locator('header').boundingBox())!;
  const sheet = (await page.getByTestId('sidebar').boundingBox())!;
  expect(sheet.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
});

test('first-visit tips appear once, are worded for the device and can be dismissed', async ({ page }) => {
  await fresh(page, 'en', { onboarding: true });
  const tips = page.getByTestId('onboarding');
  await expect(tips).toContainText('Right-click a card');
  await expect(tips).toContainText('its editor opens right next to the card');
  await expect(tips).toContainText('Press ?');
  await page.getByTestId('onboarding-ok').click();
  await expect(tips).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('tree-canvas')).toBeVisible();
  await expect(tips).toHaveCount(0);
});

test('first-visit tips on phones talk about tapping and the sheet; Escape dismisses them @mobile', async ({ page }) => {
  await fresh(page, 'id', { onboarding: true });
  const tips = page.getByTestId('onboarding');
  await expect(tips).toContainText('Tekan lama');
  await expect(tips).toContainText('Seret lembar');
  await expect(tips).not.toContainText('Klik kanan');
  await page.keyboard.press('Escape');
  await expect(tips).toBeHidden();
});

test('picking another person shows the sheet from its top @mobile', async ({ page }) => {
  await fresh(page);
  await card(page, 'Me').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await page.getByTestId('sheet-grip').tap(); // bar
  await page.getByTestId('sheet-grip').tap(); // half
  await page.locator('.sheet-body').evaluate((e) => (e.scrollTop = 400));
  await expect.poll(() => page.locator('.sheet-body').evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await page.getByTestId('btn-search').tap();
  await page.getByTestId('search-input').fill('mother');
  await page.getByTestId('search-input').press('Enter');
  await expect(page.getByTestId('selected-name')).toHaveText('My Mother');
  await expect.poll(() => page.locator('.sheet-body').evaluate((e) => e.scrollTop)).toBe(0);
});

/** RGB of one pixel of an exported image, decoded by the browser. */
async function imagePixel(page: Page, file: string, mime: string, at: 'corner' | { x: number; y: number }) {
  const b64 = fs.readFileSync(file).toString('base64');
  return page.evaluate(
    async ([data, type, pos]) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const p = pos === 'corner' ? { x: 2, y: 2 } : (pos as { x: number; y: number });
      return [...ctx.getImageData(p.x, p.y, 1, 1).data];
    },
    [b64, mime, at] as const,
  );
}

async function exportImage(page: Page, kind: 'png' | 'jpeg' | 'svg', bg?: string) {
  await page.getByTestId('btn-export').click();
  await page.getByTestId(`export-kind-${kind}`).click();
  if (bg) await page.getByTestId(`export-bg-${bg}`).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
  return (await dl.path())!;
}

test('Nila & Sogan colours on screen and in PNG, JPEG and SVG exports', async ({ page }) => {
  await fresh(page);
  const bgOf = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
  // Primary button and the selected card are Nila; the app background is warm stone.
  expect(await bgOf('[data-testid="btn-export"]')).toBe('rgb(55, 48, 163)');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 250, 249)');
  await expect(page.locator('g.person[aria-current="true"] .card-bg')).toHaveAttribute('stroke', '#4338ca');
  // Search matches and the unsaved badge are Sogan.
  await page.getByTestId('btn-search').click();
  await page.getByTestId('search-input').fill('mother');
  await page.getByTestId('search-input').press('Enter');
  await card(page, 'Me').locator('.card-bg').click({ position: { x: 20, y: 20 } });
  await expect(card(page, 'My Mother').locator('.card-bg')).toHaveAttribute('stroke', '#b45309');
  await page.getByTestId('add-sibling').click();
  await expect(page.getByTestId('status-chip')).toHaveCSS('color', 'rgb(180, 83, 9)');
  // The "other" ring is teal, dashed.
  const ringColours = await page.locator('circle.ring').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('stroke')))]);

  const svg = fs.readFileSync(await exportImage(page, 'svg', 'canvas'), 'utf8');
  expect(svg).toContain('fill="#fafaf9"');
  for (const c of ringColours) expect(svg).toContain(`stroke="${c}"`);
  expect(svg).toContain('stroke="#0d9488"'); // legend: other
  expect(svg).not.toMatch(/#059669|#7c3aed|#f8fafc/);
  const png = await imagePixel(page, await exportImage(page, 'png', 'canvas'), 'image/png', 'corner');
  expect(png.slice(0, 3)).toEqual([250, 250, 249]);
  const jpeg = await imagePixel(page, await exportImage(page, 'jpeg', 'canvas'), 'image/jpeg', 'corner');
  for (const [i, v] of [250, 250, 249].entries()) expect(Math.abs(jpeg[i] - v)).toBeLessThanOrEqual(3);

  // Dark theme: same tokens on screen and in the export.
  await page.getByTestId('btn-theme').click();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(12, 10, 9)');
  const dark = await imagePixel(page, await exportImage(page, 'png', 'canvas'), 'image/png', 'corner');
  expect(dark.slice(0, 3)).toEqual([12, 10, 9]);
});

test('one icon per action across toolbar, panel, card menu and shortcut list; active tools are filled', async ({ page }) => {
  await fresh(page);
  const iconOf = (loc: ReturnType<Page['locator']>) => loc.locator('svg[data-icon]').first();
  const pathsOf = (loc: ReturnType<Page['locator']>) => iconOf(loc).innerHTML();
  // Person actions: the editor panel and the card menu draw the same icons.
  const panelIcons: Record<string, string> = {};
  for (const id of ['add-parents', 'add-sibling', 'add-partner', 'add-child', 'focus-person', 'delete-person']) {
    panelIcons[id] = await pathsOf(page.getByTestId('editor-popup').getByTestId(id));
  }
  await card(page, 'My Father').locator('.card-bg').click({ button: 'right', force: true });
  const menuIds: Record<string, string> = { 'add-parents': 'pm-addParents', 'add-sibling': 'pm-addSibling', 'add-partner': 'pm-addPartner', 'add-child': 'pm-addChild', 'focus-person': 'pm-focus', 'delete-person': 'pm-delete' };
  for (const [panel, menu] of Object.entries(menuIds)) expect(await pathsOf(page.getByTestId(menu)), menu).toBe(panelIcons[panel]);
  await expect(iconOf(page.getByTestId('pm-edit'))).toHaveAttribute('data-icon', 'edit');
  await expect(iconOf(page.getByTestId('editor-popup').getByTestId('edit-person'))).toHaveAttribute('data-icon', 'edit');
  await page.keyboard.press('Escape');

  // The shortcut list uses the toolbar's icons.
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('?');
  const list = page.getByTestId('shortcuts-dialog');
  await expect(list.locator('svg[data-icon="search"]')).toHaveCount(1);
  await expect(list.locator('svg[data-icon="zoomIn"]')).toHaveCount(1);
  expect(await list.locator('svg[data-icon="zoomIn"]').innerHTML()).toBe(await pathsOf(page.getByTestId('btn-zoom-in')));
  await page.keyboard.press('Escape');

  // Regular weight at rest, fill while active.
  const search = iconOf(page.getByTestId('btn-search'));
  await expect(search).toHaveAttribute('data-weight', 'regular');
  await page.getByTestId('btn-search').click();
  await expect(search).toHaveAttribute('data-weight', 'fill');
  await page.keyboard.press('Escape');
  await expect(search).toHaveAttribute('data-weight', 'regular');
  await expect(iconOf(page.getByTestId('btn-export'))).toHaveAttribute('data-weight', 'fill');
  await page.evaluate(() => localStorage.setItem('sambungdulur.manualInfoSeen', '1'));
  await page.getByTestId('btn-manual').click();
  await expect(iconOf(page.getByTestId('btn-manual'))).toHaveAttribute('data-weight', 'fill');
  // Every icon-only tool still has an accessible name.
  for (const b of await page.locator('.toolbar button, .zoom-controls button').all()) {
    expect(((await b.getAttribute('aria-label')) ?? (await b.textContent()) ?? '').trim().length).toBeGreaterThan(0);
  }
});

test('Ctrl+H, F1 and ? open the grouped shortcut list; the filter narrows it, in every language', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => {
    const w = window as unknown as { keys: string[] };
    w.keys = [];
    window.addEventListener('keydown', (e) => w.keys.push(`${e.key}:${e.defaultPrevented}`));
  });
  const list = page.getByTestId('shortcuts-dialog');
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('Control+h');
  await expect(list).toBeVisible();
  // The browser's history shortcut is cancelled.
  expect(await page.evaluate(() => (window as unknown as { keys: string[] }).keys)).toContain('h:true');
  for (const [g, name] of [['file', 'File'], ['navigation', 'Navigation'], ['person', 'People'], ['view', 'View'], ['history', 'History'], ['help', 'Help']]) {
    await expect(list.getByTestId(`shortcut-group-${g}`).locator('h4')).toHaveText(name);
  }
  await expect(list.getByTestId('shortcut-help')).toContainText(/Ctrl\+H/);
  await expect(list.getByTestId('shortcut-help')).toContainText('F1');
  // Filter by words or keys.
  await list.getByTestId('shortcuts-filter').fill('zoom');
  await expect(list.getByTestId('shortcut-zoomIn')).toBeVisible();
  await expect(list.getByTestId('shortcut-zoomOut')).toBeVisible();
  await expect(list.getByTestId('shortcut-save')).toHaveCount(0);
  await expect(list.getByTestId('shortcut-group-file')).toHaveCount(0);
  await list.getByTestId('shortcuts-filter').fill('ctrl+e');
  await expect(list.locator('tr')).toHaveCount(1);
  await expect(list.getByTestId('shortcut-export')).toBeVisible();
  await list.getByTestId('shortcuts-filter').fill('qwerty');
  await expect(list.getByTestId('shortcuts-none')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();

  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('F1');
  await expect(list).toBeVisible();
  await page.keyboard.press('Control+h'); // toggles closed
  await expect(list).toBeHidden();
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('?');
  await expect(list).toBeVisible();
  await page.keyboard.press('Escape');

  await setLangViaSettings(page, 'id');
  await page.keyboard.press('Control+h');
  await expect(list.getByTestId('shortcut-group-file').locator('h4')).toHaveText('Berkas');
  await expect(list.getByTestId('shortcut-group-view').locator('h4')).toHaveText('Tampilan');
  await expect(list.getByTestId('shortcut-theme')).toContainText('Ganti tema terang / gelap');
  await page.keyboard.press('Escape');
  await setLangViaSettings(page, 'jv');
  await page.keyboard.press('Control+h');
  await expect(list.getByTestId('shortcut-group-help').locator('h4')).toHaveText('Pitulung');
});

test('file and view shortcuts: Ctrl+O, Ctrl+E, Ctrl+K, Ctrl+comma, Ctrl+Shift+L, M and generations', async ({ page }) => {
  await fresh(page);
  const canvas = page.getByTestId('tree-canvas');
  await canvas.focus();
  await page.keyboard.press('Control+o');
  await expect(page.getByTestId('open-dialog')).toBeVisible();
  // Behind an open dialog other shortcuts do nothing.
  await page.keyboard.press('Control+e');
  await expect(page.getByTestId('export-dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await canvas.focus();
  await page.keyboard.press('Control+e');
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await canvas.focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('search-panel')).toBeVisible();
  await expect(page.getByTestId('search-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await canvas.focus();
  await page.keyboard.press('Control+,');
  await expect(page.getByTestId('settings-menu')).toBeVisible();
  await page.keyboard.press('Escape');

  await canvas.focus();
  await page.keyboard.press('Control+Shift+L');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('live-region')).toContainText('Dark theme');
  await page.keyboard.press('Control+Shift+L');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Generations: Ctrl+arrows for ancestors, Ctrl+Shift+arrows for descendants (All → 10 → All).
  await expect(page.getByTestId('gen-up-value')).toHaveText('All');
  await page.keyboard.press('Control+ArrowDown');
  await expect(page.getByTestId('gen-up-value')).toHaveText('10');
  await expect(page.getByTestId('live-region')).toContainText('ancestors 10');
  await page.keyboard.press('Control+ArrowUp');
  await expect(page.getByTestId('gen-up-value')).toHaveText('All');
  await page.keyboard.press('Control+Shift+ArrowDown');
  await expect(page.getByTestId('gen-down-value')).toHaveText('10');
  await page.keyboard.press('Control+Shift+ArrowUp');
  await expect(page.getByTestId('gen-down-value')).toHaveText('All');
  await expect(page.getByTestId('selected-name')).toHaveText('Me'); // Ctrl+arrows don't move the selection

  // M toggles manual layout from the tree, but not while typing or from the header.
  await page.evaluate(() => localStorage.setItem('sambungdulur.manualInfoSeen', '1'));
  const title = page.getByTestId('tree-title');
  await title.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('m');
  await expect(title).toHaveValue(/m$/);
  await page.getByTestId('btn-open').focus();
  await page.keyboard.press('m');
  await expect(page.getByTestId('manual-bar')).toHaveCount(0);
  await canvas.focus();
  await page.keyboard.press('m');
  await expect(page.getByTestId('manual-bar')).toBeVisible();
  await page.keyboard.press('m');
  await expect(page.getByTestId('manual-bar')).toHaveCount(0);

  // Tooltips take their keys from the registry.
  await page.getByTestId('btn-open').hover();
  await expect(page.getByTestId('tooltip')).toContainText(/Ctrl\+O|⌘O/);
});

test('the overflow menu lists shortcuts for its items and opens the shortcut list', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await fresh(page);
  await expect(page.getByTestId('btn-more')).toBeEnabled();
  await page.getByTestId('btn-more').click();
  await expect(page.getByTestId('more-manual')).toContainText('M');
  await expect(page.getByTestId('more-theme')).toContainText(/Ctrl\+Shift\+L|⌘⇧L/);
  await page.getByTestId('more-shortcuts').click();
  await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
});

test('new logo in the header and favicon; manifest lists 192, 512, maskable and monochrome icons', async ({ page }) => {
  await fresh(page);
  const logo = page.getByTestId('brand-logo');
  await expect(logo).toBeVisible();
  // Two joined nodes: Nila and Sogan, from the theme.
  expect(await logo.locator('circle').evaluateAll((els) => els.map((e) => getComputedStyle(e).fill))).toEqual(['rgb(67, 56, 202)', 'rgb(180, 83, 9)']);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', './icons/icon.svg');
  await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute('href', './icons/favicon-32.png');

  const manifestUrl = new URL((await page.locator('link[rel=manifest]').getAttribute('href'))!, page.url()).toString();
  const manifest = await (await page.request.get(manifestUrl)).json();
  const icon = (purpose: string, sizes: string) => manifest.icons.find((i: { purpose: string; sizes: string }) => i.purpose === purpose && i.sizes === sizes);
  for (const [purpose, sizes] of [['any', '192x192'], ['any', '512x512'], ['maskable', '512x512'], ['monochrome', '512x512']]) {
    const entry = icon(purpose, sizes);
    expect(entry, `${purpose} ${sizes}`).toBeTruthy();
    const res = await page.request.get(new URL(entry.src, manifestUrl).toString());
    expect(res.ok(), entry.src).toBe(true);
    const buf = await res.body();
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)].join('x'), entry.src).toBe(sizes);
  }
  // The maskable icon keeps its whole logo inside the 80 % safe circle; the monochrome one too.
  for (const file of ['public/icons/icon-maskable-512.png', 'public/icons/icon-monochrome-512.png']) {
    const b64 = fs.readFileSync(file).toString('base64');
    const outside = await page.evaluate(async (data) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const { data: px, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height);
      const bg = [px[0], px[1], px[2], px[3]];
      const r = 0.4 * width;
      let n = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const differs = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) + Math.abs(px[i + 3] - bg[3]) > 24;
          if (differs && Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) > r) n++;
        }
      return n;
    }, b64);
    expect(outside, file).toBe(0);
  }
});

/** RGB at a point of the screen (canvas-local offsets from the canvas' top-left corner). */
async function canvasPixel(page: Page, dx = 60, dy = 260) {
  const c = (await page.getByTestId('tree-canvas').boundingBox())!;
  const shot = await page.screenshot({ clip: { x: c.x + dx, y: c.y + dy, width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const cv = new OffscreenCanvas(1, 1);
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, shot.toString('base64'));
}
const hex = (rgb: number[]) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

test('canvas background: grid or plain colour, live, undoable, saved with the tree and exported', async ({ page }) => {
  await fresh(page);
  const svg = page.locator('svg.tree-svg');
  await expect(svg).toHaveAttribute('data-backdrop', 'grid');
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('bg-kind-solid').click();
  await page.getByTestId('bg-swatch-sky').click();
  await expect(page.getByTestId('bg-swatch-sky')).toHaveAttribute('aria-pressed', 'true');
  // Live: the empty canvas behind the open settings already shows the colour.
  await expect(svg).toHaveAttribute('data-backdrop', 'solid');
  await expect.poll(async () => hex(await canvasPixel(page))).toBe('#e2eef6');
  await page.getByTestId('bg-custom').fill('#123456');
  await expect.poll(async () => hex(await canvasPixel(page))).toBe('#123456');
  // A dark colour switches lines and shadows to their light variant.
  await expect(page.getByTestId('tree-canvas')).toHaveAttribute('data-ink', 'light');
  await page.getByTestId('bg-kind-grid').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'grid');
  await expect(page.getByTestId('tree-canvas')).toHaveAttribute('data-ink', 'dark');
  await page.keyboard.press('Escape');

  // Undo brings back the previous background.
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(svg).toHaveAttribute('data-backdrop', 'solid');
  await expect.poll(async () => hex(await canvasPixel(page))).toBe('#123456');
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('bg-swatch-sky').click();
  await page.keyboard.press('Escape');

  // Kept after reload, and in a .sambung file.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(svg).toHaveAttribute('data-backdrop', 'solid');
  await expect.poll(async () => hex(await canvasPixel(page))).toBe('#e2eef6');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('btn-save').click()]);
  const saved = fs.readFileSync((await dl.path())!);
  await page.getByTestId('btn-reset').click();
  await page.getByTestId('confirm-ok').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'grid');
  await page.getByTestId('btn-open').click();
  await page.getByTestId('open-file-input').setInputFiles({ name: 'bg.sambung', mimeType: 'application/zip', buffer: saved });
  await page.getByTestId('open-close').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'solid');

  // Export: "Follow canvas background" is the default; JPEG never stays transparent.
  await page.getByTestId('btn-export').click();
  await expect(page.getByTestId('export-bg-canvas')).toHaveClass(/on/);
  await expect(page.getByTestId('export-bg-canvas')).toHaveText('Follow canvas background');
  await page.keyboard.press('Escape');
  const png = await imagePixel(page, await exportImage(page, 'png'), 'image/png', 'corner');
  expect(hex(png.slice(0, 3))).toBe('#e2eef6');
  await page.getByTestId('btn-export').click();
  await page.getByTestId('export-kind-png').click();
  await page.getByTestId('export-bg-transparent').click();
  await page.getByTestId('export-kind-jpeg').click();
  const [jdl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
  const jpeg = await imagePixel(page, (await jdl.path())!, 'image/jpeg', 'corner');
  for (const v of jpeg.slice(0, 3)) expect(v).toBeGreaterThan(250);
});

test('family lines and captions stay readable on dark and light plain backgrounds (axe)', async ({ page }) => {
  await fresh(page);
  for (const preset of ['night', 'cream']) {
    await page.getByTestId('btn-settings').click();
    await page.getByTestId('bg-kind-solid').click();
    await page.getByTestId(`bg-swatch-${preset}`).click();
    await page.keyboard.press('Escape');
    await stableBox(card(page, 'Me').locator('.card-bg'));
    expect(await seriousA11yIssues(page), preset).toEqual([]);
  }
  await page.getByTestId('btn-theme').click();
  expect(await seriousA11yIssues(page), 'dark theme, cream preset').toEqual([]);
});

/** A JPEG/PNG made in the browser: `color` with a white top-left quarter. */
async function makeImage(page: Page, w: number, h: number, color: string, type = 'image/jpeg') {
  const b64 = await page.evaluate(
    async ([w, h, color, type]) => {
      const c = new OffscreenCanvas(w, h);
      const x = c.getContext('2d')!;
      x.fillStyle = color;
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w / 2, h / 2);
      const bytes = new Uint8Array(await (await c.convertToBlob({ type, quality: 0.8 })).arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    [w, h, color, type] as const,
  );
  return Buffer.from(b64, 'base64');
}

test('canvas background: six motifs with scale and colour, kept per tree and exported', async ({ page }) => {
  await fresh(page);
  const svg = page.locator('svg.tree-svg');
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('bg-kind-tiles').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'tiles');
  await expect(page.locator('rect.canvas-tiles')).toHaveCount(1);
  for (const m of ['dots', 'diagonal', 'hex', 'kawung', 'parang', 'truntum']) {
    await page.getByTestId(`bg-motif-${m}`).click();
    await expect(page.getByTestId(`bg-motif-${m}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(svg.locator('#bg-tiles > *').first()).toBeAttached();
  }
  await page.getByTestId('bg-motif-kawung').click();
  await page.getByTestId('bg-scale').fill('150');
  await expect(svg.locator('#bg-tiles')).toHaveAttribute('patternTransform', 'scale(1.5)');
  await expect(svg.locator('#bg-tiles ellipse').first()).toHaveAttribute('stroke', '#dcd7d2');
  await page.getByTestId('bg-motif-color').fill('#b45309');
  await expect(svg.locator('#bg-tiles ellipse').first()).toHaveAttribute('stroke', '#b45309');
  await page.getByTestId('bg-motif-color-default').click();
  await page.keyboard.press('Escape');
  // Dark theme: the default motif colour has a dark variant.
  await page.getByTestId('btn-theme').click();
  await expect(svg.locator('#bg-tiles ellipse').first()).toHaveAttribute('stroke', '#2e2926');
  await page.getByTestId('btn-theme').click();

  // Kept after reload and in .sambung files.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(svg).toHaveAttribute('data-backdrop', 'tiles');
  await expect(svg.locator('#bg-tiles')).toHaveAttribute('patternTransform', 'scale(1.5)');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('btn-save').click()]);
  const saved = fs.readFileSync((await dl.path())!);
  await page.getByTestId('btn-reset').click();
  await page.getByTestId('confirm-ok').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'grid');
  await page.getByTestId('btn-open').click();
  await page.getByTestId('open-file-input').setInputFiles({ name: 'motif.sambung', mimeType: 'application/zip', buffer: saved });
  await page.getByTestId('open-close').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'tiles');

  // SVG and PNG exports that follow the canvas carry the motif.
  const out = fs.readFileSync(await exportImage(page, 'svg', 'canvas'), 'utf8');
  expect(out).toContain('id="bg-tiles"');
  expect(out).toContain('fill="url(#bg-tiles)"');
  const png = fs.statSync(await exportImage(page, 'png', 'canvas')).size;
  const plain = fs.statSync(await exportImage(page, 'png', 'white')).size;
  expect(png).toBeGreaterThan(plain); // the motif adds detail all over the image
});

test('canvas background picture: shrunk to 2560 px, live settings, kept, exported and readable', async ({ page }) => {
  await fresh(page);
  const svg = page.locator('svg.tree-svg');
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('bg-kind-image').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'grid'); // nothing changes until a picture is chosen
  const big = await makeImage(page, 6000, 4000, '#1d3557');
  await page.getByTestId('bg-image-input').setInputFiles({ name: 'kampung.jpg', mimeType: 'image/jpeg', buffer: big });
  await expect(svg).toHaveAttribute('data-backdrop', 'image');
  const picture = svg.locator('.canvas-image');
  await expect(picture.locator('image')).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
  // Default veil 70 %, no blur, stays put (outside the zoom transform).
  await expect(picture.locator('rect').last()).toHaveAttribute('opacity', '0.7');
  await expect(svg.locator('> .canvas-image')).toHaveCount(1);
  // Every setting shows at once.
  await page.getByTestId('bg-fit-contain').click();
  await expect(picture.locator('image')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  await page.getByTestId('bg-fit-tile').click();
  await expect(picture.locator('rect[fill="url(#bg-image)"]')).toHaveCount(1);
  await page.getByTestId('bg-fit-cover').click();
  await page.getByTestId('bg-fade').fill('40');
  await expect(picture.locator('rect').last()).toHaveAttribute('opacity', '0.4');
  await page.getByTestId('bg-blur').fill('6');
  await expect(svg.locator('#bg-blur feGaussianBlur')).toHaveAttribute('stdDeviation', '6');
  await page.getByTestId('bg-motion-scroll').click();
  await expect(svg.locator('> g[transform] .canvas-image')).toHaveCount(1);
  await page.getByTestId('bg-motion-fixed').click();
  await page.getByTestId('bg-fade').fill('70');
  await page.getByTestId('bg-blur').fill('0');
  await page.keyboard.press('Escape');

  // The stored picture is at most 2560 px on its longest side; the SVG export inlines it.
  const out = fs.readFileSync(await exportImage(page, 'svg', 'canvas'), 'utf8');
  const start = out.indexOf('href="data:image/jpeg;base64,');
  expect(start).toBeGreaterThan(0);
  const href = out.slice(start + 6, out.indexOf('"', start + 6));
  const size = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, href);
  expect(size).toEqual([2560, 1707]);
  // PNG export with the canvas background shows the picture through its veil, not the bare canvas colour.
  const px = await imagePixel(page, await exportImage(page, 'png', 'canvas'), 'image/png', { x: 4, y: 300 });
  expect(hex(px.slice(0, 3))).not.toBe('#fafaf9');

  // Kept after reload and in .sambung files (picture included); readable over a dark and a bright picture.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(svg).toHaveAttribute('data-backdrop', 'image');
  await expect(svg.locator('.canvas-image image')).toHaveAttribute('href', /^blob:/);
  await stableBox(card(page, 'Me').locator('.card-bg'));
  expect(await seriousA11yIssues(page), 'dark picture').toEqual([]);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('btn-save').click()]);
  const saved = fs.readFileSync((await dl.path())!);
  await page.getByTestId('btn-reset').click();
  await page.getByTestId('confirm-ok').click();
  await page.getByTestId('btn-open').click();
  await page.getByTestId('open-file-input').setInputFiles({ name: 'pic.sambung', mimeType: 'application/zip', buffer: saved });
  await expect(page.getByTestId('open-report')).toContainText('Photos: 1');
  await page.getByTestId('open-close').click();
  await expect(svg).toHaveAttribute('data-backdrop', 'image');
  await expect(svg.locator('.canvas-image image')).toHaveAttribute('href', /^blob:/);

  await page.getByTestId('btn-settings').click();
  const before = await svg.locator('.canvas-image image').getAttribute('href');
  await page.getByTestId('bg-image-input').setInputFiles({ name: 'terang.png', mimeType: 'image/png', buffer: await makeImage(page, 800, 600, '#f2e8cf', 'image/png') });
  await expect(svg.locator('.canvas-image image')).not.toHaveAttribute('href', before!);
  await page.keyboard.press('Escape');
  await stableBox(card(page, 'Me').locator('.card-bg'));
  expect(await seriousA11yIssues(page), 'bright picture').toEqual([]);
  // Undo returns to the previous picture.
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(svg.locator('.canvas-image image')).toHaveAttribute('href', before!);
});

test('desktop: leaving a changed form asks Save, Discard or Cancel', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('dialog', { name: 'Editor: Me' })).toBeVisible();
  await page.getByTestId('editor-popup').getByTestId('edit-person').click();
  await page.getByTestId('f-given').fill('Me changed');
  const father = card(page, 'My Father').locator('.card-bg');
  const ask = page.getByTestId('unsaved-dialog');
  // Cancel stays in the form, changes intact.
  await father.click({ position: { x: 20, y: 20 }, force: true });
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('Me');
  await page.getByTestId('unsaved-cancel').click();
  await expect(ask).toBeHidden();
  await expect(page.getByTestId('f-given')).toHaveValue('Me changed');
  // Discard drops the changes and moves on.
  await father.click({ position: { x: 20, y: 20 }, force: true });
  await page.getByTestId('unsaved-discard').click();
  await expect(page.getByRole('dialog', { name: 'Editor: My Father' })).toBeVisible();
  await expect(card(page, 'Me')).toBeVisible();
  await expect(card(page, 'Me changed')).toHaveCount(0);
  // Save keeps them and moves on (to a card the pop-up does not cover, once the view has settled).
  await page.getByTestId('editor-popup').getByTestId('edit-person').click();
  await page.getByTestId('f-given').fill('Dad');
  const popBox = await stableBox(page.getByTestId('editor-popup'));
  let target = '';
  for (const name of ['Me', 'My Mother']) {
    const box = await stableBox(card(page, name).locator('.card-bg'));
    // A spot of the card left of, or below, the pop-up.
    const free = box.x + 24 < popBox.x ? { x: Math.min(60, (popBox.x - box.x) / 2), y: box.height / 2 } : box.y + box.height > popBox.y + popBox.height + 24 ? { x: box.width / 2, y: box.height - 12 } : null;
    if (free && free.y > 30) {
      target = name;
      await card(page, name).locator('.card-bg').click({ position: free });
      break;
    }
  }
  expect(target).not.toBe('');
  await page.getByTestId('unsaved-save').click();
  await expect(page.getByRole('dialog', { name: `Editor: ${target}` })).toBeVisible();
  await expect(card(page, 'Dad')).toBeVisible();
  // Escape with changes asks too; an unchanged form just closes.
  await page.getByTestId('editor-popup').getByTestId('edit-person').click();
  await page.getByTestId('f-given').fill('Me again');
  await page.keyboard.press('Escape');
  await expect(ask).toBeVisible();
  await page.getByTestId('unsaved-cancel').click();
  await expect(page.getByTestId('editor-popup')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('editor-popup')).toHaveCount(0);
  await expect(ask).toHaveCount(0);
});

test('desktop: pin turns the pop-up into a resizable right panel that is remembered', async ({ page }) => {
  await fresh(page);
  await page.getByTestId('editor-pin').click();
  const panel = page.getByTestId('editor-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('editor-popup')).toHaveCount(0);
  const p0 = await stableBox(panel);
  expect(Math.round(p0.x + p0.width)).toBe(1400);
  // The canvas narrows instead of being covered.
  const c = (await page.getByTestId('tree-canvas').boundingBox())!;
  expect(c.x + c.width).toBeLessThanOrEqual(p0.x + 1);
  // Picking another person changes the content, not the panel.
  await card(page, 'My Father').locator('.card-bg').click({ position: { x: 20, y: 20 }, force: true });
  await expect(panel.getByTestId('selected-name')).toHaveText('My Father');
  expect(await panel.boundingBox()).toEqual(p0);
  const fb = await stableBox(card(page, 'My Father').locator('.card-bg'));
  expect(fb.x + fb.width).toBeLessThanOrEqual(p0.x);
  // Resize by dragging its left edge and with the arrow keys.
  const r = (await page.getByTestId('panel-resizer').boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + 300);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 - 100, r.y + 300, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(Math.round(p0.width + 100));
  await page.getByTestId('panel-resizer').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(Math.round(p0.width + 116));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('End');
  await expect(page.getByTestId('panel-resizer')).toHaveAttribute('aria-valuenow', '560');
  // Pin and width survive a reload; unpin brings the pop-up back.
  await page.reload();
  await expect(panel).toBeVisible();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(560);
  await page.getByTestId('editor-unpin').click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('editor-popup')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('editor-popup')).toBeVisible();
  await expect(panel).toHaveCount(0);
});

test('phones: the Image tab takes a photo with the back camera or picks one; undo restores @mobile', async ({ page }) => {
  await fresh(page);
  await card(page, 'Me').locator('.card-bg').tap({ position: { x: 20, y: 20 } });
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-snap', 'half');
  await page.getByTestId('tab-image').tap();
  const camera = page.getByTestId('camera-image');
  await expect(camera).toHaveAttribute('capture', 'environment');
  await expect(camera).toHaveAttribute('accept', 'image/*');
  await expect(page.locator('label', { has: camera })).toContainText('Take a photo');
  const gallery = page.getByTestId('upload-image');
  await expect(gallery).not.toHaveAttribute('capture', /.*/);
  await expect(page.locator('label', { has: gallery })).toContainText('Choose from gallery');
  const photo = card(page, 'Me').locator('image');
  await expect(photo).toHaveCount(0);

  // Cancelling the crop changes nothing.
  await camera.setInputFiles({ name: 'cam.jpg', mimeType: 'image/jpeg', buffer: await makeImage(page, 4000, 3000, '#7c9a5b') });
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await page.getByTestId('crop-dialog').getByRole('button', { name: 'Cancel' }).tap();
  await expect(page.getByTestId('crop-dialog')).toBeHidden();
  await expect(photo).toHaveCount(0);

  // A 4000 × 3000 camera photo opens the crop dialog without error and lands on the card.
  await camera.setInputFiles({ name: 'cam.jpg', mimeType: 'image/jpeg', buffer: await makeImage(page, 4000, 3000, '#7c9a5b') });
  await expect(page.getByTestId('crop-apply')).toBeEnabled();
  await expect(page.getByTestId('crop-dialog')).not.toContainText(/could not|tidak bisa/i);
  await page.getByTestId('crop-apply').tap();
  await expect(photo).toHaveCount(1);
  // The "Undo" toast brings the old (empty) photo back.
  await expect(page.getByTestId('toast')).toContainText('Photo of Me updated');
  await page.getByTestId('toast-action').tap();
  await expect(photo).toHaveCount(0);

  // The card menu offers "Take a photo" on touch screens; the picker it opens uses the camera.
  const bg = card(page, 'My Father').locator('.card-bg');
  await stableBox(bg);
  const b = (await bg.boundingBox())!;
  const opts = { pointerType: 'touch', isPrimary: true, pointerId: 9, clientX: b.x + 30, clientY: b.y + 30, bubbles: true, button: 0, buttons: 1 };
  await bg.dispatchEvent('pointerdown', opts);
  await page.waitForTimeout(650);
  await bg.dispatchEvent('pointerup', { ...opts, buttons: 0 });
  await expect(page.getByTestId('pm-photo')).toContainText('Take a photo');
  await expect(page.getByTestId('photo-input')).toHaveAttribute('capture', 'environment');
  await page.keyboard.press('Escape');

  // Canvas background: camera and gallery too.
  await page.getByTestId('btn-settings').tap();
  await page.getByTestId('bg-kind-image').tap();
  await expect(page.getByTestId('bg-camera-input')).toHaveAttribute('capture', 'environment');
  await expect(page.locator('label', { has: page.getByTestId('bg-image-input') })).toContainText('Choose from gallery');
});

test('desktop: no camera buttons; the card menu uploads a photo, Ctrl+Z restores the old one', async ({ page }) => {
  await fresh(page);
  await page.getByTestId('editor-popup').getByTestId('tab-image').click();
  await expect(page.getByTestId('camera-image')).toHaveCount(0);
  await expect(page.getByTestId('upload-image')).toHaveCount(1);
  await expect(page.getByTestId('photo-input')).not.toHaveAttribute('capture', /.*/);
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('bg-kind-image').click();
  await expect(page.getByTestId('bg-camera-input')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await card(page, 'My Father').locator('.card-bg').click({ button: 'right', force: true });
  await expect(page.getByTestId('pm-photo')).toContainText('Upload a photo');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('pm-photo').click()]);
  await chooser.setFiles({ name: 'dad.png', mimeType: 'image/png', buffer: await makeImage(page, 900, 700, '#1d3557', 'image/png') });
  await page.getByTestId('crop-apply').click();
  const photo = card(page, 'My Father').locator('image');
  await expect(photo).toHaveCount(1);
  await page.getByTestId('tree-canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(photo).toHaveCount(0);
});
