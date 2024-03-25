import { expect, test } from '@playwright/test';

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
});