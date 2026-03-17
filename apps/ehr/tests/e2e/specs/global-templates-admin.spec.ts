import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForSnackbar } from '../../e2e-utils/helpers/tests-utils';

const DEFAULT_TIMEOUT = { timeout: 15000 };

test.describe('Global Templates Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/telemed-admin/global-templates');
    await page.waitForLoadState('networkidle');
  });

  test('Admin page loads and shows templates table', async ({ page }) => {
    await test.step('Verify loading spinner disappears', async () => {
      await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Verify Global Templates tab is active', async () => {
      const globalTemplatesTab = page.getByRole('tab', { name: 'Global Templates' });
      await expect(globalTemplatesTab).toBeVisible(DEFAULT_TIMEOUT);
      await expect(globalTemplatesTab).toHaveAttribute('aria-selected', 'true');
    });

    await test.step('Verify templates table is displayed', async () => {
      const table = page.getByRole('table', { name: 'templates table' });
      await expect(table).toBeVisible(DEFAULT_TIMEOUT);

      // Verify table headers
      await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Version Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });

    await test.step('Verify at least one template row exists', async () => {
      const rows = page.getByRole('table', { name: 'templates table' }).locator('tbody tr');
      await expect(rows.first()).toBeVisible(DEFAULT_TIMEOUT);
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test('Templates show version status indicators', async ({ page }) => {
    await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);

    const table = page.getByRole('table', { name: 'templates table' });
    await expect(table).toBeVisible(DEFAULT_TIMEOUT);

    // Each row should have either a "Current" or "Stale" chip
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const currentChip = row.getByText('Current');
      const staleChip = row.getByText('Stale');

      const hasCurrent = await currentChip.isVisible().catch(() => false);
      const hasStale = await staleChip.isVisible().catch(() => false);

      expect(hasCurrent || hasStale).toBe(true);
    }
  });

  test('Rename template', async ({ page }) => {
    await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);

    const table = page.getByRole('table', { name: 'templates table' });
    await expect(table).toBeVisible(DEFAULT_TIMEOUT);

    // Get the first template's current name
    const firstRow = table.locator('tbody tr').first();
    const originalName = await firstRow.locator('td').first().innerText();
    const uniqueSuffix = DateTime.now().toMillis();
    const tempName = `${originalName} Renamed ${uniqueSuffix}`;

    await test.step('Open rename dialog and rename template', async () => {
      const renameButton = firstRow.getByRole('button', { name: 'Rename template' });
      await renameButton.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);
      await expect(dialog.getByText('Rename Template')).toBeVisible();

      // Clear and enter new name
      const nameField = dialog.getByLabel('New template name');
      await nameField.clear();
      await nameField.fill(tempName);

      // Click Rename button
      await dialog.getByRole('button', { name: 'Rename' }).click();

      await waitForSnackbar(page);
    });

    await test.step('Verify the template name updated in the table', async () => {
      await expect(page.getByRole('cell', { name: tempName })).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Clean up by renaming back to original name', async () => {
      // Find the row with the temp name and click rename
      const renamedRow = table.locator(`tbody tr`, { hasText: tempName });
      const renameButton = renamedRow.getByRole('button', { name: 'Rename template' });
      await renameButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);

      const nameField = dialog.getByLabel('New template name');
      await nameField.clear();
      await nameField.fill(originalName);

      await dialog.getByRole('button', { name: 'Rename' }).click();

      await waitForSnackbar(page);
      await expect(page.getByRole('cell', { name: originalName })).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test('Navigate between admin tabs', async ({ page }) => {
    await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);

    await test.step('Verify Global Templates tab is initially active', async () => {
      const globalTemplatesTab = page.getByRole('tab', { name: 'Global Templates' });
      await expect(globalTemplatesTab).toHaveAttribute('aria-selected', 'true');
    });

    await test.step('Navigate to Insurance tab', async () => {
      const insuranceTab = page.getByRole('tab', { name: 'Insurance' });
      await insuranceTab.click();
      await expect(insuranceTab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Global Templates' })).toHaveAttribute('aria-selected', 'false');
    });

    await test.step('Navigate back to Global Templates tab', async () => {
      const globalTemplatesTab = page.getByRole('tab', { name: 'Global Templates' });
      await globalTemplatesTab.click();
      await expect(globalTemplatesTab).toHaveAttribute('aria-selected', 'true');

      // Verify the templates table is visible again
      const table = page.getByRole('table', { name: 'templates table' });
      await expect(table).toBeVisible(DEFAULT_TIMEOUT);
    });
  });
});
