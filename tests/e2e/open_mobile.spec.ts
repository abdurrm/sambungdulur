import { test, expect } from '@playwright/test';

test('KK import keeps its icon and separates title from description @mobile', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sambungdulur.lang', 'id');
    localStorage.setItem('sambungdulur.onboarded', '1');
  });
  await page.goto('/');
  await page.getByTestId('btn-open').click();
  const choice = page.getByTestId('open-import-kk');
  for (const width of [320, 390, 435]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(choice).toBeVisible();
    const icon = await choice.locator('svg').boundingBox();
    expect(icon!.width).toBeGreaterThanOrEqual(20);
    expect(icon!.height).toBeGreaterThanOrEqual(20);
    const title = await choice.locator('.t').boundingBox();
    const description = await choice.locator('.d').boundingBox();
    expect(description!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
    expect(title!.x).toBeGreaterThanOrEqual(icon!.x + icon!.width);
    const badge = await choice.locator('.badge').boundingBox();
    expect(badge!.width).toBe(46);
    expect(badge!.height).toBe(46);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await choice.click();
  await expect(page.getByTestId('kk-dialog')).toBeVisible();
});
