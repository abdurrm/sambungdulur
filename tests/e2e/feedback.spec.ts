import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function fresh(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('sambungdulur.lang','en'); localStorage.setItem('sambungdulur.onboarded','1'); });
  await page.goto('/'); await expect(page.locator('[data-app-version]')).toHaveAttribute('data-app-version','1.0.1');
}
async function fillFeedback(page: Page) {
  await page.getByTestId('feedback-title').fill('Fictitious feedback & suggestion');
  await page.getByTestId('feedback-details').fill('Please make the branch selector easier to find.');
}

test('feedback previews only user inputs, copies the report, and prepares a GitHub issue after public confirmation', async ({page,context}) => {
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await fresh(page); await page.getByTestId('tree-title').fill('PRIVATE FAMILY TITLE');
  await page.getByTestId('btn-feedback').click(); await expect(page.getByTestId('feedback-open')).toBeDisabled();
  await fillFeedback(page); await page.getByTestId('feedback-steps').fill('Open the export dialog.');
  await expect(page.getByTestId('feedback-open')).toBeDisabled();
  const preview = await page.getByTestId('feedback-preview').inputValue();
  expect(preview).toContain('v1.0.1'); expect(preview).not.toContain('PRIVATE FAMILY TITLE'); expect(preview).not.toContain('Viewport:');
  await page.getByTestId('feedback-public-ready').check();
  const href = await page.getByTestId('feedback-open').getAttribute('href');
  const url = new URL(href!); expect(url.origin).toBe('https://github.com');
  expect(url.pathname).toBe('/abdurrm/sambungdulur/issues/new'); expect(url.searchParams.get('body')).toBe(preview);
  await page.getByTestId('feedback-copy').click(); await expect(page.getByTestId('feedback-copy-status')).toContainText('Copied');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g,'\n')).toBe(preview);
  const violations = (await new AxeBuilder({page}).include('[data-testid="feedback-dialog"]').analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(violations).toEqual([]);
  await page.keyboard.press('Escape'); await expect(page.getByTestId('feedback-dialog')).toBeHidden();
});

test('issue comments require a valid issue number; failed clipboard access offers manual copying', async ({page}) => {
  await fresh(page); await page.getByTestId('btn-feedback').click(); await fillFeedback(page);
  await page.getByTestId('feedback-destination').selectOption('comment'); await page.getByTestId('feedback-public-ready').check();
  await page.getByTestId('feedback-issue-number').fill('../9'); await expect(page.getByTestId('feedback-open')).toBeDisabled();
  await page.getByTestId('feedback-issue-number').fill('#123');
  await expect(page.getByTestId('feedback-open')).toHaveAttribute('href','https://github.com/abdurrm/sambungdulur/issues/123');
  await expect(page.getByTestId('feedback-copy-help')).toBeVisible();
  await page.getByTestId('feedback-environment').check(); await expect(page.getByTestId('feedback-preview')).toHaveValue(/Viewport:/);
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:() => Promise.reject(new Error('Unavailable'))}}));
  await page.getByTestId('feedback-copy').click(); await expect(page.getByTestId('feedback-copy-status')).toContainText('copy it manually');
  expect(await page.getByTestId('feedback-preview').evaluate((element:HTMLTextAreaElement) => element.selectionEnd-element.selectionStart === element.value.length)).toBe(true);
});

test('feedback is available from the touch menu without overflow @mobile', async ({page}) => {
  await fresh(page); await page.getByTestId('btn-more').click(); await page.getByTestId('more-feedback').click();
  await expect(page.getByTestId('feedback-dialog')).toBeVisible(); await fillFeedback(page);
  await page.getByTestId('feedback-kind').selectOption('idea'); await page.getByTestId('feedback-public-ready').check();
  await expect(page.getByTestId('feedback-open')).toHaveAttribute('href',/^https:\/\/github.com\/abdurrm\/sambungdulur\/issues\/new\?/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});
