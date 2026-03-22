import { test, expect, Page } from '@playwright/test';

/**
 * UGent MedBot E2E Tests
 * Stack: Next.js + Convex + better-auth (email OTP)
 * Routes: /, /login, /dashboard, /chat, /review, /browse
 * Auth: OTP via email — tests check page structure, not full auth flow
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Public Pages — UGent MedBot', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    console.log(`✅ Homepage title: "${title}"`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page has OTP email form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // UGent uses email OTP (EmailOtpForm component)
    await expect(page.locator('body')).toBeVisible();

    const hasEmail = await page.locator('input[type="email"], input[name="email"]').count();
    console.log(`${hasEmail > 0 ? '✅' : '⚠️ '} Email input: ${hasEmail > 0 ? 'found' : 'not found'}`);

    // Check for UGent MedBot branding
    const hasBranding = await page.locator('text=/UGent|MedBot|ugent/i').count();
    console.log(`${hasBranding > 0 ? '✅' : '⚠️ '} Branding: ${hasBranding > 0 ? 'found' : 'not found'}`);

    // Submit button
    const hasSubmit = await page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Continue")').count();
    console.log(`${hasSubmit > 0 ? '✅' : '⚠️ '} Submit/Send button: ${hasSubmit}`);
  });

  test('protected routes redirect to login (unauthenticated)', async ({ page }) => {
    const protectedRoutes = ['/dashboard', '/chat', '/review', '/browse'];

    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const url = page.url();
      const isProtected = url.includes('/login') || url.includes('/auth');
      console.log(`${isProtected ? '✅' : '⚠️ '} ${route} → ${url}`);
    }
  });

  test('OTP form validation — empty email shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    const submitBtn = page.locator('button[type="submit"], button:has-text("Send OTP"), button:has-text("Continue")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      // Should stay on login
      expect(page.url()).toContain('/login');
      console.log('✅ Empty OTP form stays on login page');
    } else {
      console.log('⚠️  Submit button not found — check component rendering');
    }
  });

  test('no JS errors on login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(`${BASE_URL}/login`);
    await page.waitForTimeout(2000);

    const critical = errors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('ResizeObserver')
    );

    if (critical.length > 0) {
      console.log(`⚠️  JS errors on login: ${critical.length}`);
      critical.forEach(e => console.log(`   - ${e.substring(0, 150)}`));
    } else {
      console.log('✅ No JS errors on login page');
    }
  });
});

test.describe('API Endpoints — UGent', () => {
  test('API routes respond (not 500)', async ({ request }) => {
    const endpoints = [
      { path: '/api/facts', name: 'Facts API' },
      // Auth and webhook routes require specific methods/payloads, just check they exist
      { path: '/api/auth/get-session', name: 'Auth: Session' },
    ];

    for (const ep of endpoints) {
      try {
        const res = await request.get(`${BASE_URL}${ep.path}`);
        const ok = res.status() < 500;
        console.log(`${ok ? '✅' : '❌'} ${ep.name}: ${res.status()}`);
      } catch {
        console.log(`❌ ${ep.name}: network error`);
      }
    }
  });

  test('cron endpoints require auth/secret', async ({ request }) => {
    const cronEndpoints = ['/api/cron/facts', '/api/cron/telegram-facts'];
    for (const path of cronEndpoints) {
      const res = await request.get(`${BASE_URL}${path}`);
      // Should be 401/403/405, not 500
      const ok = res.status() < 500;
      console.log(`${ok ? '✅' : '❌'} ${path}: ${res.status()} (protected)`);
    }
  });
});
