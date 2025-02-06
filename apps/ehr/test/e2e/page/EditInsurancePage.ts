import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
//import { dataTestIds } from '../../../src/constants/data-test-ids';

export class EditInsurancePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async selectPayerName(payerName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.newInsurancePage.payerName).click();
    await this.#page.getByText(payerName).click();
  }

  async clickSaveChangesButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.newInsurancePage.saveChangesButton).click();
  }

  async verifyPageStillOpened(): Promise<void> {
    await this.#page.waitForTimeout(1000);
    await expectEditInsurancePage(this.#page);
  }
}

export async function expectEditInsurancePage(page: Page): Promise<EditInsurancePage> {
  await page.waitForURL(`/telemed-admin/insurances/new`);
  await expect(page.locator('h3').getByText('New')).toBeVisible();
  return new EditInsurancePage(page);
}
