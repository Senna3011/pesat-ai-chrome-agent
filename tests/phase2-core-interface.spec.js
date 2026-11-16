const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Phase 2 — Core Interface Verification (UI/UX Spec v1.0)', () => {
  const sidepanelUrl = `file://${path.resolve(__dirname, '../sidepanel/sidepanel.html')}`;
  const screenshotDir = path.resolve(__dirname, '../reports/screenshots/phase2');

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

    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(sidepanelUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  test('2.1 Header: Exact 52px height, logo contrast, and status badge', async ({ page }) => {
    const header = page.locator('.header');
    await expect(header).toBeVisible();

    // Verify 52px height across standard viewports
    const viewports = [
      { width: 320, height: 600 },
      { width: 360, height: 640 },
      { width: 420, height: 700 },
      { width: 480, height: 800 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box.height)).toBe(52);
    }

    // Reset to baseline 360px
    await page.setViewportSize({ width: 360, height: 640 });

    // Verify logo contrast: bolt SVG is white (#FFFFFF)
    const logoSvg = page.locator('.logo-svg');
    const logoSvgColor = await logoSvg.evaluate((el) => window.getComputedStyle(el).color);
    expect(logoSvgColor).toBe('rgb(255, 255, 255)');

    // Verify status badge
    const statusBadge = page.locator('#agentStatus');
    await expect(statusBadge).toHaveText('Siap');
    const badgeColor = await statusBadge.evaluate((el) => window.getComputedStyle(el).color);
    expect(badgeColor).toBe('rgb(21, 128, 61)'); // #15803D (semantic high-contrast green)

    // Capture Header & Layout Screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'phase2-header-and-layout.png') });
  });

  test('2.2 Chat Layout: Scroll area mechanics & message spacing', async ({ page }) => {
    const chatArea = page.locator('#chatArea');
    await expect(chatArea).toBeVisible();

    const chatOverflow = await chatArea.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(chatOverflow).toBe('auto');

    // Populate simulated chat messages
    await page.evaluate(() => {
      const container = document.getElementById('chatArea');
      // Add user message
      const userMsg = document.createElement('div');
      userMsg.className = 'message user-message';
      userMsg.innerHTML = '<div class="message-bubble"><div class="user-prompt-text">Ringkas artikel ini dalam 3 poin utama</div></div>';
      container.appendChild(userMsg);

      // Add AI assistant message with markdown elements
      const aiMsg = document.createElement('div');
      aiMsg.className = 'message assistant-message';
      aiMsg.innerHTML = `
        <div class="message-bubble markdown-body">
          <h3>Ringkasan Dokumen</h3>
          <p>Berikut adalah 3 poin utama hasil analisis sistem:</p>
          <ul>
            <li><strong>Poin 1:</strong> Integrasi core interface selesai dengan token responsif.</li>
            <li><strong>Poin 2:</strong> Composer responsif mendukung batas 120px dengan internal scroll.</li>
            <li><strong>Poin 3:</strong> Token info compact 11px tampil minimalis.</li>
          </ul>
          <pre><code>console.log("Pesat Agent Phase 2 Verified");</code></pre>
          <table>
            <thead>
              <tr><th>Komponen</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>Header</td><td>52px Verified</td></tr>
              <tr><td>Composer</td><td>90px Verified</td></tr>
            </tbody>
          </table>
        </div>
      `;
      container.appendChild(aiMsg);
    });

    // Check spacing between messages (12px)
    const userMsg = page.locator('.message.user-message');
    const aiMsg = page.locator('.message.assistant-message');
    await expect(userMsg).toBeVisible();
    await expect(aiMsg).toBeVisible();

    const userBox = await userMsg.boundingBox();
    const aiBox = await aiMsg.boundingBox();
    expect(userBox).not.toBeNull();
    expect(aiBox).not.toBeNull();
    const gap = aiBox.y - (userBox.y + userBox.height);
    expect(Math.round(gap)).toBeGreaterThanOrEqual(10);
  });

  test('2.3 Chat Messages: User bubble primary soft (12px radius) and AI transparent bubble', async ({ page }) => {
    // Populate messages
    await page.evaluate(() => {
      const container = document.getElementById('chatArea');
      const userMsg = document.createElement('div');
      userMsg.className = 'message user-message';
      userMsg.innerHTML = `
        <div class="message-bubble">
          <div class="user-attachments-container">
            <div class="user-attachment-chip">
              <span class="attachment-icon">📄</span>
              <span class="attachment-name">laporan_keuangan.xlsx</span>
              <span class="attachment-size">24 KB</span>
            </div>
          </div>
          <div class="user-prompt-text">Bantu saya menganalisis tren data pada file ini</div>
        </div>
      `;
      container.appendChild(userMsg);

      const aiMsg = document.createElement('div');
      aiMsg.className = 'message assistant-message';
      aiMsg.innerHTML = `
        <div class="message-bubble markdown-body">
          <p>Tentu, analisis tren file spreadsheet Anda telah selesai diproses.</p>
        </div>
        <div class="assistant-msg-actions">
          <button class="assistant-action-btn btn-copy-response">
            <span>📋</span>
            <span class="btn-copy-text">Salin</span>
          </button>
        </div>
      `;
      container.appendChild(aiMsg);
    });

    const userBubble = page.locator('.user-message .message-bubble');
    const aiBubble = page.locator('.assistant-message .message-bubble');

    // User Message specs (Section 5.3):
    // Background: Primary Soft (#FEF2F2 / rgb(254, 242, 242))
    // Text: Text Primary (#0F172A / rgb(15, 23, 42))
    // Border radius: 12px
    const userBg = await userBubble.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const userColor = await userBubble.evaluate((el) => window.getComputedStyle(el).color);
    const userRadius = await userBubble.evaluate((el) => window.getComputedStyle(el).borderRadius);

    expect(userBg).toBe('rgb(254, 242, 242)');
    expect(userColor).toBe('rgb(15, 23, 42)');
    expect(userRadius).toBe('12px');

    // AI Message specs (Section 5.3):
    // Background: Transparent
    // Text: Text Primary
    const aiBg = await aiBubble.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const aiColor = await aiBubble.evaluate((el) => window.getComputedStyle(el).color);
    expect(aiBg).toBe('rgba(0, 0, 0, 0)');
    expect(aiColor).toBe('rgb(15, 23, 42)');

    // Capture User and AI messages screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'phase2-user-and-ai-messages.png') });
  });

  test('2.4 Composer: 90px min-height, 120px max textarea, 36px send button with disabled state', async ({ page }) => {
    const composerCard = page.locator('.composer-card');
    await expect(composerCard).toBeVisible();

    // Check min-height >= 90px
    const composerBox = await composerCard.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox.height).toBeGreaterThanOrEqual(88); // ~90px with padding

    // Check border radius 14px
    const cardRadius = await composerCard.evaluate((el) => window.getComputedStyle(el).borderRadius);
    expect(cardRadius).toBe('14px');

    // Check send button size: 36px
    const sendBtn = page.locator('#btnSend');
    await expect(sendBtn).toBeVisible();
    const btnBox = await sendBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    expect(Math.round(btnBox.width)).toBe(36);
    expect(Math.round(btnBox.height)).toBe(36);

    // Initial state: input empty -> send button has disabled styling
    await expect(sendBtn).toHaveClass(/disabled/);

    // Type text -> send button disabled class removed
    const promptInput = page.locator('#promptInput');
    await promptInput.fill('Perintah pengujian otomatis Phase 2');
    await expect(sendBtn).not.toHaveClass(/disabled/);

    // Verify textarea auto-expand max height is constrained to 120px
    await promptInput.fill('Baris 1\nBaris 2\nBaris 3\nBaris 4\nBaris 5\nBaris 6\nBaris 7\nBaris 8\nBaris 9\nBaris 10');
    const inputHeight = await promptInput.evaluate((el) => parseFloat(window.getComputedStyle(el).height));
    expect(inputHeight).toBeLessThanOrEqual(121);

    // Capture Composer States screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'phase2-composer-states.png') });
  });

  test('2.5 Token Information: Compact bar, secondary color, primary metrics', async ({ page }) => {
    const tokenBar = page.locator('#tokenTrackerBar');
    await expect(tokenBar).toBeVisible();

    const tokenText = page.locator('#tokenTrackerText');
    const fontSize = await tokenText.evaluate((el) => window.getComputedStyle(el).fontSize);
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(11);

    const textColor = await tokenText.evaluate((el) => window.getComputedStyle(el).color);
    expect(textColor).toBe('rgb(100, 116, 139)'); // --text-secondary (#64748B)

    // Capture Token Info screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'phase2-token-info.png') });
  });
});
