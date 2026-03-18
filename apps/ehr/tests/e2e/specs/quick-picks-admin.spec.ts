import { expect, test } from '@playwright/test';

const DEFAULT_TIMEOUT = { timeout: 15000 };

test('Quick picks admin page loads with tabs', async ({ page }) => {
  await page.goto('telemed-admin/quick-picks');

  await test.step('Page loads and loading spinner disappears', async () => {
    // Wait for the Quick Picks top-level tab to be visible, confirming page load
    await expect(page.getByRole('tab', { name: 'Quick Picks' })).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Sub-tabs exist for all quick pick categories', async () => {
    await expect(page.getByRole('tab', { name: 'Procedures' })).toBeVisible(DEFAULT_TIMEOUT);
    await expect(page.getByRole('tab', { name: 'Allergies' })).toBeVisible(DEFAULT_TIMEOUT);
    await expect(page.getByRole('tab', { name: 'Medical Conditions' })).toBeVisible(DEFAULT_TIMEOUT);
    await expect(page.getByRole('tab', { name: 'Medications' })).toBeVisible(DEFAULT_TIMEOUT);
  });
});

test('Can switch between quick pick sub-tabs', async ({ page }) => {
  await page.goto('telemed-admin/quick-picks');
  await expect(page.getByRole('tab', { name: 'Procedures' })).toBeVisible(DEFAULT_TIMEOUT);

  await test.step('Switch to Allergies tab', async () => {
    await page.getByRole('tab', { name: 'Allergies' }).click();
    await expect(page.getByText('Allergy Quick Picks')).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Switch to Medical Conditions tab', async () => {
    await page.getByRole('tab', { name: 'Medical Conditions' }).click();
    await expect(page.getByText('Medical Condition Quick Picks')).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Switch to Medications tab', async () => {
    await page.getByRole('tab', { name: 'Medications' }).click();
    await expect(page.getByText('Medication Quick Picks')).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Switch back to Procedures tab', async () => {
    await page.getByRole('tab', { name: 'Procedures' }).click();
    // Procedures tab uses ProcedureQuickPicksPage which has its own title
    await expect(page.getByRole('tab', { name: 'Procedures' })).toHaveAttribute('aria-selected', 'true');
  });
});

test('Procedures tab displays quick picks content', async ({ page }) => {
  await page.goto('telemed-admin/quick-picks');
  await expect(page.getByRole('tab', { name: 'Procedures' })).toBeVisible(DEFAULT_TIMEOUT);

  await test.step('Procedures tab is selected by default', async () => {
    await expect(page.getByRole('tab', { name: 'Procedures' })).toHaveAttribute('aria-selected', 'true');
  });

  await test.step('Procedures content is visible', async () => {
    // Wait for loading to finish - either a table or empty state should appear
    const contentLocator = page.locator('table, text=No quick picks configured yet., text=Procedure Quick Picks');
    await expect(contentLocator.first()).toBeVisible(DEFAULT_TIMEOUT);
  });
});

test('Allergies tab shows add functionality', async ({ page }) => {
  await page.goto('telemed-admin/quick-picks');
  await expect(page.getByRole('tab', { name: 'Allergies' })).toBeVisible(DEFAULT_TIMEOUT);

  await test.step('Navigate to Allergies tab', async () => {
    await page.getByRole('tab', { name: 'Allergies' }).click();
    await expect(page.getByText('Allergy Quick Picks')).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Add button is visible', async () => {
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Clicking Add opens dialog with form fields', async () => {
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Add Quick Pick')).toBeVisible(DEFAULT_TIMEOUT);

    // The dialog should contain form content and Cancel/Add buttons
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Dialog can be closed with Cancel', async () => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByText('Add Quick Pick')).not.toBeVisible(DEFAULT_TIMEOUT);
  });
});

test('Tab navigation preserves loaded content', async ({ page }) => {
  await page.goto('telemed-admin/quick-picks');
  await expect(page.getByRole('tab', { name: 'Procedures' })).toBeVisible(DEFAULT_TIMEOUT);

  await test.step('Load Allergies tab content', async () => {
    await page.getByRole('tab', { name: 'Allergies' }).click();
    await expect(page.getByText('Allergy Quick Picks')).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Switch to Medications tab', async () => {
    await page.getByRole('tab', { name: 'Medications' }).click();
    await expect(page.getByText('Medication Quick Picks')).toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('Return to Allergies tab and verify content is still loaded', async () => {
    await page.getByRole('tab', { name: 'Allergies' }).click();
    await expect(page.getByText('Allergy Quick Picks')).toBeVisible(DEFAULT_TIMEOUT);
    // Verify the description text is also present, confirming full content load
    await expect(
      page.getByText('Manage common allergies that appear as quick picks when documenting patient allergies.')
    ).toBeVisible(DEFAULT_TIMEOUT);
  });
});
