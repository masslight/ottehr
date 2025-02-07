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

  async verifyOptionState(input: { option: string; checked: boolean; enabled: boolean }): Promise<void> {
    const locator = expect(
      this.#page.getByTestId(dataTestIds.newInsurancePage.settingsOptionRow(input.option)).locator('input')
    );
    await locator.toBeChecked({
      checked: input.checked,
    });
    await locator.toBeEnabled({
      enabled: input.enabled,
    });
  }

  async enterDisplayName(displayName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.newInsurancePage.displayNameInput).locator('input').fill(displayName);
  }

  async verifySaveInsuranceError(): Promise<void> {
    await this.#page.waitForSelector('text=Error trying to save insurance configuration. Please, try again');
  }
}

export async function expectEditInsurancePage(page: Page): Promise<EditInsurancePage> {
  await page.waitForURL(`/telemed-admin/insurances/new`);
  await expect(page.locator('h3').getByText('New')).toBeVisible();
  return new EditInsurancePage(page);
}
