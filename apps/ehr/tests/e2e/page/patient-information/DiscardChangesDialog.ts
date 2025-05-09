import { Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export class DiscardChangesDialog {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickDiscardChangesButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
  }

  async clickCancelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.cancelButton).click();
  }

  async clickCloseButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.closeButton).click();
  }
}

export async function expectDiscardChangesDialog(page: Page): Promise<DiscardChangesDialog> {
  await page.getByTestId(dataTestIds.dialog.title).isVisible();
  return new DiscardChangesDialog(page);
}
