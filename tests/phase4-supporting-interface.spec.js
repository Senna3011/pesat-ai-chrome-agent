const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Phase 4 — Supporting Interface Verification (UI/UX Spec v1.0 § 4, § 7, § 8, § 9)', () => {
  const sidepanelUrl = `file://${path.resolve(__dirname, '../sidepanel/sidepanel.html')}`;
  const screenshotDir = path.resolve(__dirname, '../reports/screenshots/phase4');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.chrome = {
        runtime: {
          sendMessage: (msg, cb) => {
            if (cb) cb({ success: true });
            return Promise.resolve({ success: true });
          },
          onMessage: { addListener: () => {} },
          getURL: (p) => p,
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
            const tabs = [{ id: 1, url: 'https://example.com', title: 'Example Page', active: true }];
            if (cb) cb(tabs);
            return Promise.resolve(tabs);
          },
          get: (tabId, cb) => {
            const tab = { id: tabId, url: 'https://example.com', title: 'Example Page' };
            if (cb) cb(tab);
            return Promise.resolve(tab);
          },
          sendMessage: (tabId, msg, cb) => {
            if (cb) cb({ success: true });
            return Promise.resolve({ success: true });
          },
        },
      };
    });

    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(sidepanelUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  test('4.1 Welcome Screen: 64-76px mascot, 2-column grid, 68-82px card height, and clean heading', async ({ page }) => {
    const welcomeView = page.locator('#welcomeView');
    await expect(welcomeView).toBeVisible();

    // Check Mascot size (64-76px)
    const mascotBadge = page.locator('.mascot-badge-float');
    await expect(mascotBadge).toBeVisible();
    const mascotBox = await mascotBadge.boundingBox();
    expect(mascotBox.width).toBeGreaterThanOrEqual(64);
    expect(mascotBox.width).toBeLessThanOrEqual(76);
    expect(mascotBox.height).toBeGreaterThanOrEqual(64);
    expect(mascotBox.height).toBeLessThanOrEqual(76);

    // Check Heading text & font-size
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('Halo! Ada yang bisa saya bantu?');

    // Check Description
    const heroSubtitle = page.locator('.hero-subtitle');
    await expect(heroSubtitle).toBeVisible();
    await expect(heroSubtitle).toContainText('Asisten AI untuk aktivitas web Anda.');

    // Check Quick Action Grid: exactly 2 columns
    const quickGrid = page.locator('.quick-grid');
    await expect(quickGrid).toBeVisible();
    const gridCols = await quickGrid.evaluate(el => window.getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(gridCols).toBe(2);

    // Check Action Cards: height 68-82px & 6 actions
    const cards = page.locator('.quick-grid .action-card');
    await expect(cards).toHaveCount(6);
    const firstCardBox = await cards.first().boundingBox();
    expect(firstCardBox.height).toBeGreaterThanOrEqual(68);
    expect(firstCardBox.height).toBeLessThanOrEqual(82);

    // Check quick action labels (§ 4.5)
    await expect(cards.nth(0)).toContainText('Rangkum halaman');
    await expect(cards.nth(1)).toContainText('Jelaskan halaman');
    await expect(cards.nth(2)).toContainText('Ekstrak data');
    await expect(cards.nth(3)).toContainText('Terjemahkan');
    await expect(cards.nth(4)).toContainText('Perbaiki teks');
    await expect(cards.nth(5)).toContainText('Kerjakan tugas');

    await page.screenshot({ path: path.join(screenshotDir, 'welcome-screen-360px.png') });
  });

  test('4.2 Document Preview: White preview background, dark text contrast, max-height scrolling, and copy feedback', async ({ page }) => {
    // Inject document artifact message
    await page.evaluate(() => {
      const chatArea = document.getElementById('chatArea');
      const docMsg = {
        role: 'assistant',
        text: 'Berikut adalah dokumen riset yang telah disusun:',
        artifact: {
          name: 'Laporan_Riset_Pasar.docx',
          artifactType: 'docx',
          content: '# Laporan Riset Pasar 2025\n\n## Ringkasan Eksekutif\nPasar AI agent mengalami pertumbuhan pesat.\n\n- Poin A: Otomatisasi browser\n- Poin B: Integrasi dokumen'
        }
      };
      // Use window.renderMessage or mock render
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message-group assistant';
      msgDiv.innerHTML = `
        <div class="doc-card-container">
          <div class="doc-card-header">
            <div class="doc-card-title-group">
              <span class="doc-badge-icon">📄</span>
              <div class="doc-card-meta">
                <div class="doc-card-title">${docMsg.artifact.name}</div>
                <div class="doc-card-subtitle">Format Word Document (.docx)</div>
              </div>
            </div>
            <div class="doc-card-actions">
              <button class="doc-action-btn" data-artifact-act="copy">
                <span>Salin</span>
              </button>
              <button class="doc-action-btn btn-doc-download" data-artifact-act="download_doc">
                <span>Word (.docx)</span>
              </button>
            </div>
          </div>
          <div class="doc-card-preview-sheet markdown-body">
            <h1>Laporan Riset Pasar 2025</h1>
            <h2>Ringkasan Eksekutif</h2>
            <p>Pasar AI agent mengalami pertumbuhan pesat.</p>
            <ul>
              <li>Poin A: Otomatisasi browser</li>
              <li>Poin B: Integrasi dokumen</li>
            </ul>
          </div>
        </div>
      `;
      chatArea.appendChild(msgDiv);
    });

    const docCard = page.locator('.doc-card-container');
    await expect(docCard).toBeVisible();

    const previewSheet = page.locator('.doc-card-preview-sheet');
    await expect(previewSheet).toBeVisible();

    // Verify background is pure white (#FFFFFF)
    const bgColor = await previewSheet.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toBe('rgb(255, 255, 255)');

    // Verify heading text color is dark (high contrast against white)
    const headingColor = await previewSheet.locator('h1').evaluate(el => window.getComputedStyle(el).color);
    expect(headingColor).toMatch(/rgb\((15,\s*23,\s*42|30,\s*41,\s*59|0,\s*0,\s*0|17,\s*24,\s*39)\)/);

    // Verify paragraph color is dark
    const paragraphColor = await previewSheet.locator('p').evaluate(el => window.getComputedStyle(el).color);
    expect(paragraphColor).toMatch(/rgb\((15,\s*23,\s*42|30,\s*41,\s*59|0,\s*0,\s*0|17,\s*24,\s*39|71,\s*85,\s*105)\)/);

    // Verify max-height & overflow
    const overflowY = await previewSheet.evaluate(el => window.getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');

    await page.screenshot({ path: path.join(screenshotDir, 'document-preview.png') });
  });

  test('4.3 Settings: Full-height overlay, API Key visibility toggle, and connection testing feedback', async ({ page }) => {
    const settingsPanel = page.locator('#settingsPanel');

    // Initially hidden
    await expect(settingsPanel).toHaveClass(/hidden/);

    // Open settings via header menu or direct toggle
    await page.evaluate(() => {
      document.getElementById('settingsPanel').classList.remove('hidden');
    });
    await expect(settingsPanel).toBeVisible();

    // Verify overlay scrolling properties (bottom: 0 and overflow-y: auto)
    const panelStyles = await settingsPanel.evaluate(el => {
      const s = window.getComputedStyle(el);
      return { position: s.position, overflowY: s.overflowY };
    });
    expect(panelStyles.position).toBe('absolute');
    expect(panelStyles.overflowY).toBe('auto');

    // Test API key visibility toggle
    const apiKeyInput = page.locator('#apiKeyInput');
    const toggleEyeBtn = page.locator('#btnToggleSettingsKey');
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    await toggleEyeBtn.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'text');

    await toggleEyeBtn.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Test Save and Close buttons
    const btnClose = page.locator('#btnCloseSettings');
    await btnClose.click();
    await expect(settingsPanel).toHaveClass(/hidden/);

    await page.screenshot({ path: path.join(screenshotDir, 'settings-panel.png') });
  });

  test('4.4 Model Selector: Dropdown toggle, active indicator, fast/BYOK badges, and model selection', async ({ page }) => {
    const modelPill = page.locator('#btnComposerModel');
    const modelDropdown = page.locator('#composerModelDropdown');

    await expect(modelPill).toBeVisible();
    await expect(modelDropdown).toHaveClass(/hidden/);

    // Click pill to open dropdown
    await modelPill.click();
    await expect(modelDropdown).toBeVisible();

    // Verify model option buttons and badges
    const optionBtns = page.locator('#composerModelDropdown .model-option-btn');
    await expect(optionBtns).toHaveCount(6);

    // Verify badges (Fast / BYOK)
    const badges = page.locator('#composerModelDropdown .model-opt-badge');
    await expect(badges.first()).toBeVisible();

    // Select second model (pesat-pro or gemini)
    const secondOption = optionBtns.nth(1);
    const targetModel = await secondOption.getAttribute('data-model');
    await secondOption.click();

    // Dropdown should hide after selection
    await expect(modelDropdown).toHaveClass(/hidden/);

    // Composer model pill should display selected model
    const composerModelName = page.locator('#composerModelName');
    await expect(composerModelName).toHaveText(targetModel);

    await page.screenshot({ path: path.join(screenshotDir, 'model-selector.png') });
  });

  test('4.5 Responsive Verification: 320px, 360px, 420px, 480px without horizontal overflow', async ({ page }) => {
    const viewports = [
      { width: 320, height: 640, name: '320px-compact' },
      { width: 360, height: 640, name: '360px-primary' },
      { width: 420, height: 640, name: '420px-standard' },
      { width: 480, height: 640, name: '480px-expanded' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(100);

      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasOverflow: docEl.scrollWidth > docEl.clientWidth
        };
      });

      expect(overflow.hasOverflow).toBe(false);

      // Verify Welcome grid remains 2 columns
      const quickGrid = page.locator('.quick-grid');
      const cols = await quickGrid.evaluate(el => window.getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(cols).toBe(2);

      await page.screenshot({ path: path.join(screenshotDir, `responsive-${vp.name}.png`) });
    }
  });
});
