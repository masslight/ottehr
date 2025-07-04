import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export abstract class BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickDischargeButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.progressNotePage.dischargeButton).click();
  }

  async clickReviewAndSignButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton).click();
  }

  async verifyReviewAndSignButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton)).toBeDisabled();
  }

  async clickSignButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
  }

  abstract expectLoaded(): Promise<void>;
}
