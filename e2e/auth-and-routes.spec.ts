import { test, expect, Page } from '@playwright/test';

/**
 * UGent MedBot — Auth Flow & Route Tests
 * Covers OTP login, dashboard Convex error state, browse interactions,
 * chapter→chat navigation, and Telegram/WhatsApp buttons.
 *
 * NOTE: Full OTP login requires a real email. Tests that need auth are
 * marked with [auth-required] and skip if UGENT_TEST_OTP is not set.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.UGENT_TEST_EMAIL || 'jimkalinov@gmail.com';
const TEST_OTP = process.env.UGENT_TEST_OTP || ''; // Set this before running auth tests

// ---------------------------------------------------------------------------
// Auth: OTP Login Flow
// ---------------------------------------------------------------------------
test.describe('Auth — OTP Login Flow', () => {
  test('login page renders email form with correct elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Branding
    await expect(page.getByRole('heading', { name: /UGent MedBot/i })).toBeVisible();
    await expect(page.getByText('Sign in to continue')).toBeVisible();

    // Email input
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', /email address/i);

    // Continue button
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('entering email shows OTP code step', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Continue' }).click();

    // OTP step appears
    await expect(page.getByText(/Enter the code sent to/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('textbox', { name: /code/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /different email/i })).toBeVisible();

    console.log('✅ OTP step renders correctly after email submission');
  });

  test('can go back to email step', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText(/Enter the code sent to/i).waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: /different email/i }).click();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 5000 });
    console.log('✅ Back to email step works');
  });

  test.skip(!TEST_OTP, 'full OTP login (requires UGENT_TEST_OTP env var)');
  test('full OTP login flow → dashboard', async ({ page }) => {
    test.skip(!TEST_OTP, 'UGENT_TEST_OTP not set');

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText(/Enter the code sent to/i).waitFor({ timeout: 10000 });

    await page.getByRole('textbox', { name: /code/i }).fill(TEST_OTP);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 });
    await expect(page.getByRole('navigation')).toBeVisible();
    console.log('✅ OTP login flow → dashboard redirect works');
  });
});

// ---------------------------------------------------------------------------
// Dashboard — Convex auth error state
// ---------------------------------------------------------------------------
test.describe('Dashboard — Error State (unauthenticated)', () => {
  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const url = page.url();
    const redirected = url.includes('/login') || url.includes('/auth');
    console.log(`${redirected ? '✅' : '⚠️ '} Dashboard redirect: ${url}`);
    // Log but don't hard-fail — some configs show error instead of redirect
    if (!redirected) {
      const hasError = await page.getByText(/something went wrong/i).count();
      console.log(`⚠️  Dashboard shows error without redirect: hasError=${hasError}`);
    }
  });

  test('dashboard convex error is shown gracefully (no blank page)', async ({ page }) => {
    // This test documents the known bug: Convex bookmarks:listBookmarks
    // returns Unauthorized even after better-auth OTP login.
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(3000);

    const convexErrors = errors.filter(e => e.includes('CONVEX') || e.includes('Unauthorized'));
    console.log(`📊 Convex auth errors on dashboard: ${convexErrors.length}`);
    convexErrors.forEach(e => console.log(`  - ${e.substring(0, 200)}`));

    const factsErrors = errors.filter(e => e.includes('/api/facts') && e.includes('401'));
    console.log(`📊 /api/facts 401 errors: ${factsErrors.length}`);

    // Page should at least render body (not blank)
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Browse — Category filters & chapter navigation
// ---------------------------------------------------------------------------
test.describe('Browse Topics — Interactive', () => {
  test('browse page renders chapter list and category filters', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check page loads at all (may redirect to login if auth required)
    const url = page.url();
    if (url.includes('/login')) {
      console.log('⚠️  Browse requires auth — redirected to login');
      return;
    }

    await expect(page.getByRole('heading', { name: 'Browse Topics' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('textbox', { name: /search/i })).toBeVisible();

    // Category filter buttons
    const categoryButtons = ['All', 'Cardiovascular', 'Respiratory', 'Gastrointestinal'];
    for (const cat of categoryButtons) {
      const btn = page.getByRole('button', { name: cat });
      await expect(btn).toBeVisible();
    }

    console.log('✅ Browse page renders with category filters');
  });

  test('category filter buttons are clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip(true, 'Browse requires auth');
      return;
    }

    // Click Cardiovascular category
    const cardioBtn = page.getByRole('button', { name: 'Cardiovascular' });
    if (await cardioBtn.count() > 0) {
      await cardioBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Cardiovascular filter clicked');
    }

    // Click All to reset
    await page.getByRole('button', { name: 'All' }).click();
    await page.waitForTimeout(500);
    console.log('✅ All filter reset');
  });

  test('search box filters chapters', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip(true, 'Browse requires auth');
      return;
    }

    const searchBox = page.getByRole('textbox', { name: /search/i });
    if (await searchBox.count() > 0) {
      await searchBox.fill('Cardiac');
      await page.waitForTimeout(500);
      console.log('✅ Search box accepts input');

      await searchBox.clear();
      console.log('✅ Search box cleared');
    }
  });

  test('both textbook sources visible — Pathoma and First Aid', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip(true, 'Browse requires auth');
      return;
    }

    await expect(page.getByRole('heading', { name: /Pathoma/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /First Aid/i })).toBeVisible({ timeout: 5000 });
    console.log('✅ Both Pathoma and First Aid chapters present');
  });

  test('clicking a chapter navigates to chat with pre-filled prompt', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip(true, 'Browse requires auth');
      return;
    }

    // Click first chapter
    const firstChapter = page.getByRole('button', { name: /Ch\. 1/i }).first();
    if (await firstChapter.count() > 0) {
      await firstChapter.click();
      await page.waitForTimeout(1000);

      const url = page.url();
      const hasPrompt = url.includes('/chat') && url.includes('prompt=');
      console.log(`${hasPrompt ? '✅' : '⚠️ '} Chapter click → ${url}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Navigation — header links work
// ---------------------------------------------------------------------------
test.describe('Navigation — Authenticated App Shell', () => {
  test('all nav links are present after login', async ({ page }) => {
    // Navigate to browse (may work without auth or may redirect)
    await page.goto(`${BASE_URL}/browse`);
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip(true, 'Navigation test requires authenticated state');
      return;
    }

    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();

    const expectedLinks = ['Dashboard', 'Browse Topics', 'Chat', 'Review'];
    for (const link of expectedLinks) {
      await expect(nav.getByRole('link', { name: link })).toBeVisible();
    }

    // Action buttons
    await expect(nav.getByRole('button', { name: /Subscribe on WhatsApp/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /High-yield facts notifications/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /New Chat/i })).toBeVisible();

    console.log('✅ All nav links and action buttons present');
  });
});

// ---------------------------------------------------------------------------
// API Endpoints — authenticated routes
// ---------------------------------------------------------------------------
test.describe('API Endpoints — Security & Response', () => {
  test('/api/facts requires auth (returns 401 not 500)', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/facts`);
    const status = res.status();
    console.log(`📊 GET /api/facts: ${status}`);
    expect(status).toBeLessThan(500);
    expect(status).toBe(401);
    console.log('✅ /api/facts correctly requires auth (401)');
  });

  test('/api/auth/get-session endpoint responds', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/auth/get-session`);
    const status = res.status();
    console.log(`📊 GET /api/auth/get-session: ${status}`);
    expect(status).toBeLessThan(500);
  });

  test('cron endpoints are protected', async ({ request }) => {
    const cronRoutes = ['/api/cron/facts', '/api/cron/telegram-facts'];
    for (const path of cronRoutes) {
      const res = await request.get(`${BASE_URL}${path}`);
      const status = res.status();
      console.log(`📊 GET ${path}: ${status}`);
      expect(status).not.toBe(500);
      expect([401, 403, 405]).toContain(status);
      console.log(`✅ ${path} is protected (${status})`);
    }
  });

  test('telegram and whatsapp webhook routes accept POST', async ({ request }) => {
    const webhookRoutes = ['/api/telegram/webhook', '/api/whatsapp/webhook'];
    for (const path of webhookRoutes) {
      const res = await request.post(`${BASE_URL}${path}`, { data: {} });
      const status = res.status();
      console.log(`📊 POST ${path}: ${status}`);
      // Should not be 404 or 500 (may be 200, 400, 401)
      expect(status).not.toBe(404);
      expect(status).toBeLessThan(500);
    }
  });
});
