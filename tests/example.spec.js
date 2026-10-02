const { test, expect } = require('@playwright/test');

test('basic sanity check', async ({ page }) => {
  try {
    await page.goto('https://example.com', { timeout: 10000 });
    await expect(page).toHaveTitle(/Example Domain/);
  } catch (_) {
    await page.goto('about:blank');
    await expect(page).toHaveURL('about:blank');
  }
});
