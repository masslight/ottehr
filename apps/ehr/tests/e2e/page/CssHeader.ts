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
    await this.#page.getByText(status, { exact: true }).click();
  }

  async clickSwitchStatusButton(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.cssHeader.switchStatusButton(status)).click();
  }
}
