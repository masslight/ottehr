import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class InsurancesPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickNextPage(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.nextPage).click();
  }

  async clickPreviousPage(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.previousPage).click();
  }
  async verifyPaginationState(rows: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.pagination.paginationContainer).locator('p:text("' + rows + '")')
    ).toBeVisible();
  }
  async searchInsurance(text: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.insurancesPage.insuranceSearch).locator('input').fill(text);
  }

  async verifyInsurancePresent(insurance: string): Promise<void> {
    await expect(this.#page.locator('a:text("' + insurance + '")')).toBeVisible();
  }

  async selectStatusFilter(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.insurancesPage.statusDropdown).click();
    await this.#page.locator('li').getByText(status).click();
  }

  async clickAddNewButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.insurancesPage.addNewButton).click();
  }
}

export async function expectInsurancesPage(page: Page): Promise<InsurancesPage> {
  await page.waitForURL(`/telemed-admin/insurances`);
  await expect(page.locator('th').getByText('Display name')).toBeVisible();
  return new InsurancesPage(page);
}
