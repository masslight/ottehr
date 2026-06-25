import { expect, Locator, Page } from '@playwright/test';

const DEFAULT_TIMEOUT = { timeout: 30_000 };

const ROUTE = 'admin/docs-folders';

/**
 * Page object for the admin "Docs Folders" catalog page.
 *
 * The table merges system + custom folders, sorts them alphabetically and pages at
 * 10 rows. Asserting on a row therefore can't assume it lands on the first page — every
 * visibility check first narrows the table via the search box so it's independent of how
 * many folders the (shared) catalog already holds.
 */
export class DocsFoldersAdminPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async expectLoaded(): Promise<void> {
    await expect(this.#addFolderButton()).toBeVisible(DEFAULT_TIMEOUT);
  }

  #addFolderButton(): Locator {
    return this.#page.getByRole('button', { name: /add folder/i });
  }

  #folderNameInput(): Locator {
    return this.#page.getByLabel(/Folder Name/i);
  }

  // ── Table / search ───────────────────────────────────────────────────────

  /** Narrow the table to rows whose display name contains `text` (client-side filter). */
  async search(text: string): Promise<void> {
    await this.#page.getByLabel('Folder', { exact: true }).fill(text);
  }

  folderCell(name: string): Locator {
    return this.#page.getByRole('cell', { name, exact: true });
  }

  folderRow(name: string): Locator {
    return this.#page.getByRole('row').filter({ hasText: name });
  }

  /** Search for `name`, then assert its row is present — robust to alphabetical paging. */
  async expectFolderVisible(name: string): Promise<void> {
    await this.search(name);
    await expect(this.folderCell(name)).toBeVisible(DEFAULT_TIMEOUT);
  }

  /** Search for `name`, then assert no row with that exact display name exists. */
  async expectFolderNotPresent(name: string): Promise<void> {
    await this.search(name);
    await expect(this.folderCell(name)).not.toBeVisible(DEFAULT_TIMEOUT);
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async openCreateDialog(): Promise<void> {
    await this.#addFolderButton().click();
    await expect(this.#page.getByText('Create New Folder')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async fillFolderName(name: string): Promise<void> {
    await this.#folderNameInput().fill(name);
  }

  createButton(): Locator {
    return this.#page.getByRole('button', { name: 'Create' });
  }

  /** Inline validation message shown in the create/rename dialog (e.g. duplicate name). */
  validationMessage(matcher: string | RegExp): Locator {
    return this.#page.getByText(matcher);
  }

  async cancelDialog(): Promise<void> {
    await this.#page.getByRole('button', { name: 'Cancel' }).click();
  }

  async createFolder(name: string): Promise<void> {
    await this.openCreateDialog();
    await this.fillFolderName(name);
    await this.createButton().click();
    await expect(this.#page.getByText('Create New Folder')).not.toBeVisible(DEFAULT_TIMEOUT);
  }

  // ── Rename ───────────────────────────────────────────────────────────────

  async renameFolder(currentName: string, newName: string): Promise<void> {
    await this.expectFolderVisible(currentName);
    await this.folderRow(currentName)
      .getByRole('button', { name: /rename/i })
      .click();
    await expect(this.#page.getByText('Rename Folder')).toBeVisible(DEFAULT_TIMEOUT);

    await this.fillFolderName(newName);
    await this.#page.getByRole('button', { name: 'Save' }).click();
    await expect(this.#page.getByText('Rename Folder')).not.toBeVisible(DEFAULT_TIMEOUT);
  }

  // ── Delete (soft-delete) ───────────────────────────────────────────────────

  deleteDialog(): Locator {
    return this.#page.getByRole('dialog');
  }

  async openDeleteDialog(name: string): Promise<void> {
    await this.expectFolderVisible(name);
    await this.folderRow(name)
      .getByRole('button', { name: /delete/i })
      .click();
    await expect(this.#page.getByText('Delete Folder')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async confirmDelete(): Promise<void> {
    await this.deleteDialog().getByRole('button', { name: 'Delete' }).click();
    await expect(this.#page.getByText('Delete Folder')).not.toBeVisible(DEFAULT_TIMEOUT);
  }
}

export async function navigateToDocsFoldersAdmin(page: Page): Promise<DocsFoldersAdminPage> {
  await page.goto(ROUTE);
  const adminPage = new DocsFoldersAdminPage(page);
  await adminPage.expectLoaded();
  return adminPage;
}
