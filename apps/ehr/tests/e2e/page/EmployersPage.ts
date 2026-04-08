import { expect, Page } from '@playwright/test';

const DEFAULT_TIMEOUT = { timeout: 15000 };

export class EmployersPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/admin/billing/employers');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForTableLoaded(): Promise<void> {
    await expect(this.page.locator('table[aria-label="Employers table"]')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async searchEmployers(text: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Employer' }).fill(text);
  }

  async verifyEmployerVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name, exact: true })).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyEmployerNotVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name, exact: true })).not.toBeVisible();
  }

  async getEmployerRows(): Promise<number> {
    return this.page.locator('tbody tr').count();
  }

  async clickAddNew(): Promise<EmployerDialogPage> {
    await this.page.getByRole('button', { name: /add new/i }).click();
    const dialog = new EmployerDialogPage(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  async clickEmployerByName(name: string): Promise<EmployerDialogPage> {
    await this.page.locator('tr', { hasText: name }).click();
    const dialog = new EmployerDialogPage(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  async verifyEmployersTabSelected(): Promise<void> {
    await expect(this.page.getByRole('tab', { name: 'Employers' })).toHaveAttribute('aria-selected', 'true');
  }

  async verifyNoEmployersFound(): Promise<void> {
    await expect(this.page.getByText('No employers found.')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyPaginationDisplayed(): Promise<void> {
    await expect(this.page.locator('.MuiTablePagination-root')).toBeVisible(DEFAULT_TIMEOUT);
  }
}

export class EmployerDialogPage {
  constructor(private page: Page) {}

  async waitForOpen(): Promise<void> {
    await expect(this.page.getByRole('dialog')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async waitForClosed(): Promise<void> {
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
  }

  async fillEmployerName(name: string): Promise<void> {
    await this.page.getByLabel('Employer name').fill(name);
  }

  async clickAdd(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();
  }

  async clickSave(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async clickDone(): Promise<void> {
    await this.page.getByRole('button', { name: 'Done' }).click();
  }

  async clickCancel(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
  }

  async clickDeactivate(): Promise<void> {
    await this.page.getByRole('button', { name: 'Deactivate' }).click();
  }

  async clickActivate(): Promise<void> {
    await this.page.getByRole('button', { name: 'Activate' }).click();
  }

  async verifyTitle(title: string): Promise<void> {
    await expect(this.page.getByText(title)).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyStatusChip(label: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    await expect(this.page.getByRole('dialog').getByText(label)).toBeVisible(DEFAULT_TIMEOUT);
  }

  async expectSnackbar(text: string | RegExp): Promise<void> {
    await expect(this.page.locator('.notistack-SnackbarContainer').getByText(text)).toBeVisible(DEFAULT_TIMEOUT);
  }
}

export async function expectEmployersPage(page: Page): Promise<EmployersPage> {
  const ep = new EmployersPage(page);
  await ep.waitForTableLoaded();
  return ep;
}
