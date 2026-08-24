import { Page, expect, test } from '@playwright/test';

// The fault this guards against surfaced as an unhandled rejection out of
// pdf.js when a second render claimed a canvas the first still held.
const sameCanvasError = /Cannot use the same canvas during multiple render/i;

// Superseded renders reject asynchronously; a negative assertion has to wait
// for them rather than read an empty array before they arrive.
const settle = (page: Page) => page.waitForTimeout(2000);

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
};

test.describe('pdf viewer', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto('./viewer.html');
  });

  test('viewer loads', async ({ page }) => {
    const doc1 = page.locator('#doc-1');
    await expect(doc1).toBeAttached();
  });

  test('loads canvas', async ({ page }) => {
    const canvasElement = page.locator('#doc-1-canvas');
    await expect(canvasElement).toBeAttached();
  });

  test('loads textLayer', async ({ page }) => {
    const doc1 = page.locator('#doc-1');
    const textLayer = doc1.locator('.textLayer');
    await expect(textLayer).toBeAttached();
  });

  test('controls work', async ({ page }) => {
    const doc1 = page.locator('#doc-1');
    const pageNumber = doc1.locator('input.page-number-input');
    await expect(pageNumber).toHaveValue('1');
    await pageNumber.fill('3');
    await pageNumber.blur();
    await expect(pageNumber).toHaveValue('3');

    const pageBack = doc1.locator('.prev-button');
    const pageForward = doc1.locator('.next-button');
    await pageBack.click();
    await expect(pageNumber).toHaveValue('2');
    await pageForward.click();
    await pageForward.click();
    await expect(pageNumber).toHaveValue('4');

    const pageContainer = doc1.locator('.page-container');
    await expect(pageContainer).toHaveAttribute('style', 'width: 80%;');
    const zoomSelect = doc1.locator('.zoom-select');
    await expect(zoomSelect).toHaveValue('80');
    await zoomSelect.selectOption('100');
    await expect(zoomSelect).toHaveValue('100');
    await expect(pageContainer).toHaveAttribute('style', 'width: 100%;');
  });

  test('rapid page navigation does not race the canvas', async ({ page }) => {
    const errors = collectErrors(page);
    const doc1 = page.locator('#doc-1');
    await expect(doc1.locator('.textLayer')).toBeAttached();

    const pageForward = doc1.locator('.next-button');
    // Faster than a render can finish, which is what claimed the canvas twice.
    for (let i = 0; i < 10; i++) {
      await pageForward.click({ noWaitAfter: true });
    }

    const pageNumber = doc1.locator('input.page-number-input');
    await expect(pageNumber).toHaveValue('11');
    await expect(doc1.locator('.textLayer')).toBeAttached();
    // The failure arrives as an async rejection, so let superseded renders settle.
    await settle(page);
    expect(errors.filter((e) => sameCanvasError.test(e))).toEqual([]);
  });

  test('holding a key to skip pages settles on the landed page', async ({ page }) => {
    const errors = collectErrors(page);
    const doc1 = page.locator('#doc-1');
    await expect(doc1.locator('.textLayer')).toBeAttached();
    await doc1.click({ position: { x: 5, y: 5 } });

    // Dispatched in one synchronous burst: this is what auto-repeat does while
    // a key is held, and awaiting each press instead would hide the overlap.
    await doc1.evaluate((el, n) => {
      for (let i = 0; i < n; i++) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      }
    }, 8);

    const pageNumber = doc1.locator('input.page-number-input');
    await expect(pageNumber).toHaveValue('9');
    await settle(page);
    // The text layer must describe the page the controls claim, not a
    // superseded render that finished last.
    await expect(doc1.locator('.textLayer')).toBeAttached();
    await expect(doc1.locator('.text-layer > .textLayer')).toHaveCount(1);
    expect(errors.filter((e) => sameCanvasError.test(e))).toEqual([]);
  });

  test('resizing leaves exactly one text layer', async ({ page }) => {
    const doc1 = page.locator('#doc-1');
    await expect(doc1.locator('.textLayer')).toBeAttached();

    const pageForward = doc1.locator('.next-button');
    // Each page view used to add its own resize listener, so N pages meant N
    // concurrent handlers all rewriting the layer on a single resize.
    for (let i = 0; i < 4; i++) {
      await pageForward.click();
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.setViewportSize({ width: 1280, height: 720 });

    await expect(doc1.locator('.text-layer > .textLayer')).toHaveCount(1);
    await expect(doc1.locator('.textLayer span').first()).toBeAttached();
  });

  test('serves the pdfjs wasm decoders beside the worker', async ({ page }) => {
    const notFound: string[] = [];
    page.on('response', (r) => {
      if (r.status() === 404 && /wasm/i.test(r.url())) notFound.push(r.url());
    });

    await page.goto('./viewer.html');
    await expect(page.locator('#doc-1').locator('.textLayer')).toBeAttached();

    // pdf.js 6 resolves its JBIG2/OpenJPEG/QCMS decoders against `wasmUrl`,
    // which defaults to a page-relative "wasm" and 404s on nested routes.
    const probe = await page.request.get('/wasm/openjpeg_nowasm_fallback.js');
    expect(probe.status()).toBe(200);
    expect(notFound).toEqual([]);
  });
});
