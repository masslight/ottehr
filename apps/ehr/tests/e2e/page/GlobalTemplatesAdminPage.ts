import { expect, Locator, Page } from '@playwright/test';
import { waitForSnackbar } from '../../e2e-utils/helpers/tests-utils';

const DEFAULT_TIMEOUT = { timeout: 30000 };

export class GlobalTemplatesAdminPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async waitForTableLoaded(): Promise<void> {
    await expect(this.#page.locator('role=progressbar')).not.toBeVisible(DEFAULT_TIMEOUT);
    // Table may or may not be visible depending on whether templates exist
    // Wait for either the table or the "No templates found" message
    await expect(
      this.#page.getByRole('table', { name: 'templates table' }).or(this.#page.getByText('No templates found'))
    ).toBeVisible(DEFAULT_TIMEOUT);
  }

  #getTable(): Locator {
    return this.#page.getByRole('table', { name: 'templates table' });
  }

  findTemplateRow(templateName: string): Locator {
    return this.#getTable().locator('tbody tr', { hasText: templateName });
  }

  async verifyTemplateExists(templateName: string): Promise<void> {
    await expect(this.findTemplateRow(templateName)).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyTemplateNotPresent(templateName: string): Promise<void> {
    await expect(this.findTemplateRow(templateName)).not.toBeVisible(DEFAULT_TIMEOUT);
  }

  async filterTemplates(filterText: string): Promise<void> {
    const filterField = this.#page.getByPlaceholder('Filter templates...');
    await filterField.clear();
    await filterField.fill(filterText);
    // Client-side filtering, brief wait for re-render
    await this.#page.waitForTimeout(300);
  }

  async renameTemplate(currentName: string, newName: string): Promise<void> {
    const row = this.findTemplateRow(currentName);
    await row.getByRole('button', { name: 'Rename template' }).click();

    const dialog = this.#page.getByRole('dialog');
    await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);

    const nameField = dialog.getByLabel('New template name');
    await nameField.clear();
    await nameField.fill(newName);

    await dialog.getByRole('button', { name: 'Rename' }).click();
    await waitForSnackbar(this.#page);
  }

  async deleteTemplate(templateName: string): Promise<void> {
    const row = this.findTemplateRow(templateName);
    await row.getByRole('button', { name: 'Delete template' }).click();

    const dialog = this.#page.getByRole('dialog');
    await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);
    await expect(dialog.getByText('Are you sure you want to delete the template')).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete' }).click();
    await waitForSnackbar(this.#page);
  }
}

export async function navigateToGlobalTemplatesAdmin(page: Page): Promise<GlobalTemplatesAdminPage> {
  await page.goto('/admin/global-templates');
  const adminPage = new GlobalTemplatesAdminPage(page);
  await adminPage.waitForTableLoaded();
  return adminPage;
}
