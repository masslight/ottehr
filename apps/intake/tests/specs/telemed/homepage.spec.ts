import { expect, test } from '@playwright/test';

test('Should open home page and show Request a Virtual Visit button', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Start a Virtual Visit' }).click();
  await expect(page.getByRole('heading', { name: 'Request a Virtual Visit', level: 2 })).toBeVisible({
    timeout: 15000,
  });
});

test('Should open Book In-Person Visit', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Schedule an In-Person Visit' }).click();
  await expect(page.getByRole('heading', { name: 'Book a visit', level: 2 })).toBeVisible({
    timeout: 15000,
  });
});

test('Should open Support dialog', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Support' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Need help?')).toBeVisible();
});
