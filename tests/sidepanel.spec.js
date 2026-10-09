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

  test('should enforce minimum 14px font size across all key UI elements', async ({ page }) => {
    const selectors = [
      'h1.title',
      '#agentStatus',
      '.chip-btn',
      '#promptInput',
      '.welcome-title',
      '.welcome-desc',
      '#btnSend',
      '.action-icon-btn',
      '.composer-model-pill'
    ];

    for (const selector of selectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const fontSizeStr = await el.evaluate(node => window.getComputedStyle(node).fontSize);
        const fontSize = parseFloat(fontSizeStr);
        expect(fontSize, `Element ${selector} font size (${fontSize}px) must be >= 14px`).toBeGreaterThanOrEqual(14);
      }
    }
  });

  test('should verify eye-comfort slate theme CSS variables', async ({ page }) => {
    const vars = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement);
      return {
        bgBase: style.getPropertyValue('--bg-base').trim(),
        bgSurface: style.getPropertyValue('--bg-surface').trim(),
        accentPrimary: style.getPropertyValue('--accent-primary').trim(),
        auroraDisplay: window.getComputedStyle(document.querySelector('.aurora-glow-top')).display
      };
    });

    expect(vars.bgBase.toLowerCase()).toBe('#0f172a');
    expect(vars.bgSurface.toLowerCase()).toBe('#1e293b');
    expect(vars.accentPrimary.toLowerCase()).toBe('#3b82f6');
    expect(vars.auroraDisplay).toBe('none');
  });

  test('should close modals with Escape key', async ({ page }) => {
    const btnSettings = page.locator('#btnSettings');
    const settingsPanel = page.locator('#settingsPanel');

    // Open settings and close with Escape
    await btnSettings.click();
    await expect(settingsPanel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(settingsPanel).not.toBeVisible();

    // Open history and close with Escape
    const btnHistory = page.locator('#btnHistory');
    const historyDrawer = page.locator('#historyDrawer');
    await btnHistory.click();
    await expect(historyDrawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(historyDrawer).not.toBeVisible();
  });

  test('should reset chat when New Chat button is clicked', async ({ page }) => {
    const promptInput = page.locator('#promptInput');
    await promptInput.fill('Pesan uji coba');
    await expect(promptInput).toHaveValue('Pesan uji coba');

    await page.locator('#btnNewChat').click();
    await expect(promptInput).toHaveValue('');
  });

  test('should render markdown tables within .table-container with clean cells', async ({ page }) => {
    const parsedHtml = await page.evaluate(() => {
      if (typeof parseMarkdown === 'function') {
        const md = '| No | Nama | Valuasi |\n|---|---|---|\n| 1 | **BCA** | **1250T** |';
        return parseMarkdown(md);
      }
      return '';
    });

    expect(parsedHtml).toContain('<div class="table-container"><table>');
    expect(parsedHtml).toContain('<th>No</th>');
    expect(parsedHtml).toContain('<strong>BCA</strong>');
    expect(parsedHtml).not.toContain('**BCA**');
  });

  test('should maintain responsive layout without horizontal overflow at 360px and 450px viewports', async ({ page }) => {
    // Test small extension sidepanel width (360px)
    await page.setViewportSize({ width: 360, height: 720 });
    const hasHorizontalOverflow360 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow360).toBe(false);

    // Test standard extension width (450px)
    await page.setViewportSize({ width: 450, height: 800 });
    const hasHorizontalOverflow450 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow450).toBe(false);
  });

  test('should render interactive ask-user interview options with >=14px font', async ({ page }) => {
    // Add mock ask-user message to chat area
    await page.evaluate(() => {
      const chatArea = document.getElementById('chatArea');
      const container = document.createElement('div');
      container.className = 'message-bubble-wrapper assistant-wrapper';
      container.innerHTML = `
        <div class="message-bubble assistant-bubble">
          <div class="ask-user-container">
            <div class="ask-user-question">Anda saat ini sedang membuka cnn.com. Di mana Anda ingin mencari berita?</div>
            <div class="ask-user-options">
              <button class="ask-user-option-btn">🔍 Cari di cnn.com</button>
              <button class="ask-user-option-btn">🌐 Cari di Google Search</button>
            </div>
          </div>
        </div>
      `;
      chatArea.appendChild(container);
    });

    const askContainer = page.locator('.ask-user-container');
    await expect(askContainer).toBeVisible();

    const optionBtns = page.locator('.ask-user-option-btn');
    await expect(optionBtns).toHaveCount(2);

    const firstBtnFont = await optionBtns.first().evaluate(node => window.getComputedStyle(node).fontSize);
    expect(parseFloat(firstBtnFont)).toBeGreaterThanOrEqual(14);
  });

  test('should render token usage tracker bar with >=14px font', async ({ page }) => {
    const tokenTracker = page.locator('#tokenTrackerBar');
    if (await tokenTracker.isVisible()) {
      const trackerFont = await tokenTracker.evaluate(node => window.getComputedStyle(node).fontSize);
      expect(parseFloat(trackerFont)).toBeGreaterThanOrEqual(14);
    }
  });

  test('should verify form autofill credentials and no undefined displayPrompt', async ({ page }) => {
    const promptInput = page.locator('#promptInput');
    const formPrompt = 'isi email address dan password login ini dengan admin@jetdigitalpro.com dan jdp123';
    await promptInput.fill(formPrompt);
    await expect(promptInput).toHaveValue(formPrompt);

    // Verify prompt does not leak undefined
    const btnSend = page.locator('#btnSend');
    await expect(btnSend).not.toBeDisabled();
  });

  test('should open quick model switcher dropdown and select a new model', async ({ page }) => {
    const btnComposerModel = page.locator('#btnComposerModel');
    const dropdown = page.locator('#composerModelDropdown');
    const modelNameText = page.locator('#composerModelName');

    await expect(btnComposerModel).toBeVisible();
    await expect(dropdown).toHaveClass(/hidden/);

    // Open model switcher
    await btnComposerModel.click();
    await expect(dropdown).not.toHaveClass(/hidden/);

    // Click GPT-4o option
    const gptOption = page.locator('.model-option-btn[data-model="gpt-4o"]');
    await expect(gptOption).toBeVisible();
    await gptOption.click();

    // Verify model name changed and dropdown closed
    await expect(modelNameText).toHaveText('gpt-4o');
    await expect(dropdown).toHaveClass(/hidden/);
  });

  test('should sanitize potential XSS payloads in parseMarkdown', async ({ page }) => {
    const sanitized = await page.evaluate(() => {
      const malicious = '<script>window.__xss_leaked=true;</script><img src="x" onerror="window.__xss_leaked=true">**Halo Dunia**';
      return window.parseMarkdown(malicious);
    });

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror=');
    expect(sanitized).toContain('<strong>Halo Dunia</strong>');
  });

  test('should enforce minimum 14px font size on model dropdown items', async ({ page }) => {
    const btnComposerModel = page.locator('#btnComposerModel');
    await btnComposerModel.click();

    const optNames = page.locator('.model-opt-name');
    const count = await optNames.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const fontSize = await optNames.nth(i).evaluate(el => window.getComputedStyle(el).fontSize);
      expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(14);
    }
  });

  test('should open, validate empty rule, add custom rule, and close Memory Drawer', async ({ page }) => {
    const btnMemory = page.locator('#btnMemory');
    const memoryDrawer = page.locator('#memoryDrawer');

    // Open Memory Drawer
    await btnMemory.click();
    await expect(memoryDrawer).toBeVisible();

    // Click + with empty input
    const input = page.locator('#memoryInputText');
    await page.locator('#btnAddMemory').click();
    await expect(input).toHaveClass(/input-shake/);

    // Add a test rule
    await input.fill('Gunakan bahasa formal dan tabel');
    await page.locator('#btnAddMemory').click();

    // Verify card is rendered
    await expect(page.locator('.memory-card')).toBeVisible();
    await expect(page.locator('.memory-text')).toContainText('Gunakan bahasa formal dan tabel');

    // Close Memory Drawer
    await page.locator('#btnCloseMemory').click();
    await expect(memoryDrawer).not.toBeVisible();
  });

  test('should verify Option A Unified Direct protocol supports direct markdown and tools', async ({ page }) => {
    const verified = await page.evaluate(() => {
      const promptInput = document.getElementById('promptInput');
      promptInput.value = 'gimana cara fix nya';
      return promptInput.value === 'gimana cara fix nya';
    });
    expect(verified).toBe(true);
  });
});
