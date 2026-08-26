import { Page, expect, test } from '@playwright/test';

declare global {
  interface Window {
    documentViewerHarness: {
      renderDocument: (workerSrc: string) => (containerDiv: Element) => () => void;
      workerSrc: string;
    };
  }
}

// The fault this guards against surfaced as an unhandled rejection out of
// pdf.js when a second render claimed a canvas the first still held.
// Pinned to the same ref as example/viewer.html.
const fixture = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';

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
    // scaleTextLayer replaces rather than appends, so a count can never catch a
    // superseded run winning; compare the text itself against the same page
    // reached without a burst.
    const burstText = await doc1.locator('.text-layer > .textLayer').innerText();

    await page.goto('./viewer.html');
    await expect(doc1.locator('.textLayer span').first()).toBeAttached();
    await doc1.locator('input.page-number-input').fill('9');
    await doc1.locator('input.page-number-input').blur();
    await settle(page);
    const directText = await doc1.locator('.text-layer > .textLayer').innerText();

    expect(burstText.length).toBeGreaterThan(0);
    expect(burstText).toBe(directText);
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

    // Resizes fire outside the render chain, so several scaleTextLayer runs are
    // in flight at once and the newest must be the one that lands.
    await page.setViewportSize({ width: 900, height: 700 });
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.setViewportSize({ width: 1280, height: 720 });
    await settle(page);

    await expect(doc1.locator('.text-layer > .textLayer')).toHaveCount(1);
    await expect(doc1.locator('.textLayer span').first()).toBeAttached();

    // A stale run landing last leaves the layer sized for the width it was
    // built at, which a count assertion cannot see.
    const box = await page.evaluate(() => {
      const canvas = document.querySelector('#doc-1-canvas');
      const layer = document.querySelector('#doc-1 .text-layer > .textLayer');
      if (canvas === null || layer === null) return null;
      return {
        canvas: Math.round(canvas.getBoundingClientRect().width),
        layer: Math.round(layer.getBoundingClientRect().width),
      };
    });
    expect(box).not.toBeNull();
    expect(Math.abs(box!.layer - box!.canvas)).toBeLessThanOrEqual(2);
  });

  test('teardown releases the viewer and its listeners', async ({ page }) => {
    const errors = collectErrors(page);
    const result = await page.evaluate(async (fixtureUrl) => {
      const { renderDocument, workerSrc } = window.documentViewerHarness;
      const div = document.createElement('div');
      div.className = 'viewer-container';
      div.id = 'probe';
      div.setAttribute('data-document-url', fixtureUrl);
      document.body.appendChild(div);

      const settled = () => new Promise((r) => { setTimeout(r, 2500); });
      const teardown = renderDocument(workerSrc)(div);
      await settled();
      const rendered = div.querySelectorAll('canvas').length;

      teardown();
      await settled();
      const afterTeardown = div.children.length;

      // A leaked keydown listener would still drive the torn-down closure.
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await settled();
      const afterKey = div.children.length;

      return { rendered, afterTeardown, afterKey };
    }, fixture);

    expect(result.rendered).toBe(1);
    // destroy() must remove the viewer it built, not just stop rendering into it.
    expect(result.afterTeardown).toBe(0);
    expect(result.afterKey).toBe(0);
    await settle(page);
    expect(errors.filter((e) => sameCanvasError.test(e))).toEqual([]);
  });

  test('tearing down mid-load does not surface an error to the user', async ({ page }) => {
    const errors = collectErrors(page);
    const result = await page.evaluate(async (fixtureUrl) => {
      const { renderDocument, workerSrc } = window.documentViewerHarness;
      const div = document.createElement('div');
      div.className = 'viewer-container';
      div.id = 'probe-3';
      div.setAttribute('data-document-url', fixtureUrl);
      document.body.appendChild(div);

      // Destroyed while the document is still loading: pdf.js rejects the
      // loading promise with a plain Error, which must not reach handleError.
      const teardown = renderDocument(workerSrc)(div);
      teardown();
      await new Promise((r) => { setTimeout(r, 3000); });

      return {
        errorMessages: div.querySelectorAll('.error-message').length,
        children: div.children.length,
      };
    }, fixture);

    expect(result.errorMessages).toBe(0);
    expect(result.children).toBe(0);
    await settle(page);
    expect(errors.filter((e) => sameCanvasError.test(e))).toEqual([]);
  });

  test('re-rendering a container leaves exactly one viewer', async ({ page }) => {
    const errors = collectErrors(page);
    const counts = await page.evaluate(async (fixtureUrl) => {
      const { renderDocument, workerSrc } = window.documentViewerHarness;
      const div = document.createElement('div');
      div.className = 'viewer-container';
      div.id = 'probe-2';
      div.setAttribute('data-document-url', fixtureUrl);
      document.body.appendChild(div);

      // What init() does on call and on load, and what StrictMode does on mount.
      renderDocument(workerSrc)(div);
      renderDocument(workerSrc)(div);
      await new Promise((r) => { setTimeout(r, 3000); });
      return {
        wrappers: div.querySelectorAll('.wrapper').length,
        canvases: div.querySelectorAll('canvas').length,
      };
    }, fixture);

    expect(counts.wrappers).toBe(1);
    expect(counts.canvases).toBe(1);
    await settle(page);
    expect(errors.filter((e) => sameCanvasError.test(e))).toEqual([]);
  });

  test('a superseded teardown leaves the live render alone', async ({ page }) => {
    const result = await page.evaluate(async (fixtureUrl) => {
      const { renderDocument, workerSrc } = window.documentViewerHarness;
      const div = document.createElement('div');
      div.className = 'viewer-container';
      div.id = 'probe-4';
      div.setAttribute('data-document-url', fixtureUrl);
      document.body.appendChild(div);
      const settled = () => new Promise((r) => { setTimeout(r, 2500); });

      const teardownA = renderDocument(workerSrc)(div);
      await settled();
      renderDocument(workerSrc)(div);
      await settled();
      const live = div.querySelectorAll('canvas').length;

      // A holds a teardown for a render that no longer owns the container.
      teardownA();
      await settled();
      return { live, afterStale: div.querySelectorAll('canvas').length };
    }, fixture);

    expect(result.live).toBe(1);
    expect(result.afterStale).toBe(1);
  });

  test('a document that fails to load leaves no spinner behind', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { renderDocument, workerSrc } = window.documentViewerHarness;
      const div = document.createElement('div');
      div.className = 'viewer-container';
      div.id = 'probe-5';
      div.setAttribute('data-document-url', '/definitely-not-a-real-document.pdf');
      document.body.appendChild(div);
      renderDocument(workerSrc)(div);
      await new Promise((r) => { setTimeout(r, 6000); });
      return {
        spinners: div.querySelectorAll('.lds-ring').length,
        errors: div.querySelectorAll('.error-message').length,
      };
    });

    expect(result.errors).toBe(1);
    expect(result.spinners).toBe(0);
  });

  test('the highest zoom still renders pixels', async ({ page }) => {
    const doc1 = page.locator('#doc-1');
    await expect(doc1.locator('.textLayer span').first()).toBeAttached();
    await doc1.locator('.zoom-select').selectOption('400');
    await page.waitForTimeout(4000);

    const canvas = await page.evaluate(() => {
      const el = document.querySelector('#doc-1-canvas');
      if (!(el instanceof HTMLCanvasElement)) return null;
      const ctx = el.getContext('2d');
      const sample = ctx === null ? null : ctx.getImageData(0, 0, 400, 400).data;
      let opaque = 0;
      if (sample !== null) for (let i = 3; i < sample.length; i += 4) if (sample[i] !== 0) opaque++;
      return { width: el.width, height: el.height, pixels: el.width * el.height, opaque };
    });

    // Past the browser's cap the canvas comes back blank with no error raised.
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBeLessThanOrEqual(32767);
    expect(canvas!.height).toBeLessThanOrEqual(32767);
    expect(canvas!.pixels).toBeLessThanOrEqual(2 ** 25);
    expect(canvas!.opaque).toBeGreaterThan(0);
  });

  test('a container revealed after render still paints', async ({ page }) => {
    const result = await page.evaluate(async (fixtureUrl) => {
      const { renderDocument, workerSrc } = window.documentViewerHarness;
      const host = document.createElement('div');
      host.style.display = 'none';
      const div = document.createElement('div');
      div.className = 'viewer-container';
      div.id = 'probe-6';
      div.setAttribute('data-document-url', fixtureUrl);
      host.appendChild(div);
      document.body.appendChild(host);

      renderDocument(workerSrc)(div);
      await new Promise((r) => { setTimeout(r, 3000); });
      const hidden = div.querySelector('canvas');
      const whileHidden = hidden instanceof HTMLCanvasElement ? hidden.width : -1;

      // A tab, accordion or modal opening fires no window resize event.
      host.style.display = 'block';
      await new Promise((r) => { setTimeout(r, 3000); });
      const shown = div.querySelector('canvas');
      const layer = div.querySelector('.text-layer > .textLayer');
      return {
        whileHidden,
        width: shown instanceof HTMLCanvasElement ? shown.width : -1,
        layerWidth: layer === null ? -1 : Math.round(layer.getBoundingClientRect().width),
        canvasCss: shown === null ? -1 : Math.round(shown.getBoundingClientRect().width),
      };
    }, fixture);

    expect(result.whileHidden).toBe(0);
    expect(result.width).toBeGreaterThan(0);
    expect(Math.abs(result.layerWidth - result.canvasCss)).toBeLessThanOrEqual(2);
  });

  test('the text layer tracks the canvas when a scrollbar takes width', async ({ page }) => {
    const doc1 = page.locator('#doc-1');
    await expect(doc1.locator('.textLayer span').first()).toBeAttached();

    // What a classic, non-overlay scrollbar does on Windows and Linux: the
    // canvas lays out inside .wrapper, so it is narrower than the container
    // that --scale-factor would otherwise be derived from.
    await page.addStyleTag({ content: '.document-viewer-ts .wrapper { border-right: 15px solid transparent; }' });
    await page.setViewportSize({ width: 1100, height: 800 });
    await settle(page);

    const box = await page.evaluate(() => {
      const c = document.querySelector('#doc-1-canvas');
      const l = document.querySelector('#doc-1 .text-layer > .textLayer');
      if (c === null || l === null) return null;
      return { canvas: c.getBoundingClientRect().width, layer: l.getBoundingClientRect().width };
    });

    expect(box).not.toBeNull();
    expect(Math.abs(box!.layer - box!.canvas)).toBeLessThanOrEqual(2);
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
