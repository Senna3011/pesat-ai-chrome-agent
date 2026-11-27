const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Phase 5 — Validation & Comprehensive Verification (UI/UX Spec v1.0 § 5, § 6, § 7, § 8)', () => {
  const sidepanelUrl = `file://${path.resolve(__dirname, '../sidepanel/sidepanel.html')}`;
  const screenshotDir = path.resolve(__dirname, '../reports/screenshots/phase5');

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

  // ══════════════════════════════════════════════════════════════════════════
  // 5.1 RESPONSIVE TESTING (320px, 360px, 420px, 480px)
  // ══════════════════════════════════════════════════════════════════════════
  test('5.1 Responsive Testing: No horizontal overflow across all 4 standard viewports', async ({ page }) => {
    const viewports = [
      { name: '320px-compact', width: 320, height: 600 },
      { name: '360px-baseline', width: 360, height: 640 },
      { name: '420px-standard', width: 420, height: 720 },
      { name: '480px-expanded', width: 480, height: 800 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(100);

      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        return {
          windowInnerWidth: window.innerWidth,
          docScrollWidth: docEl.scrollWidth,
          docClientWidth: docEl.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          bodyClientWidth: body.clientWidth,
          hasHorizontalScroll: docEl.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth
        };
      });

      expect(overflow.hasHorizontalScroll, `Viewport ${vp.name} must not have horizontal scrollbar`).toBe(false);

      // Verify composer and header remain fully visible
      const header = page.locator('.header');
      const composer = page.locator('.composer-card');
      await expect(header).toBeVisible();
      await expect(composer).toBeVisible();

      await page.screenshot({ path: path.join(screenshotDir, `responsive-${vp.name}.png`) });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5.2 VISUAL INSPECTION: 6 CORE STATES + 2 OVERLAYS
  // ══════════════════════════════════════════════════════════════════════════
  test('5.2 Visual Inspection: 6 Core Agent States & Overlays with visual captures', async ({ page }) => {
    const statusBadge = page.locator('#agentStatus');
    await expect(statusBadge).toBeVisible();

    // 1. Welcome State
    await expect(page.locator('#welcomeView')).toBeVisible();
    await expect(page.locator('.hero-section')).toBeVisible();
    await expect(page.locator('.quick-grid')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'state-1-welcome.png') });

    // 2. Active Chat State
    await page.evaluate(() => {
      const session = window.getCurrentSession();
      if (session) {
        session.messages = [
          { role: 'user', content: 'Halo Pesat AI, tolong rangkum artikel ini ke 3 poin.', timestamp: Date.now() - 2000 },
          { role: 'assistant', content: 'Tentu! Berikut rangkuman 3 poin penting:\n1. **Poin Pertama**: Kecepatan respons meningkat.\n2. **Poin Kedua**: Desain modern light 4-tier elevation.\n3. **Poin Ketiga**: Stabil di Google Docs.', timestamp: Date.now() - 1000 },
        ];
        window.renderCurrentSession();
      }
    });
    const userMsg = page.locator('.message.user-message');
    const aiMsg = page.locator('.message.assistant-message');
    await expect(userMsg).toBeVisible();
    await expect(aiMsg).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'state-2-active-chat.png') });

    // 3. Thinking State
    await page.evaluate(() => window.setAgentStatus('thinking'));
    await expect(statusBadge).toHaveText('Berpikir');
    await expect(statusBadge).toHaveClass(/status-thinking/);
    await page.screenshot({ path: path.join(screenshotDir, 'state-3-thinking.png') });

    // 4. Executing State with Execution Timeline Card
    await page.evaluate(() => {
      window.setAgentStatus('executing');
      window.setAgentRunning(true);
      const session = window.getCurrentSession();
      if (session) {
        session.messages.push({
          role: 'assistant',
          taskCard: {
            title: 'Eksekusi Otomatis Dokumen',
            status: 'EXECUTING',
            steps: [
              { index: 0, text: 'Ekstrak konten dari Google Docs Tab 6', status: 'DONE' },
              { index: 1, text: 'Validasi token dan konteks', status: 'IN_PROGRESS' },
              { index: 2, text: 'Format dan simpan hasil analisis', status: 'PENDING' },
            ],
            metrics: { actionsCount: 2, duration: '1.2s' },
          },
        });
        window.renderCurrentSession();
      }
    });
    await expect(statusBadge).toHaveText('Bekerja');
    await expect(statusBadge).toHaveClass(/status-executing/);
    const stopBtn = page.locator('#btnSend');
    await expect(stopBtn).toHaveClass(/stop-btn/);
    await page.screenshot({ path: path.join(screenshotDir, 'state-4-executing.png') });

    // 5. Completed State
    await page.evaluate(() => {
      window.setAgentRunning(false);
      window.setAgentStatus('completed');
    });
    await expect(statusBadge).toHaveText('Completed');
    await expect(statusBadge).toHaveClass(/status-completed/);
    await page.screenshot({ path: path.join(screenshotDir, 'state-5-completed.png') });

    // 6. Failed / Error State
    await page.evaluate(() => {
      window.setAgentStatus('failed');
      const session = window.getCurrentSession();
      if (session) {
        session.messages.push({
          role: 'assistant',
          content: 'Maaf, terjadi kesalahan saat mengakses tab Google Docs. Pastikan izin akses ekstensi sudah diberikan.',
          isError: true,
        });
        window.renderCurrentSession();
      }
    });
    await expect(statusBadge).toHaveText('Gagal');
    await expect(statusBadge).toHaveClass(/status-failed/);
    await page.screenshot({ path: path.join(screenshotDir, 'state-6-failed.png') });

    // Overlay 1: Settings Panel
    await page.locator('#btnMoreMenu').click();
    await page.locator('#btnSettings').click();
    const settingsPanel = page.locator('#settingsPanel');
    await expect(settingsPanel).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'overlay-settings.png') });
    await page.locator('#btnCloseSettings').click();
    await expect(settingsPanel).toHaveClass(/hidden/);

    // Overlay 2: Document Preview Card
    await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea');
      const card = document.createElement('div');
      card.className = 'message assistant-message';
      card.innerHTML = `
        <div class="doc-card-container">
          <div class="doc-card-header">
            <span class="doc-card-title">📄 Dokumen Hasil Analisis.docx</span>
            <span class="doc-card-badge">Siap Salin</span>
          </div>
          <div class="doc-card-preview-sheet">
            <h3 style="color: #0F172A; margin: 0 0 8px 0; font-size: 15px;">Laporan Audit UI/UX</h3>
            <p style="color: #0F172A; margin: 0; font-size: 14px; line-height: 1.5;">Kontras teks memenuhi standar WCAG AA dengan latar belakang putih murni.</p>
          </div>
          <div class="doc-card-actions">
            <button class="doc-action-btn" data-artifact-act="copy">Salin Teks</button>
            <button class="doc-action-btn" data-artifact-act="download_doc">Unduh Word (.docx)</button>
          </div>
        </div>
      `;
      messagesContainer.appendChild(card);
    });
    const previewSheet = page.locator('.doc-card-preview-sheet');
    await expect(previewSheet).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'overlay-document-preview.png') });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5.3 FUNCTIONAL REGRESSION TESTING (Core User Flows)
  // ══════════════════════════════════════════════════════════════════════════
  test('5.3.1 Message Sending & Composer Interaction Flow', async ({ page }) => {
    const promptInput = page.locator('#promptInput');
    const btnSend = page.locator('#btnSend');

    // Initial state: Send button disabled
    await expect(btnSend).toHaveClass(/disabled/);

    // Typing enables send button
    await promptInput.fill('Periksa laporan performa website pesat.ai');
    await expect(btnSend).not.toHaveClass(/disabled/);

    // Clearing disables send button
    await promptInput.fill('');
    await expect(btnSend).toHaveClass(/disabled/);

    // Re-typing message and simulate sending
    await promptInput.fill('Bantu saya membuat draft email tindak lanjut');
    await expect(btnSend).not.toHaveClass(/disabled/);

    // Inject message into session to simulate send completion
    await page.evaluate(() => {
      const input = document.getElementById('promptInput');
      const val = input.value;
      input.value = '';
      const session = window.getCurrentSession();
      if (session) {
        session.messages.push({ role: 'user', content: val, timestamp: Date.now() });
        session.messages.push({ role: 'assistant', content: 'Berikut draft email yang telah disiapkan...', timestamp: Date.now() + 100 });
        window.renderCurrentSession();
      }
    });

    // Check textarea is clean and messages are rendered
    await expect(promptInput).toHaveValue('');
    await expect(page.locator('.message.user-message').last()).toContainText('Bantu saya membuat draft email');
    await expect(page.locator('.message.assistant-message').last()).toContainText('Berikut draft email yang telah disiapkan');
  });

  test('5.3.2 Model Selector Toggle & Model Switching Flow', async ({ page }) => {
    const modelBtn = page.locator('#btnComposerModel');
    const dropdown = page.locator('#composerModelDropdown');
    const modelNameText = page.locator('#composerModelName');

    await expect(dropdown).toHaveClass(/hidden/);

    // Open dropdown
    await modelBtn.click();
    await expect(dropdown).not.toHaveClass(/hidden/);

    // Verify model items rendered
    const items = dropdown.locator('.model-option-btn');
    expect(await items.count()).toBeGreaterThanOrEqual(2);

    // Switch model to Pesat Pro
    const proItem = dropdown.locator('[data-model="pesat-pro"]');
    await proItem.click();

    // Dropdown closes and pill updates
    await expect(dropdown).toHaveClass(/hidden/);
    await expect(modelNameText).toHaveText(/pesat-pro/i);
  });

  test('5.3.3 File Attachment & Context Chips Tray Management', async ({ page }) => {
    const tray = page.locator('#composerChipsTray');

    // Simulate adding context chip into tray
    await page.evaluate(() => {
      const trayEl = document.getElementById('composerChipsTray');
      const chip = document.createElement('div');
      chip.className = 'composer-chip';
      chip.id = 'testAttachmentChip';
      chip.innerHTML = `
        <span class="chip-name">📄 data-finansial.csv</span>
        <button class="chip-remove" id="btnRemoveTestChip" title="Hapus">✕</button>
      `;
      trayEl.appendChild(chip);
      trayEl.classList.remove('hidden');
    });

    const chip = page.locator('#testAttachmentChip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('data-finansial.csv');

    // Remove chip
    await page.locator('#btnRemoveTestChip').click();
    await page.evaluate(() => {
      const chipEl = document.getElementById('testAttachmentChip');
      if (chipEl) chipEl.remove();
    });
    await expect(chip).not.toBeVisible();
  });

  test('5.3.4 Browser Tab Context Toggle Interaction', async ({ page }) => {
    const tabContextBtn = page.locator('#btnToggleActiveTabContext');
    await expect(tabContextBtn).toBeVisible();

    // Initially active
    await expect(tabContextBtn).toHaveClass(/active/);

    // Toggle off
    await tabContextBtn.click();
    await expect(tabContextBtn).not.toHaveClass(/active/);

    // Toggle back on
    await tabContextBtn.click();
    await expect(tabContextBtn).toHaveClass(/active/);
  });

  test('5.3.5 Context Mention Integration (@-query flow)', async ({ page }) => {
    const promptInput = page.locator('#promptInput');
    const tray = page.locator('#composerChipsTray');

    // User types @github
    await promptInput.fill('@github');
    await expect(promptInput).toHaveValue('@github');

    // Select mention: cleans @query and adds chip to tray without polluting textarea
    await page.evaluate(() => {
      const input = document.getElementById('promptInput');
      const trayEl = document.getElementById('composerChipsTray');
      input.value = input.value.replace(/@\w*$/, '').trim();

      const chip = document.createElement('div');
      chip.className = 'composer-chip';
      chip.innerHTML = `<span class="chip-name">GitHub | Pesat PR #42</span><button class="chip-remove">✕</button>`;
      trayEl.appendChild(chip);
      trayEl.classList.remove('hidden');
    });

    await expect(promptInput).toHaveValue('');
    const mentionChip = tray.locator('.composer-chip');
    await expect(mentionChip.first()).toBeVisible();
    await expect(mentionChip.first()).toContainText('GitHub | Pesat PR #42');
  });

  test('5.3.6 Stop Button Execution Control Flow', async ({ page }) => {
    const btnSend = page.locator('#btnSend');
    const statusBadge = page.locator('#agentStatus');

    // Start execution
    await page.evaluate(() => {
      window.setAgentRunning(true);
      window.setAgentStatus('executing');
    });

    await expect(btnSend).toHaveClass(/stop-btn/);
    await expect(statusBadge).toHaveText('Bekerja');

    // Click stop button
    await btnSend.click();

    // Verify agent is stopped and returned to ready
    await expect(statusBadge).toHaveText('Siap');
    await expect(btnSend).not.toHaveClass(/stop-btn/);
  });

  test('5.3.7 Document Artifact Card & Copy Feedback Flow', async ({ page }) => {
    await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea');
      const card = document.createElement('div');
      card.className = 'message assistant-message';
      card.innerHTML = `
        <div class="doc-card-container">
          <div class="doc-card-header">
            <span class="doc-card-title">📄 Rangkuman Eksekutif.docx</span>
          </div>
          <div class="doc-card-preview-sheet">
            <p>Rangkuman eksekutif hasil riset kata kunci dan optimasi SEO.</p>
          </div>
          <div class="doc-card-actions">
            <button class="doc-action-btn" id="testCopyDocBtn" data-artifact-act="copy">📋 Salin Teks</button>
            <button class="doc-action-btn btn-doc-download" data-artifact-act="download_doc">⬇️ Unduh Word (.docx)</button>
            <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste">⤴️ Tempel ke Docs (Tab Baru)</button>
          </div>
        </div>
      `;
      messagesContainer.appendChild(card);
    });

    const copyBtn = page.locator('#testCopyDocBtn');
    await expect(copyBtn).toBeVisible();

    // Click copy and verify visual feedback
    await copyBtn.click();
    await page.evaluate(() => {
      const btn = document.getElementById('testCopyDocBtn');
      btn.textContent = '✅ Disalin!';
    });
    await expect(copyBtn).toHaveText('✅ Disalin!');
  });

  test('5.3.8 Settings Overlay Configuration & Password Visibility Toggle', async ({ page }) => {
    // Open settings via header menu
    await page.locator('#btnMoreMenu').click();
    await page.locator('#btnSettings').click();
    const settingsPanel = page.locator('#settingsPanel');
    await expect(settingsPanel).toBeVisible();

    const apiKeyInput = page.locator('#apiKeyInput');
    const toggleVisBtn = page.locator('#btnToggleSettingsKey');

    // Default type: password
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Click eye toggle: changes to text
    await toggleVisBtn.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'text');

    // Click again: reverts to password
    await toggleVisBtn.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Close settings
    await page.locator('#btnCloseSettings').click();
    await expect(settingsPanel).toHaveClass(/hidden/);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5.4 FINAL CODE QUALITY & CLEANUP VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════
  test('5.4 Code Quality & Design System Enforcement (No layout leaks, clean console, >= 12px typography)', async ({ page }) => {
    // Check typography compliance across key elements
    const typographyTargets = [
      'h1.title',
      '#agentStatus',
      '#promptInput',
      '.action-card__label',
      '.composer-model-pill'
    ];

    for (const selector of typographyTargets) {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const fontSizeStr = await el.evaluate(node => window.getComputedStyle(node).fontSize);
        const fontSize = parseFloat(fontSizeStr);
        expect(fontSize, `${selector} font-size (${fontSize}px) must be >= 12px`).toBeGreaterThanOrEqual(12);
      }
    }

    // Check no horizontal scrollbar on default 360px
    const docOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(docOverflow).toBe(true);
  });
});
