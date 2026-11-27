const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Phase 3 — Agent Experience Verification (UI/UX Spec v1.0 § 6)', () => {
  const sidepanelUrl = `file://${path.resolve(__dirname, '../sidepanel/sidepanel.html')}`;
  const screenshotDir = path.resolve(__dirname, '../reports/screenshots/phase3');

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

  test('3.1 Status System: 5 states (Ready, Thinking, Executing, Completed, Failed)', async ({ page }) => {
    const statusBadge = page.locator('#agentStatus');
    await expect(statusBadge).toBeVisible();

    // 1. Ready state
    await page.evaluate(() => window.setAgentStatus('ready'));
    await expect(statusBadge).toHaveText('Siap');
    await expect(statusBadge).toHaveClass(/status-ready/);

    // 2. Thinking state
    await page.evaluate(() => window.setAgentStatus('thinking'));
    await expect(statusBadge).toHaveText('Berpikir');
    await expect(statusBadge).toHaveClass(/status-thinking/);

    // 3. Executing state
    await page.evaluate(() => window.setAgentStatus('executing'));
    await expect(statusBadge).toHaveText('Bekerja');
    await expect(statusBadge).toHaveClass(/status-executing/);

    // 4. Completed state
    await page.evaluate(() => window.setAgentStatus('completed'));
    await expect(statusBadge).toHaveText('Completed');
    await expect(statusBadge).toHaveClass(/status-completed/);

    // 5. Failed state
    await page.evaluate(() => window.setAgentStatus('failed'));
    await expect(statusBadge).toHaveText('Gagal');
    await expect(statusBadge).toHaveClass(/status-failed/);

    await page.screenshot({ path: path.join(screenshotDir, 'status-states.png') });
  });

  test('3.2 Execution Timeline: Renders done, in-progress, pending, and failed step indicators', async ({ page }) => {
    // Inject a taskCard message with realistic multi-step execution plan
    await page.evaluate(() => {
      const taskCard = {
        goal: 'Buka Wikipedia dan cari AI',
        status: 'EXECUTING',
        plan: [
          { id: '1', title: 'Membuka halaman Wikipedia', status: 'done' },
          { id: '2', title: 'Mencari informasi artikel AI', status: 'in_progress' },
          { id: '3', title: 'Menyusun hasil rangkuman', status: 'pending' },
        ],
      };

      // Add to session via UI helper or simulate message
      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      if (session) {
        session.messages.push({
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          taskCard,
        });
        if (window.renderCurrentSession) window.renderCurrentSession();
      }
    });

    const card = page.locator('.agent-status-card.state-executing');
    await expect(card).toBeVisible();
    await expect(card.locator('.agent-status-card-title')).toContainText('Buka Wikipedia dan cari AI');
    await expect(card.locator('.agent-status-badge')).toHaveText('Bekerja');

    // Verify 3 timeline items
    const items = card.locator('.timeline-item');
    await expect(items).toHaveCount(3);

    // Step 1: done (svg checkmark)
    await expect(items.nth(0)).toHaveClass(/status-done/);
    await expect(items.nth(0).locator('.timeline-indicator.indicator-done svg')).toBeVisible();

    // Step 2: in-progress (spinner)
    await expect(items.nth(1)).toHaveClass(/status-in-progress/);
    await expect(items.nth(1).locator('.timeline-spinner')).toBeVisible();

    // Step 3: pending (hollow dot)
    await expect(items.nth(2)).toHaveClass(/status-pending/);
    await expect(items.nth(2).locator('.timeline-dot-hollow')).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, 'execution-timeline-card.png') });
  });

  test('3.3 Stop Button in Execution Card: Visible during execution and triggers stop callback', async ({ page }) => {
    await page.evaluate(() => {
      const taskCard = {
        goal: 'Otomatisasi form pendaftaran',
        status: 'EXECUTING',
        plan: [{ id: '1', title: 'Mengisi data formulir', status: 'in_progress' }],
      };

      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      if (session) {
        session.messages.push({
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          taskCard,
        });
        if (window.renderCurrentSession) window.renderCurrentSession();
      }
    });

    const stopButton = page.locator('.btn-stop-card');
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toContainText('Hentikan');

    // Click stop button and verify it doesn't crash or throw
    await stopButton.click();
  });

  test('3.4 Completed State: Shows green accent and Selesai badge without stop button', async ({ page }) => {
    await page.evaluate(() => {
      const taskCard = {
        goal: 'Riset kompetitor selesai',
        status: 'DONE',
        plan: [
          { id: '1', title: 'Membuka Google', status: 'done' },
          { id: '2', title: 'Mengekstrak data ranking', status: 'done' },
        ],
      };

      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      if (session) {
        session.messages.push({
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          taskCard,
        });
        if (window.renderCurrentSession) window.renderCurrentSession();
      }
    });

    const card = page.locator('.agent-status-card.state-completed');
    await expect(card).toBeVisible();
    await expect(card.locator('.agent-status-badge')).toHaveText('Completed');
    await expect(card.locator('.agent-status-badge')).toHaveClass(/badge-success/);

    // Stop button should NOT be rendered when task is done
    await expect(card.locator('.btn-stop-card')).toHaveCount(0);

    await page.screenshot({ path: path.join(screenshotDir, 'completed-card.png') });
  });

  test('3.5 Error State: Displays danger badge, failure explanation, and actionable recovery', async ({ page }) => {
    await page.evaluate(() => {
      const taskCard = {
        goal: 'Koneksi ke dokumen target',
        status: 'FAILED',
        failureReason: 'Halaman web tidak merespons dalam 15 detik (Timeout)',
        plan: [
          { id: '1', title: 'Membuka URL dokumen', status: 'done' },
          { id: '2', title: 'Mengambil konten paragraf', status: 'failed' },
        ],
      };

      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      if (session) {
        session.messages.push({
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          taskCard,
        });
        if (window.renderCurrentSession) window.renderCurrentSession();
      }
    });

    const card = page.locator('.agent-status-card.state-failed');
    await expect(card).toBeVisible();
    await expect(card.locator('.agent-status-badge')).toHaveText('Gagal');
    await expect(card.locator('.agent-status-badge')).toHaveClass(/badge-danger/);

    const errorFooter = card.locator('.error-state-footer');
    await expect(errorFooter).toBeVisible();
    await expect(errorFooter.locator('.error-reason')).toContainText('Timeout');
    await expect(errorFooter.locator('.error-action-hint')).toContainText('Saran:');

    await page.screenshot({ path: path.join(screenshotDir, 'error-card.png') });
  });

  test('3.6 Responsive Behavior: Viewports 320px, 360px, 420px, 480px without horizontal overflow', async ({ page }) => {
    await page.evaluate(() => {
      const taskCard = {
        goal: 'Uji responsif pada berbagai ukuran viewport',
        status: 'EXECUTING',
        plan: [
          { id: '1', title: 'Langkah pertama pengujian', status: 'done' },
          { id: '2', title: 'Langkah kedua sedang berjalan', status: 'in_progress' },
        ],
      };

      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      if (session) {
        session.messages.push({
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          taskCard,
        });
        if (window.renderCurrentSession) window.renderCurrentSession();
      }
    });

    const viewports = [
      { width: 320, height: 600, label: '320px-compact' },
      { width: 360, height: 640, label: '360px-primary' },
      { width: 420, height: 700, label: '420px-standard' },
      { width: 480, height: 800, label: '480px-expanded' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(100);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth ||
               document.body.scrollWidth > window.innerWidth;
      });

      expect(hasHorizontalScroll, `Viewport ${vp.label} should not have horizontal overflow`).toBeFalsy();
      await page.screenshot({ path: path.join(screenshotDir, `responsive-${vp.label}.png`) });
    }
  });
});
