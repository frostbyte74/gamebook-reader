import { test, expect } from '@playwright/test';
import { makePdf } from './pdf-fixture.js';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Reader settings' })).toBeEnabled();
});

test('demo follows branches, retraces, jumps, restarts and restores progress', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Page 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Turn to page 3' }).click();
  await expect(page.getByRole('heading', { name: 'Page 3', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Turn to page 6' }).click();
  await expect(page.getByRole('heading', { name: 'Page 6', exact: true })).toBeVisible();
  await expect(page.locator('#next-page')).toBeHidden();
  await page.getByRole('button', { name: 'Retrace a step' }).click();
  await expect(page.getByRole('heading', { name: 'Page 3', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Page number' }).fill('5');
  await page.locator('#jump-form').getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'Page 5', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    return new Promise(resolve => {
      const request = indexedDB.open('turning-pages', 1);
      request.onsuccess = () => {
        const get = request.result.transaction('reader').objectStore('reader').get('current');
        get.onsuccess = () => { resolve(get.result?.state.page); request.result.close(); };
      };
    });
  })).toBe(5);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Page 5', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restart book' }).click();
  await page.getByRole('button', { name: 'Restart adventure' }).click();
  await expect(page.getByRole('heading', { name: 'Page 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retrace a step' })).toBeDisabled();
  await page.locator('#next-page').click();
  await expect(page.getByRole('heading', { name: 'Page 2', exact: true })).toBeVisible();
});

test('PDF import extracts real text, maps printed numbers, renders cover and saves locally', async ({ page }) => {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4179/') && !/^(data:|blob:)/.test(request.url())) externalRequests.push(request.url());
  });
  await page.locator('#pdf-input').setInputFiles({ name: 'My Adventure.pdf', mimeType: 'application/pdf', buffer: makePdf() });
  await expect(page.getByRole('dialog', { name: 'Make yourself comfortable' })).toBeVisible();
  await page.getByLabel('Printed page 1 starts at PDF page').fill('3');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('#page-text')).toContainText('You arrive at the gate.');
  await expect(page.locator('#page-counter')).toHaveText('PAGE 1 OF 3');
  await expect(page.locator('#cover-background')).toHaveCSS('background-image', /data:image\/jpeg;base64,/);
  const firstCover = await page.locator('#cover-background').evaluate(element => element.style.backgroundImage);
  await page.getByRole('button', { name: 'Turn to page 3' }).click();
  await expect(page.locator('#page-text')).toContainText('You found the ending.');
  await expect(page.locator('#next-page')).toBeHidden();
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await page.getByLabel('Use this PDF page as the cover').fill('2');
  await page.locator('#cover-opacity').fill('30');
  await page.getByLabel('Reading text size').selectOption('24');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#cover-background')).toHaveCSS('opacity', '0.3');
  await expect(page.locator('#cover-background')).not.toHaveCSS('background-image', firstCover);
  await page.reload();
  await expect(page.locator('#page-text')).toContainText('You found the ending.');
  await expect(page.locator('#book-title')).toHaveText('My Adventure');
  await expect(page.locator('#cover-background')).toHaveCSS('opacity', '0.3');
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await expect(page.getByLabel('Printed page 1 starts at PDF page')).toHaveValue('3');
  await expect(page.getByLabel('Use this PDF page as the cover')).toHaveValue('2');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => innerWidth));
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
  await page.screenshot({ path: test.info().outputPath('imported-book.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('invalid and image-only PDFs report useful errors without replacing the current book', async ({ page }) => {
  await page.locator('#pdf-input').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await expect(page.getByRole('status')).toContainText('Could not open this book');
  await expect(page.locator('#book-title')).toHaveText('The Lantern at Blackthorn Gate');
  await page.locator('#pdf-input').setInputFiles({ name: 'scanned.pdf', mimeType: 'application/pdf', buffer: makePdf({ scanned: true }) });
  await expect(page.getByRole('status')).toContainText('run OCR');
  await page.getByRole('button', { name: 'Turn to page 3' }).click();
  await expect(page.getByRole('heading', { name: 'Page 3', exact: true })).toBeVisible();
});
