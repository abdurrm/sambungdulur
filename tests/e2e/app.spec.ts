import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fixture = path.resolve('tests/fixtures/synthetic.ged');

async function fresh(page: Page, lang: 'en' | 'id' | 'jv' | null = 'en') {
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
  await dragSheet(page, 200);
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

test('the desktop editor panel can be resized and remembers its width', async ({ page }) => {
  await fresh(page);
  const sidebar = page.getByTestId('sidebar');
  const w0 = (await sidebar.boundingBox())!.width;
  const r = (await page.getByTestId('panel-resizer').boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + 200);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 100, r.y + 200, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(Math.round(w0 + 100));

  // Keyboard: the separator moves with the arrow keys and stops at its limits.
  await page.getByTestId('panel-resizer').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(Math.round(w0 + 100 - 16));
  await page.keyboard.press('End');
  await expect(page.getByTestId('panel-resizer')).toHaveAttribute('aria-valuenow', '560');

  // Width and open state survive a reload.
  await page.getByTestId('sidebar-toggle').click();
  await expect(sidebar).toHaveClass(/hidden/);
  await page.reload();
  await expect(sidebar).toHaveClass(/hidden/);
  await page.getByTestId('sidebar-toggle').click();
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(560);
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
