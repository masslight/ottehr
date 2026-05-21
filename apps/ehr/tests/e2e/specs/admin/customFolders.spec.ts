import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { FOLDERS_CONFIG } from 'utils';

const DEFAULT_TIMEOUT = { timeout: 30_000 };
const TIMESTAMP = DateTime.now().toMillis();

const FOLDER_NAME = `E2E Folder ${TIMESTAMP}`;
const RENAMED_FOLDER_NAME = `E2E Folder Renamed ${TIMESTAMP}`;
const PROTECTED_FOLDER_NAME = FOLDERS_CONFIG[0].display;

test.describe('Custom Folders Admin E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('Admin can navigate to the Docs Folders tab and see protected folders', async ({ page }) => {
    await page.goto('admin/docs-folders');

    await test.step('Page loads with Add Folder button', async () => {
      await expect(page.getByRole('button', { name: /add folder/i })).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Protected folder rows are present', async () => {
      // Filter via search so the assertion is independent of alphabetical paging.
      await page.getByLabel('Folder', { exact: true }).fill(PROTECTED_FOLDER_NAME);
      await expect(page.getByRole('cell', { name: PROTECTED_FOLDER_NAME, exact: true })).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test('Admin creates a new custom folder and sees it in the table', async ({ page }) => {
    await page.goto('admin/docs-folders');
    await expect(page.getByRole('button', { name: /add folder/i })).toBeVisible(DEFAULT_TIMEOUT);

    await test.step('Open the create dialog', async () => {
      await page.getByRole('button', { name: /add folder/i }).click();
      await expect(page.getByText('Create New Folder')).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Submit a new folder name', async () => {
      await page.getByLabel(/Folder Name/i).fill(FOLDER_NAME);
      await page.getByRole('button', { name: 'Create' }).click();
      // Dialog closes after success.
      await expect(page.getByText('Create New Folder')).not.toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('New folder appears in the table', async () => {
      await expect(page.getByRole('cell', { name: FOLDER_NAME })).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test('Validation: duplicate name is rejected client-side', async ({ page }) => {
    await page.goto('admin/docs-folders');
    await expect(page.getByRole('cell', { name: FOLDER_NAME })).toBeVisible(DEFAULT_TIMEOUT);

    await page.getByRole('button', { name: /add folder/i }).click();
    await expect(page.getByText('Create New Folder')).toBeVisible(DEFAULT_TIMEOUT);

    await page.getByLabel(/Folder Name/i).fill(FOLDER_NAME);
    // Inline validation surfaces duplicate before the user can submit.
    await expect(page.getByText(/already exists/i)).toBeVisible(DEFAULT_TIMEOUT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();

    // Cancel out.
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Validation: protected folder display name is rejected', async ({ page }) => {
    await page.goto('admin/docs-folders');
    await page.getByRole('button', { name: /add folder/i }).click();
    await expect(page.getByText('Create New Folder')).toBeVisible(DEFAULT_TIMEOUT);

    await page.getByLabel(/Folder Name/i).fill(PROTECTED_FOLDER_NAME);
    await expect(page.getByText(/already exists/i)).toBeVisible(DEFAULT_TIMEOUT);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Validation: disallowed characters are rejected', async ({ page }) => {
    await page.goto('admin/docs-folders');
    await page.getByRole('button', { name: /add folder/i }).click();
    await expect(page.getByText('Create New Folder')).toBeVisible(DEFAULT_TIMEOUT);

    await page.getByLabel(/Folder Name/i).fill('Bad/Name');
    await expect(page.getByText(/Only letters, numbers, spaces/i)).toBeVisible(DEFAULT_TIMEOUT);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Admin renames the custom folder', async ({ page }) => {
    await page.goto('admin/docs-folders');
    await expect(page.getByRole('cell', { name: FOLDER_NAME })).toBeVisible(DEFAULT_TIMEOUT);

    // The custom row's actions cell holds rename + delete buttons. We scope to the row.
    const row = page.getByRole('row').filter({ hasText: FOLDER_NAME });
    await row.getByRole('button', { name: /rename/i }).click();
    await expect(page.getByText('Rename Folder')).toBeVisible(DEFAULT_TIMEOUT);

    const input = page.getByLabel(/Folder Name/i);
    await input.fill(RENAMED_FOLDER_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Rename Folder')).not.toBeVisible(DEFAULT_TIMEOUT);

    await expect(page.getByRole('cell', { name: RENAMED_FOLDER_NAME })).toBeVisible(DEFAULT_TIMEOUT);
    // Original name no longer in the table (deduped — same internalName, new display).
    await expect(page.getByRole('cell', { name: FOLDER_NAME, exact: true })).not.toBeVisible(DEFAULT_TIMEOUT);
  });

  test('Admin opens the soft-delete confirmation dialog and confirms deletion', async ({ page }) => {
    await page.goto('admin/docs-folders');
    await expect(page.getByRole('cell', { name: RENAMED_FOLDER_NAME })).toBeVisible(DEFAULT_TIMEOUT);

    const row = page.getByRole('row').filter({ hasText: RENAMED_FOLDER_NAME });
    await row.getByRole('button', { name: /delete/i }).click();

    await test.step('Soft-delete dialog explains the semantics', async () => {
      await expect(page.getByText('Delete Folder')).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByText(/folder will remain for the patients who have docs in it/i)).toBeVisible(
        DEFAULT_TIMEOUT
      );
    });

    await test.step('Confirm deletion', async () => {
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText('Delete Folder')).not.toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Folder no longer present in the table', async () => {
      await expect(page.getByRole('cell', { name: RENAMED_FOLDER_NAME })).not.toBeVisible(DEFAULT_TIMEOUT);
    });
  });
});
