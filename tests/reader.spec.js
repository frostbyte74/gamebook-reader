import { test, expect } from '@playwright/test';
import { makePdf } from './pdf-fixture.js';

async function expectIllustration(page, pdfPage, color) {
  const canvas = page.locator('#page-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-pdf-page', String(pdfPage));
  const pixel = await canvas.evaluate(element => [...element.getContext('2d').getImageData(
    Math.floor(element.width * 0.5), Math.floor(element.height * 0.45), 1, 1,
  ).data]);
  expect(pixel.slice(0, 3)).toEqual(color);
}

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
  await expect(page.locator('#cover-thumbnail')).toBeHidden();
  await page.locator('#pdf-input').setInputFiles({ name: 'My Adventure.pdf', mimeType: 'application/pdf', buffer: makePdf() });
  await expect(page.getByRole('dialog', { name: 'Make yourself comfortable' })).toBeVisible();
  await page.getByLabel('Printed page 1 starts at PDF page').fill('3');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('#page-text')).toContainText('You arrive at the gate.');
  await expect(page.locator('#page-counter')).toHaveText('PAGE 1 OF 3');
  await expect(page.locator('#cover-background')).toHaveCSS('background-image', /data:image\/jpeg;base64,/);
  const thumbnail = page.getByRole('img', { name: 'Cover of My Adventure' });
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const firstThumbnail = await thumbnail.getAttribute('src');
  const headerRight = await page.locator('.masthead').evaluate(element => element.getBoundingClientRect().right);
  const thumbnailRight = await thumbnail.evaluate(element => element.getBoundingClientRect().right);
  expect(thumbnailRight).toBeCloseTo(headerRight, 0);
  const firstCover = await page.locator('#cover-background').evaluate(element => element.style.backgroundImage);
  await page.getByRole('button', { name: 'Turn to page 3' }).click();
  await expect(page.locator('#page-text')).toContainText('You found the ending.');
  await expect(page.locator('#next-page')).toBeHidden();
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await page.getByLabel('Use this PDF page as the cover').fill('2');
  await page.locator('#cover-opacity').fill('30');
  await page.getByLabel('Text view reading size').selectOption('24');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#cover-background')).toHaveCSS('opacity', '0.3');
  await expect(page.locator('#cover-background')).not.toHaveCSS('background-image', firstCover);
  await expect(thumbnail).not.toHaveAttribute('src', firstThumbnail);
  await expect(thumbnail).toHaveCSS('opacity', '1');
  const updatedThumbnail = await thumbnail.getAttribute('src');
  await page.reload();
  await expect(page.locator('#page-text')).toContainText('You found the ending.');
  await expect(page.locator('#book-title')).toHaveText('My Adventure');
  await expect(page.locator('#cover-background')).toHaveCSS('opacity', '0.3');
  await expect(thumbnail).toHaveAttribute('src', updatedThumbnail);
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

test('invalid PDFs preserve the book and scanned PDFs retain their artwork without OCR', async ({ page }) => {
  await page.locator('#pdf-input').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await expect(page.getByRole('status')).toContainText('Could not open this book');
  await expect(page.locator('#book-title')).toHaveText('The Lantern at Blackthorn Gate');
  await page.getByRole('button', { name: 'Turn to page 3' }).click();
  await expect(page.getByRole('heading', { name: 'Page 3', exact: true })).toBeVisible();
  await page.locator('#pdf-input').setInputFiles({ name: 'scanned.pdf', mimeType: 'application/pdf', buffer: makePdf({ scanned: true }) });
  await expect(page.getByRole('dialog', { name: 'Make yourself comfortable' })).toBeVisible();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expectIllustration(page, 1, [68, 119, 68]);
  await expect(page.locator('#image-only-note')).toBeVisible();
  await expect(page.locator('#image-only-note')).toContainText('no selectable text');
  await page.getByRole('button', { name: 'Text view', exact: true }).click();
  await expect(page.locator('#page-text')).toBeVisible();
  await expect(page.locator('#page-text')).toContainText('Switch to Original page');
  await page.getByRole('button', { name: 'Original page', exact: true }).click();
  await expectIllustration(page, 1, [68, 119, 68]);
});

