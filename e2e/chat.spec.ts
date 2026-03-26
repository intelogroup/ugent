import { test, expect } from '@playwright/test';

/**
 * UGent MedBot — Chat Feature E2E Tests
 *
 * Tests the chat interface: page load, UI elements, sending messages,
 * receiving AI responses, and starter prompts.
 *
 * Auth: WorkOS AuthKit (test mode). The test signs in via the WorkOS
 * hosted auth page using UGENT_TEST_EMAIL / UGENT_TEST_PASSWORD env vars.
 * If credentials are not set, auth-dependent tests are skipped.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.UGENT_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.UGENT_TEST_PASSWORD || '';

// ---------------------------------------------------------------------------
// Helper: sign in via WorkOS AuthKit hosted login page
// ---------------------------------------------------------------------------
async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // Click "Sign In" which redirects to WorkOS hosted auth
  const signInLink = page.locator('a', { hasText: 'Sign In' });
  await expect(signInLink).toBeVisible({ timeout: 10000 });
  await signInLink.click();

  // Wait for WorkOS auth page to load
  await page.waitForLoadState('networkidle');

  // WorkOS test mode shows an email input on the hosted page
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.waitFor({ timeout: 15000 });
  await emailInput.fill(TEST_EMAIL);

  // Look for continue/submit button on WorkOS page
  const continueBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")').first();
  await continueBtn.click();

  // If password field appears (WorkOS email+password auth)
  if (TEST_PASSWORD) {
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ timeout: 10000 }).catch(() => null);
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(TEST_PASSWORD);
      const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Continue")').first();
      await submitBtn.click();
    }
  }

  // Wait for redirect back to app (dashboard or chat)
  await page.waitForURL(/\/(dashboard|chat|browse)/, { timeout: 30000 });
}

// ---------------------------------------------------------------------------
// Chat page — unauthenticated behavior
// ---------------------------------------------------------------------------
test.describe('Chat — Unauthenticated', () => {
  test('chat page redirects to login when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    // Accept redirect to local /login, WorkOS hosted auth, or any auth URL.
    // The key assertion is that the user was redirected away from /chat.
    const chatUrl = `${BASE_URL}/chat`;
    const redirectedAway = !url.startsWith(chatUrl);
    console.log(`📊 /chat unauthenticated → ${url}`);

    if (!redirectedAway) {
      // If no redirect, check whether this is a Convex config error (incomplete local env).
      // In that case skip rather than false-pass.
      const hasConvexError = await page.locator('text=/ConvexReactClient/i').count();
      if (hasConvexError > 0) {
        console.log('⚠️  Skipping — local env without Convex cannot test redirect');
        test.skip(true, 'Local environment without Convex — redirect cannot be tested');
        return;
      }
    }

    expect(redirectedAway).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Chat page — authenticated behavior
// ---------------------------------------------------------------------------
test.describe('Chat — Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !TEST_EMAIL || !TEST_PASSWORD,
      'UGENT_TEST_EMAIL/UGENT_TEST_PASSWORD not set — skipping authenticated chat tests'
    );
    await signIn(page);
  });

  test('chat page loads with correct UI elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check we're on the chat page (not redirected)
    expect(page.url()).toContain('/chat');

    // Welcome heading should be visible when no messages
    const heading = page.getByRole('heading', { name: /how can i help you/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Bot icon
    const botIcon = page.locator('.rounded-full.bg-blue-100').first();
    await expect(botIcon).toBeVisible();

    // Study assistant tagline
    await expect(page.getByText(/Step 1 study assistant/i)).toBeVisible();

    console.log('✅ Chat page loads with welcome UI');
  });

  test('starter prompts are displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const starterPrompts = [
      'Nephritic vs Nephrotic syndrome',
      'Signs of Hyperkalemia',
      'Type II Hypersensitivity examples',
    ];

    for (const prompt of starterPrompts) {
      const btn = page.getByRole('button', { name: prompt });
      await expect(btn).toBeVisible({ timeout: 10000 });
    }

    console.log('✅ All 3 starter prompts visible');
  });

  test('input bar has textarea and send button', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Textarea with placeholder
    const textarea = page.locator('textarea[placeholder*="Ask anything"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Send button (disabled when empty)
    const sendBtn = page.locator('button[type="submit"]');
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();

    // Type something — send button should become enabled
    await textarea.fill('Hello');
    await expect(sendBtn).toBeEnabled();

    console.log('✅ Input bar with textarea and send button works');
  });

  test('user can send a message and receive a response', async ({ page }) => {
    test.setTimeout(60000); // AI response can take time

    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Type a medical question
    const textarea = page.locator('textarea[placeholder*="Ask anything"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill('What is nephrotic syndrome?');

    // Click send
    const sendBtn = page.locator('button[type="submit"]');
    await sendBtn.click();

    // User message should appear in the chat
    const userMessage = page.locator('text=What is nephrotic syndrome?');
    await expect(userMessage).toBeVisible({ timeout: 10000 });

    // Loading indicator (bouncing dots) should appear
    const loadingDots = page.locator('.animate-bounce').first();
    await expect(loadingDots).toBeVisible({ timeout: 10000 });

    // Wait for assistant response (the loading dots should disappear
    // and an assistant message should appear)
    await page.waitForTimeout(2000);

    // Check for assistant response — look for any message from the bot
    // (bot messages have a blue icon on the left)
    const assistantMessages = page.locator('[class*="bg-gray-50"]').filter({
      hasNot: page.locator('.animate-bounce'),
    });

    // Wait for at least one assistant message to appear
    await expect(assistantMessages.first()).toBeVisible({ timeout: 45000 });

    console.log('✅ User sent message and received AI response');
  });

  test('clicking a starter prompt sends it as a message', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Click the first starter prompt
    const starterBtn = page.getByRole('button', { name: 'Nephritic vs Nephrotic syndrome' });
    await expect(starterBtn).toBeVisible({ timeout: 10000 });
    await starterBtn.click();

    // The starter prompt text should appear as a user message
    await expect(page.locator('text=Nephritic vs Nephrotic syndrome')).toBeVisible({ timeout: 10000 });

    // Wait for bot response
    await page.waitForTimeout(5000);

    // The chat should now have messages (no longer showing the welcome screen)
    const heading = page.getByRole('heading', { name: /how can i help you/i });
    await expect(heading).not.toBeVisible();

    console.log('✅ Starter prompt click sends message');
  });

  test('send message via Enter key', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const textarea = page.locator('textarea[placeholder*="Ask anything"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill('What is hypertension?');

    // Press Enter to send (not Shift+Enter which is newline)
    await textarea.press('Enter');

    // User message should appear
    await expect(page.locator('text=What is hypertension?')).toBeVisible({ timeout: 10000 });

    console.log('✅ Enter key sends message');
  });

  test('Shift+Enter creates new line instead of sending', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const textarea = page.locator('textarea[placeholder*="Ask anything"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill('Line 1');
    await textarea.press('Shift+Enter');
    await textarea.type('Line 2');

    // The textarea should contain both lines (message not sent)
    const value = await textarea.inputValue();
    expect(value).toContain('Line 1');
    expect(value).toContain('Line 2');

    // Welcome heading should still be visible (no message sent)
    const heading = page.getByRole('heading', { name: /how can i help you/i });
    await expect(heading).toBeVisible();

    console.log('✅ Shift+Enter creates new line, does not send');
  });
});

// ---------------------------------------------------------------------------
// Chat with chapter scope (from browse)
// ---------------------------------------------------------------------------
test.describe('Chat — Chapter Scoped', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !TEST_EMAIL || !TEST_PASSWORD,
      'UGENT_TEST_EMAIL/UGENT_TEST_PASSWORD not set — skipping chapter-scoped chat tests'
    );
    await signIn(page);
  });

  test('chat with chapter scope shows chapter badge and scoped starters', async ({ page }) => {
    // Navigate to chat with chapter scope params
    await page.goto(`${BASE_URL}/chat?book=pathoma&chapter=1`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Chapter badge should be visible at top
    const chapterBadge = page.locator('.bg-blue-50, [class*="bg-blue-50"]').first();
    await expect(chapterBadge).toBeVisible({ timeout: 10000 });

    // Chapter-specific starter prompts
    const chapterStarters = [
      'What are the key concepts in this chapter?',
      'What are the high-yield topics for Step 1?',
      'Summarize the main pathology mechanisms',
    ];

    for (const prompt of chapterStarters) {
      await expect(page.getByRole('button', { name: prompt })).toBeVisible({ timeout: 5000 });
    }

    console.log('✅ Chapter-scoped chat shows badge and chapter starters');
  });
});

// ---------------------------------------------------------------------------
// Chat API endpoint
// ---------------------------------------------------------------------------
test.describe('Chat API — /api/chat', () => {
  test('POST /api/chat without auth returns 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/chat`, {
      data: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
      headers: { 'Content-Type': 'application/json' },
    });

    const status = res.status();
    console.log(`📊 POST /api/chat unauthenticated: ${status}`);
    expect(status).toBe(401);
    console.log('✅ /api/chat correctly requires auth');
  });

  test('POST /api/chat with invalid body returns 400', async ({ page }) => {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
      test.skip(true, 'Skipped — UGENT_TEST_EMAIL / UGENT_TEST_PASSWORD not set');
      return;
    }

    await signIn(page);

    // Use page.request so auth cookies from the browser session are included
    const res = await page.request.post(`${BASE_URL}/api/chat`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });

    const status = res.status();
    console.log(`📊 POST /api/chat authenticated + invalid body: ${status}`);
    expect(status).toBe(400);
    console.log('✅ /api/chat rejects invalid body with 400 after auth');
  });
});
