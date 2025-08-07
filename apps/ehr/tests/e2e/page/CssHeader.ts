import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class CssHeader {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyStatus(status: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.cssHeader.appointmentStatus)).toHaveText(status, {
      timeout: 30000,
    });
  }

  async changeStatus(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.cssHeader.appointmentStatus).click();
    await this.#page.getByRole('option', { name: status, exact: true }).click();
    await this.verifyStatus(status);
  }

  async clickSwitchModeButton(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.cssHeader.switchModeButton(status)).click();
  }

  async selectIntakePractitioner(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.cssHeader.intakePractitionerInput).click();
    await this.#page.getByRole('option').first().waitFor();
    await this.#page.getByRole('option').first().click();
    await expect(this.#page.getByTestId(dataTestIds.cssHeader.intakePractitionerInput).locator('input')).toBeEnabled();
  }

  async selectProviderPractitioner(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.cssHeader.providerPractitionerInput).click();
    await this.#page.getByRole('option').first().waitFor();
    await this.#page.getByRole('option').first().click();
    await expect(
      this.#page.getByTestId(dataTestIds.cssHeader.providerPractitionerInput).locator('input')
    ).toBeEnabled();
  }
}
