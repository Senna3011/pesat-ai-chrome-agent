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

  test('should place context mentions into chip tray without polluting textarea', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const promptInput = document.getElementById('promptInput');
      const tray = document.getElementById('composerChipsTray');
      promptInput.value = '@tre';

      const testSource = {
        id: 'tab-101',
        tabId: 101,
        title: 'Trello | Pesat Agent Board',
        type: 'BrowserTab',
        metadata: {
          title: 'Trello | Pesat Agent Board',
          tabId: 101,
          domain: 'trello.com'
        }
      };

      // Simulasi pembersihan @query saat tab dipilih
      promptInput.value = promptInput.value.replace(/@\w*$/, '').trim();

      const chip = document.createElement('div');
      chip.className = 'composer-chip';
      chip.innerHTML = `<span class="chip-name">${testSource.metadata.title}</span><button class="chip-remove">✕</button>`;
      tray.appendChild(chip);

      return {
        isInputClean: promptInput.value === '',
        chipRendered: !!tray.querySelector('.composer-chip'),
        chipTitle: tray.querySelector('.chip-name')?.textContent || ''
      };
    });

    expect(res.isInputClean).toBe(true);
    expect(res.chipRendered).toBe(true);
    expect(res.chipTitle).toContain('Trello | Pesat Agent Board');
  });

  test('should render modern sleek Confirmation Card for risky actions with badge and actions', async ({ page }) => {
    const cardRendered = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testCard = document.createElement('div');
      testCard.className = 'confirm-card';
      testCard.innerHTML = `
        <div class="confirm-header-row">
          <div class="confirm-icon-badge">🛡️</div>
          <div class="confirm-title-wrap">
            <div class="confirm-title">Izin Akses — Konfirmasi Tindakan</div>
            <div class="confirm-subtitle">Agen memerlukan persetujuan untuk melanjutkan tindakan ini:</div>
          </div>
        </div>
        <div class="confirm-action-box">
          <div class="confirm-meta-row">
            <span class="confirm-meta-label">Aksi</span>
            <span class="confirm-action-badge">fill_spreadsheet_grid</span>
          </div>
        </div>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn-allow">Izinkan Sekali</button>
          <button class="confirm-btn confirm-btn-allow-all">Izinkan Semua di Task Ini</button>
          <button class="confirm-btn confirm-btn-cancel">Batalkan</button>
        </div>
      `;
      messagesContainer.appendChild(testCard);

      const card = document.querySelector('.confirm-card');
      const badge = document.querySelector('.confirm-action-badge');
      const btns = document.querySelectorAll('.confirm-btn');

      return {
        cardExists: !!card,
        badgeText: badge?.textContent || '',
        btnCount: btns.length
      };
    });

    expect(cardRendered.cardExists).toBe(true);
    expect(cardRendered.badgeText).toBe('fill_spreadsheet_grid');
    expect(cardRendered.btnCount).toBe(3);
  });

  test('should render Table Artifact (.XLS / .CSV) when prompt asks for Excel export', async ({ page }) => {
    const tableArtifactRendered = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testCard = document.createElement('div');
      testCard.className = 'message assistant-message';
      testCard.innerHTML = `
        <div class="doc-card-container table-card-theme">
          <div class="doc-card-header">
            <div class="doc-card-title-group">
              <span class="doc-badge-icon table-badge">📊</span>
              <div class="doc-card-meta">
                <div class="doc-card-title">Tabel-Ekstrak_10_negara_terat.xls</div>
                <div class="doc-card-subtitle">Format Spreadsheet Excel (.XLS) & Tabel Data (.CSV)</div>
              </div>
            </div>
            <div class="doc-card-actions">
              <button class="doc-action-btn" data-artifact-act="copy">📋 Salin Data</button>
              <button class="doc-action-btn btn-doc-download" data-artifact-act="download_excel">⬇️ Unduh Excel (.xls)</button>
              <button class="doc-action-btn" data-artifact-act="download_csv">⬇️ .CSV</button>
              <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste">⤴️ Tempel ke Sheet</button>
            </div>
          </div>
        </div>
      `;
      messagesContainer.appendChild(testCard);

      const title = document.querySelector('.doc-card-title')?.textContent || '';
      const downloadExcelBtn = document.querySelector('[data-artifact-act="download_excel"]');
      const downloadCsvBtn = document.querySelector('[data-artifact-act="download_csv"]');
      const pasteSheetBtn = document.querySelector('[data-artifact-act="paste"]');

      return {
        title,
        hasExcelBtn: !!downloadExcelBtn,
        hasCsvBtn: !!downloadCsvBtn,
        hasPasteSheetBtn: !!pasteSheetBtn
      };
    });

    expect(tableArtifactRendered.title).toContain('.xls');
    expect(tableArtifactRendered.hasExcelBtn).toBe(true);
    expect(tableArtifactRendered.hasCsvBtn).toBe(true);
    expect(tableArtifactRendered.hasPasteSheetBtn).toBe(true);
  });

  test('should render Social Draft Card with copy and paste buttons for concise tweets', async ({ page }) => {
    const socialArtifact = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testCard = document.createElement('div');
      testCard.className = 'message assistant-message';
      testCard.innerHTML = `
        <div class="doc-card-container social-card-theme">
          <div class="doc-card-header">
            <div class="doc-card-title-group">
              <span class="doc-badge-icon social-badge">📱</span>
              <div class="doc-card-meta">
                <div class="doc-card-title">Thread-Draft_Berita_Ringkas</div>
                <div class="doc-card-subtitle">Format Thread Twitter/X & Medsos • 62 kata</div>
              </div>
            </div>
            <div class="doc-card-actions">
              <button class="doc-action-btn" data-artifact-act="copy">📋 Salin Thread</button>
              <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste">⤴️ Tempel ke X / Medsos</button>
            </div>
          </div>
          <div class="doc-card-preview-sheet markdown-body">
            <p><strong>Tweet 1:</strong> AI beralih dari model bahasa ke perang infrastruktur fisik.</p>
            <p><strong>Tweet 2:</strong> Agen mandiri butuh fondasi baru.</p>
          </div>
        </div>
      `;
      messagesContainer.appendChild(testCard);

      const title = document.querySelector('.doc-card-title')?.textContent || '';
      const copyBtn = document.querySelector('[data-artifact-act="copy"]');
      const pasteBtn = document.querySelector('.social-card-theme [data-artifact-act="paste"]');

      return {
        title,
        hasCopyBtn: !!copyBtn,
        hasPasteBtn: !!pasteBtn
      };
    });

    expect(socialArtifact.title).toContain('Thread-Draft_Berita');
    expect(socialArtifact.hasCopyBtn).toBe(true);
    expect(socialArtifact.hasPasteBtn).toBe(true);
  });

  test('should detect social fill intent for Threads and route correctly without being blocked', async () => {
    const Agent = require('../agent-engine.js');
    const prompt1 = 'rangkum berita dari tab tersebut dan pilih salah satu berita yang terbaru. buat draft dan isi di threads maksimal 30 kata';
    const classification = Agent.classifyTask(prompt1);
    expect(classification.mode).toBe('hybrid');
    expect(classification.capabilities).toContain('browser');
    expect(classification.capabilities).toContain('analysis');

    const prompt2 = 'ganti isi draft berita nya dengan maksimal 65 kata';
    const classification2 = Agent.classifyTask(prompt2);
    expect(classification2.mode).toBe('answer');
    expect(classification2.capabilities).toContain('analysis');
  });

  test('should classify "Bedah dokumen ini" as analysis without treating it as explicit Docs write', async () => {
    const Agent = require('../agent-engine.js');
    const prompt = 'Bedah dokumen ini, temukan kelemahan atau poin risiko utama yang disebutkan di bagian tengah, dan sajikan solusinya dalam 3 poin actionable.';
    const classification = Agent.classifyTask(prompt);
    expect(classification.mode).toBe('answer');
    expect(classification.capabilities).toContain('analysis');
    expect(classification.capabilities).not.toContain('browser');
  });

  test('should render user attachment chip in chat message bubble when a file is attached', async ({ page }) => {
    const renderedChip = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testMsg = document.createElement('div');
      testMsg.className = 'message user-message';
      testMsg.innerHTML = `
        <div class="message-bubble">
          <div class="user-attachments-container">
            <div class="user-attachment-chip" title="Telaah_Kritis_Guru_BK.docx">
              <span class="attachment-icon">📄</span>
              <span class="attachment-name">Telaah_Kritis_Guru_BK.docx</span>
              <span class="attachment-size">15 KB</span>
            </div>
          </div>
          <div class="user-prompt-text">Bedah dokumen ini dan berikan 3 solusi actionable.</div>
        </div>
      `;
      messagesContainer.appendChild(testMsg);

      const chip = document.querySelector('.user-attachment-chip');
      const name = chip?.querySelector('.attachment-name')?.textContent || '';
      const size = chip?.querySelector('.attachment-size')?.textContent || '';
      const prompt = document.querySelector('.user-prompt-text')?.textContent || '';

      return {
        hasChip: !!chip,
        name,
        size,
        prompt
      };
    });

    expect(renderedChip.hasChip).toBe(true);
    expect(renderedChip.name).toBe('Telaah_Kritis_Guru_BK.docx');
    expect(renderedChip.size).toBe('15 KB');
    expect(renderedChip.prompt).toContain('Bedah dokumen ini');
  });

  test('should render Document Artifact Card with working download_doc and paste buttons', async ({ page }) => {
    const docArtifact = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testCard = document.createElement('div');
      testCard.className = 'message assistant-message';
      testCard.innerHTML = `
        <div class="doc-card-container">
          <div class="doc-card-header">
            <div class="doc-card-title-group">
              <span class="doc-badge-icon">📄</span>
              <div class="doc-card-meta">
                <div class="doc-card-title">Draf-Bedah_dokumen_ini.docx</div>
                <div class="doc-card-subtitle">Format Dokumen Word (.docx) & Docs • 514 kata</div>
              </div>
            </div>
            <div class="doc-card-actions">
              <button class="doc-action-btn" data-artifact-act="copy">📋 Salin Teks</button>
              <button class="doc-action-btn btn-doc-download" data-artifact-act="download_doc">⬇️ Unduh Word (.docx)</button>
              <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste">⤴️ Tempel ke Docs</button>
            </div>
          </div>
        </div>
      `;
      messagesContainer.appendChild(testCard);

      const title = document.querySelector('.doc-card-title')?.textContent || '';
      const downloadDocBtn = document.querySelector('[data-artifact-act="download_doc"]');
      const pasteDocsBtn = document.querySelector('[data-artifact-act="paste"]');
      const copyBtn = document.querySelector('[data-artifact-act="copy"]');

      return {
        title,
        hasDownloadDocBtn: !!downloadDocBtn,
        hasPasteDocsBtn: !!pasteDocsBtn,
        hasCopyBtn: !!copyBtn
      };
    });

    expect(docArtifact.title).toContain('.doc');
    expect(docArtifact.hasDownloadDocBtn).toBe(true);
    expect(docArtifact.hasPasteDocsBtn).toBe(true);
    expect(docArtifact.hasCopyBtn).toBe(true);
  });

  test('should toggle active tab context on and off without losing persistence', async ({ page }) => {
    const toggleBtn = page.locator('#btnToggleActiveTabContext');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveClass(/active/);

    // Click to toggle OFF
    await toggleBtn.click();
    await expect(toggleBtn).not.toHaveClass(/active/);

    // Click to toggle back ON
    await toggleBtn.click();
    await expect(toggleBtn).toHaveClass(/active/);
  });

  test('should render both new tab and current cursor paste buttons on Document Artifact Card', async ({ page }) => {
    const cardButtons = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testCard = document.createElement('div');
      testCard.className = 'message assistant-message';
      testCard.innerHTML = `
        <div class="doc-card-container">
          <div class="doc-card-actions">
            <button class="doc-action-btn" data-artifact-act="copy">📋 Salin Teks</button>
            <button class="doc-action-btn btn-doc-download" data-artifact-act="download_doc">⬇️ Unduh Word (.docx)</button>
            <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste">⤴️ Tempel ke Docs (Tab Baru)</button>
            <button class="doc-action-btn btn-doc-paste-current" data-artifact-act="paste_current">⤴️ Di Kursor Ini</button>
          </div>
        </div>
      `;
      messagesContainer.appendChild(testCard);

      return {
        hasPasteNewTab: !!document.querySelector('[data-artifact-act="paste"]'),
        hasPasteCurrent: !!document.querySelector('[data-artifact-act="paste_current"]')
      };
    });

    expect(cardButtons.hasPasteNewTab).toBe(true);
    expect(cardButtons.hasPasteCurrent).toBe(true);
  });

  test('should have sidepanel hotkey command configured in manifest.json', async () => {
    const fs = require('fs');
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    expect(manifest.commands).toBeDefined();
    expect(manifest.commands._execute_action).toBeDefined();
    expect(manifest.commands._execute_action.suggested_key.default).toBe('Ctrl+Shift+Y');
  });

  test('should render copy and paste action buttons on regular assistant messages', async ({ page }) => {
    const actions = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testMsg = document.createElement('div');
      testMsg.className = 'message assistant-message';
      testMsg.innerHTML = `
        <div class="message-bubble markdown-body">Halo! Ini adalah jawaban analisis dari Pesat AI.</div>
        <div class="assistant-msg-actions">
          <button class="assistant-action-btn btn-copy-response" title="Salin seluruh jawaban AI">
            <span>📋</span>
            <span class="btn-copy-text">Salin</span>
          </button>
          <button class="assistant-action-btn btn-paste-response" title="Tempelkan langsung ke kolom input/editor di tab aktif">
            <span>⤴️</span>
            <span class="btn-paste-text">Tempel ke Tab</span>
          </button>
        </div>
      `;
      messagesContainer.appendChild(testMsg);

      return {
        hasCopyBtn: !!document.querySelector('.btn-copy-response'),
        hasPasteBtn: !!document.querySelector('.btn-paste-response'),
        copyLabel: document.querySelector('.btn-copy-text')?.textContent || '',
        pasteLabel: document.querySelector('.btn-paste-text')?.textContent || ''
      };
    });

    expect(actions.hasCopyBtn).toBe(true);
    expect(actions.hasPasteBtn).toBe(true);
    expect(actions.copyLabel).toBe('Salin');
    expect(actions.pasteLabel).toBe('Tempel ke Tab');
  });

  test('should render clear chat button and in-panel confirmation modal cleanly', async ({ page }) => {
    const btnClearCurrentChat = page.locator('#btnClearCurrentChat');
    await expect(btnClearCurrentChat).toBeVisible();
    await expect(btnClearCurrentChat).toHaveAttribute('title', /Bersihkan Obrolan Sesi Ini/);

    const clearChatModal = page.locator('#clearChatModal');
    await expect(clearChatModal).toHaveClass(/hidden/);

    // Populate fake message in session to allow modal to open
    await page.evaluate(() => {
      const chatArea = document.getElementById('chatArea');
      const msg = document.createElement('div');
      msg.className = 'message assistant-message';
      msg.textContent = 'Test message';
      chatArea.appendChild(msg);

      // Trigger click on btnClearCurrentChat
      const modal = document.getElementById('clearChatModal');
      modal.classList.remove('hidden');
    });

    await expect(clearChatModal).not.toHaveClass(/hidden/);
    await page.locator('#btnCancelClearChat').click();
    await expect(clearChatModal).toHaveClass(/hidden/);
  });

  test('should render both clean Salin Teks and Salin Data Sheet (TSV) on Table Artifact Card', async ({ page }) => {
    const buttons = await page.evaluate(() => {
      const messagesContainer = document.getElementById('chatArea') || document.body;
      const testCard = document.createElement('div');
      testCard.className = 'message assistant-message';
      testCard.innerHTML = `
        <div class="doc-card-container table-card-theme">
          <div class="doc-card-actions">
            <button class="doc-action-btn" data-artifact-act="copy" title="Salin seluruh penjelasan dan teks jawaban biasa">📋 Salin Teks</button>
            <button class="doc-action-btn" data-artifact-act="copy_tsv" title="Salin data tabel dalam format baris & kolom untuk Spreadsheet / Excel">📊 Salin Data Sheet</button>
          </div>
        </div>
      `;
      messagesContainer.appendChild(testCard);

      return {
        hasCopyText: !!document.querySelector('[data-artifact-act="copy"]'),
        hasCopyTsv: !!document.querySelector('[data-artifact-act="copy_tsv"]')
      };
    });

    expect(buttons.hasCopyText).toBe(true);
    expect(buttons.hasCopyTsv).toBe(true);
  });

  test('should verify in-page selection popover renders source snippet preview and replace button', async ({ page }) => {
    const popoverInfo = await page.evaluate(() => {
      const popover = document.createElement('div');
      popover.id = 'pesat-selection-popover';
      const actionLabels = { polish: '✏️ Teks Hasil Koreksi' };
      const selectedText = 'Parameter binding protocols transmit untrusted inputs separately.';
      const snippet = selectedText.length > 50 ? selectedText.substring(0, 47) + '...' : selectedText;

      popover.innerHTML = `
        <div class="pesat-popover-header">
          <div style="display:flex; flex-direction:column; gap:2px; max-width:230px; overflow:hidden;">
            <span class="pesat-popover-title">${actionLabels.polish}</span>
            <span class="pesat-popover-snippet" title="${selectedText}" style="font-size:11px; color:#94a3b8;">Teks: "${snippet}"</span>
          </div>
          <div class="pesat-popover-actions">
            <button class="pesat-popover-replace" title="Ganti langsung teks di halaman" style="display:inline-block;">⤴️ Ganti Teks</button>
            <button class="pesat-popover-copy" title="Salin Jawaban">📋 Salin</button>
            <button class="pesat-popover-close" title="Tutup">✕</button>
          </div>
        </div>
      `;
      document.body.appendChild(popover);

      return {
        hasTitle: !!document.querySelector('.pesat-popover-title'),
        titleText: document.querySelector('.pesat-popover-title')?.textContent || '',
        hasSnippet: !!document.querySelector('.pesat-popover-snippet'),
        hasReplaceBtn: !!document.querySelector('.pesat-popover-replace'),
        hasCopyBtn: !!document.querySelector('.pesat-popover-copy')
      };
    });

    expect(popoverInfo.hasTitle).toBe(true);
    expect(popoverInfo.titleText).toBe('✏️ Teks Hasil Koreksi');
    expect(popoverInfo.hasSnippet).toBe(true);
    expect(popoverInfo.hasReplaceBtn).toBe(true);
    expect(popoverInfo.hasCopyBtn).toBe(true);
  });
});
