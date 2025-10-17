import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export class Dialog {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyMessage(message: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.dialog.message)).toHaveText(message);
  }

  async verifyTitle(title: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.dialog.title)).toHaveText(title);
  }

  async clickProceedButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
  }

  async clickCancelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.cancelButton).click();
  }

  async clickCloseButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.closeButton).click();
  }
}

export async function expectDialog(page: Page): Promise<Dialog> {
  await page.getByTestId(dataTestIds.dialog.title).isVisible();
  return new Dialog(page);
}
