import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fixture = path.resolve('tests/fixtures/synthetic.ged');

async function fresh(page: Page, lang: 'en' | 'id' | 'jv' | null = 'en') {
  await page.goto('/');
  // Start every test from an empty browser store.
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((r) => {
      const req = indexedDB.deleteDatabase('sambungdulur');
      req.onsuccess = req.onerror = req.onblocked = () => r();
    });
  });
  // Most tests assert English labels; the app default (Indonesian) is covered separately.
  if (lang) await page.evaluate((l) => localStorage.setItem('sambungdulur.lang', l), lang);
  await page.reload();
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
    const before = await card(page, 'My Father').locator('.card-bg').boundingBox();
    await page.getByTestId('btn-manual').click();
    await expect(page.getByTestId('manual-continue')).toBeDisabled();
    await expect(page.getByTestId('manual-continue')).toBeEnabled({ timeout: 6000 });
    await page.getByTestId('manual-continue').click();
    await expect(page.getByTestId('manual-save')).toBeDisabled();
    // The editor panel slides away (0.2s) and the cards shift with it; wait before measuring.
    await page.waitForTimeout(500);
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
    const reloaded = await card(page, 'My Father').locator('.card-bg').boundingBox();
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
  await page.getByTestId('sidebar').getByTestId('add-child').click();
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
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('more-menu')).toBeVisible();
  // Arrow keys move through items; Enter runs one and closes the menu.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('more-theme')).toHaveAttribute('data-highlighted', '');
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
