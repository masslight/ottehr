import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { navigateToDocsFoldersAdmin } from 'tests/e2e/page/DocsFoldersAdminPage';
import { FOLDERS_CONFIG } from 'utils';

const DEFAULT_TIMEOUT = { timeout: 30_000 };
const TIMESTAMP = DateTime.now().toMillis();

const FOLDER_NAME = `E2E Folder ${TIMESTAMP}`;
const RENAMED_FOLDER_NAME = `E2E Folder Renamed ${TIMESTAMP}`;
const PROTECTED_FOLDER_NAME = FOLDERS_CONFIG[0].display;

test.describe('Custom Folders Admin E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('Admin can navigate to the Docs Folders tab and see protected folders', async ({ page }) => {
    const admin = await navigateToDocsFoldersAdmin(page);

    await test.step('Protected folder rows are present', async () => {
      await admin.expectFolderVisible(PROTECTED_FOLDER_NAME);
    });
  });

  test('Admin creates a new custom folder and sees it in the table', async ({ page }) => {
    const admin = await navigateToDocsFoldersAdmin(page);

    await test.step('Create the folder', async () => {
      await admin.createFolder(FOLDER_NAME);
    });

    await test.step('New folder appears in the table', async () => {
      await admin.expectFolderVisible(FOLDER_NAME);
    });
  });

  test('Validation: duplicate name is rejected client-side', async ({ page }) => {
    const admin = await navigateToDocsFoldersAdmin(page);
    await admin.expectFolderVisible(FOLDER_NAME);

    await admin.openCreateDialog();
    await admin.fillFolderName(FOLDER_NAME);
    // Inline validation surfaces duplicate before the user can submit.
    await expect(admin.validationMessage(/already exists/i)).toBeVisible(DEFAULT_TIMEOUT);
    await expect(admin.createButton()).toBeDisabled();

    await admin.cancelDialog();
  });

  test('Validation: protected folder display name is rejected', async ({ page }) => {
    const admin = await navigateToDocsFoldersAdmin(page);

    await admin.openCreateDialog();
    await admin.fillFolderName(PROTECTED_FOLDER_NAME);
    await expect(admin.validationMessage(/already exists/i)).toBeVisible(DEFAULT_TIMEOUT);

    await admin.cancelDialog();
  });

  test('Validation: disallowed characters are rejected', async ({ page }) => {
    const admin = await navigateToDocsFoldersAdmin(page);

    await admin.openCreateDialog();
    await admin.fillFolderName('Bad/Name');
    await expect(admin.validationMessage(/Only letters, numbers, spaces/i)).toBeVisible(DEFAULT_TIMEOUT);

    await admin.cancelDialog();
  });

  test('Admin renames the custom folder', async ({ page }) => {
    const admin = await navigateToDocsFoldersAdmin(page);

    await admin.renameFolder(FOLDER_NAME, RENAMED_FOLDER_NAME);

    await admin.expectFolderVisible(RENAMED_FOLDER_NAME);
    // Original name no longer in the table (deduped — same internalName, new display).
    await admin.expectFolderNotPresent(FOLDER_NAME);
  });

  test('Admin opens the soft-delete confirmation dialog and confirms deletion', async ({ page }) => {
    const admin = await navigateToDocsFoldersAdmin(page);

    await admin.openDeleteDialog(RENAMED_FOLDER_NAME);

    await test.step('Soft-delete dialog explains the semantics', async () => {
      await expect(
        admin.deleteDialog().getByText(/folder will remain for the patients who have docs in it/i)
      ).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Confirm deletion', async () => {
      await admin.confirmDelete();
    });

    await test.step('Folder no longer present in the table', async () => {
      await admin.expectFolderNotPresent(RENAMED_FOLDER_NAME);
    });
  });
});
