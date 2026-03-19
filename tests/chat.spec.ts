import { test, expect } from '@playwright/test';

test('has title and input', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle(/U-Gent Medical Chatbot/i);
  await expect(page.getByRole('textbox')).toBeVisible();
});

test('can type a message', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const input = page.getByRole('textbox');
  await input.fill('What is Nephritic syndrome?');
  
  // Wait for the button to be enabled (Next.js client-side state update)
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled({ timeout: 10000 });
  await submitButton.click();
  
  // Wait for user message to appear
  await expect(page.getByText('What is Nephritic syndrome?')).toBeVisible();
  
  // Wait for AI response to start appearing (look for something from the assistant)
  // Our MessageBubble uses Bot icon for assistant. 
  // We can look for common response patterns or wait for content.
  // Since it's medical, it should mention Nephritic syndrome in its response.
  await expect(page.locator('.bg-transparent.text-gray-800').first()).toBeVisible({ timeout: 15000 });
});
