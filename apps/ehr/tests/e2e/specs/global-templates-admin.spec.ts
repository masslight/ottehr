import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForSnackbar } from '../../e2e-utils/helpers/tests-utils';

const DEFAULT_TIMEOUT = { timeout: 30000 };

test.describe('Global Templates Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/telemed-admin/global-templates');
    await page.waitForLoadState('domcontentloaded');
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

  test('View template detail page', async ({ page }) => {
    await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);

    const table = page.getByRole('table', { name: 'templates table' });
    await expect(table).toBeVisible(DEFAULT_TIMEOUT);

    // Get the first template name and click it
    const firstRow = table.locator('tbody tr').first();
    const templateName = await firstRow.locator('td').first().innerText();
    await firstRow.locator('td').first().locator('a').click();

    await test.step('Verify detail page elements', async () => {
      // Back button
      const backButton = page.locator('button', { has: page.locator('[data-testid="ArrowBackIcon"]') });
      await expect(backButton).toBeVisible(DEFAULT_TIMEOUT);

      // Template name heading
      await expect(page.getByRole('heading', { name: templateName })).toBeVisible(DEFAULT_TIMEOUT);

      // Version status chip
      const currentChip = page.getByText('Current');
      const staleChip = page.getByText('Stale');
      const hasCurrent = await currentChip.isVisible().catch(() => false);
      const hasStale = await staleChip.isVisible().catch(() => false);
      expect(hasCurrent || hasStale).toBe(true);

      // Info alert about updating templates
      await expect(page.getByText('To update this template')).toBeVisible();

      // At least some section cards visible
      await expect(page.getByText('HPI', { exact: true })).toBeVisible();
      await expect(page.getByText('Exam Findings')).toBeVisible();
    });

    await test.step('Navigate back via back button', async () => {
      const backButton = page.locator('button', { has: page.locator('[data-testid="ArrowBackIcon"]') });
      await backButton.click();

      // Verify we are back on the templates list
      await expect(page.getByRole('table', { name: 'templates table' })).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test('Filter templates by name', async ({ page }) => {
    await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);

    const table = page.getByRole('table', { name: 'templates table' });
    await expect(table).toBeVisible(DEFAULT_TIMEOUT);

    const rows = table.locator('tbody tr');
    const totalCount = await rows.count();
    expect(totalCount).toBeGreaterThan(0);

    // Get the first template's name and use a fragment for filtering
    const firstTemplateName = await rows.first().locator('td').first().innerText();
    const filterText = firstTemplateName.substring(0, Math.min(firstTemplateName.length, 5));

    await test.step('Apply filter and verify results narrow', async () => {
      const filterField = page.getByPlaceholder('Filter templates...');
      await filterField.fill(filterText);

      // Wait briefly for filter to apply (client-side)
      await page.waitForTimeout(300);

      const filteredCount = await rows.count();
      expect(filteredCount).toBeGreaterThan(0);

      // Verify at least one row contains the filter text
      const firstFilteredName = await rows.first().locator('td').first().innerText();
      expect(firstFilteredName.toLowerCase()).toContain(filterText.toLowerCase());
    });

    await test.step('Clear filter and verify full list restored', async () => {
      const filterField = page.getByPlaceholder('Filter templates...');
      await filterField.clear();

      await page.waitForTimeout(300);

      const restoredCount = await rows.count();
      expect(restoredCount).toBe(totalCount);
    });
  });

  test('Delete template shows confirmation dialog', async ({ page }) => {
    await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);

    const table = page.getByRole('table', { name: 'templates table' });
    await expect(table).toBeVisible(DEFAULT_TIMEOUT);

    const firstRow = table.locator('tbody tr').first();
    const templateName = await firstRow.locator('td').first().innerText();

    await test.step('Click delete button and verify confirmation dialog', async () => {
      const deleteButton = firstRow.getByRole('button', { name: 'Delete template' });
      await deleteButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);
      await expect(dialog.getByText('Delete Template')).toBeVisible();
      await expect(dialog.getByText('Are you sure you want to delete the template')).toBeVisible();
      await expect(dialog.getByText(templateName)).toBeVisible();
      await expect(dialog.getByText('This action cannot be undone')).toBeVisible();
    });

    await test.step('Cancel deletion and verify template still exists', async () => {
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await expect(dialog).not.toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByRole('cell', { name: templateName })).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test('Template detail page shows organized sections', async ({ page }) => {
    await expect(page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);

    const table = page.getByRole('table', { name: 'templates table' });
    await expect(table).toBeVisible(DEFAULT_TIMEOUT);

    // Navigate to the first template's detail page
    const firstRow = table.locator('tbody tr').first();
    await firstRow.locator('td').first().locator('a').click();

    // Wait for detail page to load
    await expect(page.getByText('To update this template')).toBeVisible(DEFAULT_TIMEOUT);

    await test.step('Verify all section cards are present', async () => {
      const sectionTitles = [
        'HPI',
        'Mechanism of Injury (MOI)',
        'Review of Systems (ROS)',
        "Patient's Condition Related To",
        'Exam Findings',
        'Medical Decision Making',
        'Assessment / ICD-10 Diagnoses',
        'CPT Codes',
        'E&M Code',
        'Patient Instructions',
      ];

      for (const title of sectionTitles) {
        await expect(page.getByText(title, { exact: true })).toBeVisible(DEFAULT_TIMEOUT);
      }
    });

    await test.step('Verify update info alert is visible', async () => {
      await expect(
        page.getByText('To update this template, use a test patient, apply this template, make any changes')
      ).toBeVisible();
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
