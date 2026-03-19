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
  
  // Find the submit button by its class/type since it doesn't have a label
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
  
  // Wait for message to appear in the chat list
  await expect(page.getByText('What is Nephritic syndrome?')).toBeVisible();
});
