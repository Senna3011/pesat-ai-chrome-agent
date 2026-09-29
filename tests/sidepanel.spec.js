const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Pesat AI Extension - Sidepanel UI & Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock chrome extension APIs before loading sidepanel
    await page.addInitScript(() => {
      window.chrome = {
        runtime: {
          sendMessage: (msg, cb) => {
            if (cb) cb({ success: true, response: 'Mocked background response' });
            return Promise.resolve({ success: true });
          },
          onMessage: {
            addListener: () => {},
            removeListener: () => {},
          },
          getManifest: () => ({ version: '1.0.1', name: 'Pesat AI Agent' }),
        },
        storage: {
          local: {
            get: (keys, cb) => {
              const data = {
                apiKey: 'sk-test-mock-key',
                apiBaseUrl: 'https://api.pesatrouter.com/v1',
                apiFormat: 'openai-chat',
                modelName: 'pesat-flash',
                pesat_models: [
                  { id: 'pesat-flash', label: 'Pesat Flash', contextLimit: '128k', enabled: true },
                  { id: 'pesat-pro', label: 'Pesat Pro', contextLimit: '200k', enabled: true },
                ],
                pesat_sessions: [],
                googleClientId: '',
              };
              if (cb) cb(data);
              return Promise.resolve(data);
            },
            set: (items, cb) => {
              if (cb) cb();
              return Promise.resolve();
            },
          },
          session: {
            get: (keys, cb) => {
              const data = {};
              if (cb) cb(data);
              return Promise.resolve(data);
            },
            set: (items, cb) => {
              if (cb) cb();
              return Promise.resolve();
            },
          },
        },
        tabs: {
          query: (queryInfo, cb) => {
            const tabs = [{ id: 1, url: 'https://example.com', title: 'Example Page' }];
            if (cb) cb(tabs);
            return Promise.resolve(tabs);
          },
          sendMessage: (tabId, msg, cb) => {
            if (cb) cb({ success: true });
            return Promise.resolve({ success: true });
          },
        },
      };
    });

    // Load local sidepanel HTML
    const sidepanelPath = path.resolve(__dirname, '..', 'sidepanel', 'sidepanel.html');
    await page.goto(`file://${sidepanelPath}`);
  });

  test('should render header, title, and status badge', async ({ page }) => {
    await expect(page.locator('h1.title')).toHaveText('Pesat Agent');
    await expect(page.locator('#agentStatus')).toHaveText('Siap');
    await expect(page.locator('#btnSettings')).toBeVisible();
    await expect(page.locator('#btnHistory')).toBeVisible();
    await expect(page.locator('#btnNewChat')).toBeVisible();
  });

  test('should allow user to type and interact with prompt composer', async ({ page }) => {
    const promptInput = page.locator('#promptInput');
    const sendBtn = page.locator('#btnSend');

    await expect(promptInput).toBeVisible();
    await expect(sendBtn).toBeVisible();

    await promptInput.fill('Tolong rangkum isi halaman web ini');
    await expect(promptInput).toHaveValue('Tolong rangkum isi halaman web ini');
  });

  test('should open, configure, and close Settings Modal', async ({ page }) => {
    const btnSettings = page.locator('#btnSettings');
    const settingsPanel = page.locator('#settingsPanel');

    // Open settings
    await btnSettings.click();
    await expect(settingsPanel).toBeVisible();

    // Verify settings fields
    const apiKeyInput = page.locator('#apiKeyInput');
    await expect(apiKeyInput).toBeVisible();

    // Close settings
    await page.locator('#btnCancelSettings').click();
    await expect(settingsPanel).not.toBeVisible();
  });

  test('should open and close History Drawer', async ({ page }) => {
    const btnHistory = page.locator('#btnHistory');
    const historyDrawer = page.locator('#historyDrawer');

    // Open drawer
    await btnHistory.click();
    await expect(historyDrawer).toBeVisible();

    // Close drawer
    await page.locator('#btnCloseHistory').click();
    await expect(historyDrawer).not.toBeVisible();
  });

  test('should render Quick Action Chips', async ({ page }) => {
    await expect(page.locator('#chipSummarize')).toBeVisible();
    await expect(page.locator('#chipExtract')).toBeVisible();
  });
});