test('original pages preserve embedded images at the correct offset and survive view changes and reloads', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#pdf-input').setInputFiles({ name: 'Illustrated.pdf', mimeType: 'application/pdf', buffer: makePdf() });
  await expect(page.getByRole('dialog', { name: 'Make yourself comfortable' })).toBeVisible();
  await page.getByLabel('Printed page 1 starts at PDF page').fill('3');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expectIllustration(page, 3, [221, 34, 34]);
  await expect(page.getByRole('button', { name: 'Original page', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Turn to page 3' }).click();
  await expectIllustration(page, 5, [34, 68, 221]);
  const canvasBottom = await page.locator('#page-canvas').evaluate(element => element.getBoundingClientRect().bottom);
  const choicesTop = await page.locator('.choices-section').evaluate(element => element.getBoundingClientRect().top);
  expect(choicesTop).toBeGreaterThan(canvasBottom);
  await page.getByRole('button', { name: 'Text view', exact: true }).click();
  await expect(page.locator('#original-page-view')).toBeHidden();
  await expect(page.locator('#page-text')).toBeVisible();
  await expect(page.locator('#page-text')).toContainText('You found the ending.');
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('button', { name: 'Text view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Text view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#original-page-view')).toBeHidden();
  await page.getByRole('button', { name: 'Original page', exact: true }).click();
  await expectIllustration(page, 5, [34, 68, 221]);
  await page.reload();
  await expectIllustration(page, 5, [34, 68, 221]);
  await page.getByRole('button', { name: 'Retrace a step' }).click();
  await expectIllustration(page, 3, [221, 34, 34]);
  const previousWidth = await page.locator('#page-canvas').evaluate(element => element.width);
  await page.setViewportSize({ width: 320, height: 720 });
  await expect.poll(() => page.locator('#page-canvas').evaluate(element => element.width)).not.toBe(previousWidth);
  await expectIllustration(page, 3, [221, 34, 34]);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
  await page.getByRole('button', { name: 'Restart book' }).click();
  await page.getByRole('button', { name: 'Restart adventure' }).click();
  await expectIllustration(page, 3, [221, 34, 34]);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.locator('#page-display')).toBeHidden();
  await expect(page.locator('#cover-thumbnail')).toBeHidden();
  await expect(page.locator('#cover-thumbnail')).not.toHaveAttribute('src');
  await expect(page.locator('#original-page-view')).toBeHidden();
  await expect(page.locator('#page-text')).toBeVisible();
  expect(errors).toEqual([]);
});

test('rapid page turns and replacing books never leave a stale illustration', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#pdf-input').setInputFiles({ name: 'First.pdf', mimeType: 'application/pdf', buffer: makePdf() });
  await page.getByRole('dialog', { name: 'Make yourself comfortable' }).waitFor();
  await page.getByLabel('Printed page 1 starts at PDF page').fill('3');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expectIllustration(page, 3, [221, 34, 34]);
  await page.evaluate(() => {
    document.querySelector('#next-page').click();
    document.querySelector('#next-page').click();
    document.querySelector('#back-page').click();
    document.querySelector('#back-page').click();
    document.querySelector('#view-text').click();
    document.querySelector('#view-original').click();
  });
  await expectIllustration(page, 3, [221, 34, 34]);
  await page.locator('#pdf-input').setInputFiles({ name: 'Second.pdf', mimeType: 'application/pdf', buffer: makePdf({ scanned: true }) });
  await page.getByRole('dialog', { name: 'Make yourself comfortable' }).waitFor();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('#book-title')).toHaveText('Second');
  await expectIllustration(page, 1, [68, 119, 68]);
  expect(errors).toEqual([]);
});

test('printed labels automatically map choices, while manual overrides and detected numbering survive reloads', async ({ page }) => {
  await page.locator('#pdf-input').setInputFiles({ name: 'Labeled.pdf', mimeType: 'application/pdf', buffer: makePdf({ labeled: true }) });
  await page.getByRole('dialog', { name: 'Make yourself comfortable' }).waitFor();
  await expect(page.getByLabel('Printed page 1 starts at PDF page')).toHaveValue('3');
  await expect(page.locator('#detected-numbering')).toContainText('printed page 1 at PDF page 3');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('#pdf-page-position')).toHaveText('Printed page 1 / PDF page 3 of 5');
  await expectIllustration(page, 3, [221, 34, 34]);
  await page.getByRole('button', { name: 'Turn to page 3' }).click();
  await expectIllustration(page, 5, [34, 68, 221]);
  await expect(page.locator('#pdf-page-position')).toHaveText('Printed page 3 / PDF page 5 of 5');
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await page.getByLabel('Printed page 1 starts at PDF page').fill('1');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expectIllustration(page, 1, [68, 119, 68]);
  await page.reload();
  await expectIllustration(page, 1, [68, 119, 68]);
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await expect(page.getByLabel('Printed page 1 starts at PDF page')).toHaveValue('1');
  await page.getByRole('button', { name: 'Use detected numbering' }).click();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expectIllustration(page, 3, [221, 34, 34]);
  await page.reload();
  await expect(page.locator('#pdf-page-position')).toHaveText('Printed page 1 / PDF page 3 of 5');
  await expectIllustration(page, 3, [221, 34, 34]);
});

test('old saved books correct the default offset without overwriting existing manual offsets', async ({ page }) => {
  await page.locator('#pdf-input').setInputFiles({ name: 'Saved.pdf', mimeType: 'application/pdf', buffer: makePdf({ labeled: true }) });
  await page.getByRole('dialog', { name: 'Make yourself comfortable' }).waitFor();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expectIllustration(page, 3, [221, 34, 34]);

  async function simulateOldSavedBook(firstPage) {
    await page.evaluate(firstPage => new Promise((resolve, reject) => {
      const request = indexedDB.open('turning-pages', 1);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('reader', 'readwrite');
        const store = transaction.objectStore('reader');
        const bookRequest = store.get('book');
        bookRequest.onsuccess = () => {
          const book = bookRequest.result;
          book.firstPage = firstPage;
          delete book.firstPageSource;
          delete book.detectedFirstPage;
          store.put(book, 'book');
        };
        const currentRequest = store.get('current');
        currentRequest.onsuccess = () => {
          const current = currentRequest.result;
          current.state = { page: 2, history: [1] };
          store.put(current, 'current');
        };
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    }), firstPage);
  }

  await simulateOldSavedBook(1);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Corrected printed page numbering');
  await expect(page.locator('#pdf-page-position')).toHaveText('Printed page 1 / PDF page 3 of 5');
  await expectIllustration(page, 3, [221, 34, 34]);
  await expect(page.getByRole('button', { name: 'Retrace a step' })).toBeDisabled();
  await simulateOldSavedBook(4);
  await page.reload();
  await expect(page.locator('#pdf-page-position')).toHaveText('Printed page 2 / PDF page 5 of 5');
  await expectIllustration(page, 5, [34, 68, 221]);
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await expect(page.getByLabel('Printed page 1 starts at PDF page')).toHaveValue('4');
  await expect(page.locator('#detected-numbering')).toContainText('printed page 1 at PDF page 3');
});
