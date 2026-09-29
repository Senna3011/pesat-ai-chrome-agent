const { test, expect } = require('@playwright/test');

test('basic sanity check', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
});
