const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Phase 1 - Foundation & Design System Verification', () => {
  const sidepanelUrl = `file://${path.resolve(__dirname, '../sidepanel/sidepanel.html')}`;
  const screenshotDir = path.resolve(__dirname, '../reports/screenshots/phase1');

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

    await page.goto(sidepanelUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  test('1.1 should have correct Phase 1 Design Tokens loaded in :root', async ({ page }) => {
    const tokens = await page.evaluate(() => {
      const s = window.getComputedStyle(document.documentElement);
      return {
        brandPrimary: s.getPropertyValue('--brand-primary').trim().toLowerCase(),
        brandHover: s.getPropertyValue('--brand-hover').trim().toLowerCase(),
        brandSoft: s.getPropertyValue('--brand-soft').trim().toLowerCase(),
        bgBase: s.getPropertyValue('--bg-base').trim().toLowerCase(),
        bgSurface: s.getPropertyValue('--bg-surface').trim().toLowerCase(),
        bgCard: s.getPropertyValue('--bg-card').trim().toLowerCase(),
        borderSubtle: s.getPropertyValue('--border-subtle').trim().toLowerCase(),
        textPrimary: s.getPropertyValue('--text-primary').trim().toLowerCase(),
        textSecondary: s.getPropertyValue('--text-secondary').trim().toLowerCase(),
        space1: s.getPropertyValue('--space-1').trim(),
        space2: s.getPropertyValue('--space-2').trim(),
        space4: s.getPropertyValue('--space-4').trim(),
        radiusSm: s.getPropertyValue('--radius-sm').trim(),
        radiusComposer: s.getPropertyValue('--radius-composer').trim(),
        fontBody: s.getPropertyValue('--font-body').trim(),
        fontHeading: s.getPropertyValue('--font-heading').trim(),
      };
    });

    expect(tokens.brandPrimary).toBe('#b42318');
    expect(tokens.brandHover).toBe('#912018');
    expect(tokens.brandSoft).toBe('#fef2f2');
    expect(tokens.bgBase).toBe('#ffffff');
    expect(tokens.bgSurface).toBe('#f8fafc');
    expect(tokens.bgCard).toBe('#ffffff');
    expect(tokens.borderSubtle).toBe('#e2e8f0');
    expect(tokens.textPrimary).toBe('#0f172a');
    expect(tokens.textSecondary).toBe('#64748b');
    expect(tokens.space1).toBe('4px');
    expect(tokens.space2).toBe('8px');
    expect(tokens.space4).toBe('16px');
    expect(tokens.radiusSm).toBe('8px');
    expect(tokens.radiusComposer).toBe('14px');
    expect(tokens.fontBody).toContain('Plus Jakarta Sans');
    expect(tokens.fontHeading).toContain('Sora');
  });

  test('1.2 should verify P0 contrast fix: .doc-card-preview-sheet is crisp white with dark text', async ({ page }) => {
    // Inject a sample document preview card
    await page.evaluate(() => {
      const welcome = document.getElementById('welcomeView');
      if (welcome) welcome.style.display = 'none';

      const chatArea = document.getElementById('chatArea');
      const card = document.createElement('div');
      card.className = 'doc-card-container';
      card.innerHTML = `
        <div class="doc-card-header">
          <div class="doc-card-title-group">
            <span class="doc-badge-icon">📄</span>
            <div class="doc-card-meta">
              <span class="doc-card-title">Analisis Tren Pasar Q1</span>
              <span class="doc-card-subtitle">Google Docs • 1.2 KB</span>
            </div>
          </div>
          <div class="doc-card-actions">
            <button class="doc-action-btn btn-doc-download" id="testBtnDownload">Download</button>
            <button class="doc-action-btn btn-doc-paste" id="testBtnPaste">Buka di Tab</button>
          </div>
        </div>
        <div class="doc-card-preview-sheet" id="testPreviewSheet">
          <h1>Laporan Analisis Eksekutif</h1>
          <p>Dokumen ini merangkum pergerakan pasar dan metrik performa utama pada kuartal pertama.</p>
          <h2>Temuan Kunci</h2>
          <ul>
            <li>Pertumbuhan adopsi pengguna baru mencapai 24% MoM.</li>
            <li>Retensi fitur automasi AI meningkat sebesar 18%.</li>
          </ul>
        </div>
      `;
      chatArea.appendChild(card);
    });

    const preview = page.locator('#testPreviewSheet');
    await expect(preview).toBeVisible();

    // Verify computed styles
    const styles = await preview.evaluate(el => {
      const cs = window.getComputedStyle(el);
      const h1 = el.querySelector('h1');
      const p = el.querySelector('p');
      const csH1 = window.getComputedStyle(h1);
      const csP = window.getComputedStyle(p);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        h1Color: csH1.color,
        pColor: csP.color,
      };
    });

    // Background must be pure white (rgb(255, 255, 255)), NOT dark rgb(10, 10, 18)
    expect(styles.bg).toBe('rgb(255, 255, 255)');
    // Text must be dark text-primary rgb(15, 23, 42)
    expect(styles.color).toBe('rgb(15, 23, 42)');
    expect(styles.h1Color).toBe('rgb(15, 23, 42)');
    expect(styles.pColor).toBe('rgb(15, 23, 42)');

    // Capture screenshot of document preview card
    await page.locator('.doc-card-container').first().scrollIntoViewIfNeeded();
    await page.locator('.doc-card-container').first().screenshot({
      path: path.join(screenshotDir, 'doc-preview-contrast-card.png')
    });
  });

  test('1.3 should capture visual state for Active Chat', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.evaluate(() => {
      const welcome = document.getElementById('welcomeView');
      if (welcome) welcome.style.display = 'none';

      const chatArea = document.getElementById('chatArea');
      chatArea.innerHTML = `
        <div class="message-bubble-wrapper user-wrapper">
          <div class="message-bubble user-bubble">
            Tolong rangkumkan artikel tren AI browser agent terbaru ini ke dalam poin-poin penting.
          </div>
        </div>
        <div class="message-bubble-wrapper assistant-wrapper">
          <div class="message-bubble assistant-bubble">
            <p>Berikut ringkasan tren AI browser agent terbaru:</p>
            <ul>
              <li><strong>Agentic Execution:</strong> Otomasi beralih dari sekadar obrolan generatif ke eksekusi aksi multi-langkah di web.</li>
              <li><strong>Context Grounding:</strong> Ekstensi dapat membaca DOM aktif dan memahami navigasi subtab.</li>
              <li><strong>High Privacy:</strong> Operasi terisolasi dengan telemetri zero UI leakage.</li>
            </ul>
          </div>
        </div>
      `;
    });

    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(screenshotDir, 'active-chat-screen.png')
    });
  });

  test('1.4 should capture visual state for Agent Executing', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.evaluate(() => {
      const welcome = document.getElementById('welcomeView');
      if (welcome) welcome.style.display = 'none';

      const status = document.getElementById('agentStatus');
      if (status) {
        status.textContent = 'Bekerja';
        status.className = 'status-badge working';
      }

      const workingBar = document.getElementById('activeTabWorkingBar');
      if (workingBar) {
        workingBar.classList.remove('hidden');
        document.getElementById('activeWorkingTabTitle').textContent = 'google.com/search?q=pesat+ai';
      }

      const chatArea = document.getElementById('chatArea');
      const taskCard = document.createElement('div');
      taskCard.className = 'task-card';
      taskCard.innerHTML = `
        <div class="task-card-header">Langkah 2/4 • Menjelajah Web</div>
        <div class="task-card-goal">Mengekstrak data ringkasan hasil pencarian dari Google Search...</div>
      `;
      chatArea.appendChild(taskCard);
    });

    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(screenshotDir, 'agent-executing-screen.png')
    });
  });

  test('1.5 should capture visual state for Settings Modal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.locator('#btnMoreMenu').click();
    await page.locator('#btnSettings').click();
    const settingsPanel = page.locator('#settingsPanel');
    await expect(settingsPanel).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, 'settings-modal-screen.png')
    });
  });

  const viewports = [
    { name: '320px-compact', width: 320, height: 600 },
    { name: '360px-baseline', width: 360, height: 640 },
    { name: '420px-standard', width: 420, height: 720 },
    { name: '480px-expanded', width: 480, height: 800 },
  ];

  for (const vp of viewports) {
    test(`1.6 should pass responsive test at ${vp.name} (${vp.width}x${vp.height}) with no overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Verify no horizontal overflow
      const overflowStatus = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const app = document.querySelector('.app-container');
        return {
          windowInnerWidth: window.innerWidth,
          docScrollWidth: doc.scrollWidth,
          bodyScrollWidth: body.scrollWidth,
          appScrollWidth: app ? app.scrollWidth : 0,
          hasHorizontalScrollbar: window.innerWidth < doc.scrollWidth,
        };
      });

      expect(overflowStatus.bodyScrollWidth).toBeLessThanOrEqual(vp.width + 1);
      expect(overflowStatus.hasHorizontalScrollbar).toBe(false);

      // Verify key elements are visible and within bounds
      const header = page.locator('.header');
      await expect(header).toBeVisible();

      const composer = page.locator('#promptInput');
      await expect(composer).toBeVisible();

      const sendBtn = page.locator('#btnSend');
      await expect(sendBtn).toBeVisible();

      // Ensure composer does not clip out of viewport
      const composerBox = await composer.boundingBox();
      expect(composerBox).not.toBeNull();
      expect(composerBox.x).toBeGreaterThanOrEqual(0);
      expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(vp.width + 1);

      // Capture screenshot for visual validation report
      await page.screenshot({
        path: path.join(screenshotDir, `welcome-screen-${vp.name}.png`),
        fullPage: false,
      });
    });
  }
});
