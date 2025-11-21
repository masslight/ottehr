import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class CollectSamplePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyMarkAsCollectedButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.collectSamplePage.markCollectedButton)).toBeDisabled();
  }
  async verifyMarkAsCollectedButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.collectSamplePage.markCollectedButton)).toBeEnabled();
  }
  async clickMarkAsCollected(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.collectSamplePage.markCollectedButton).click();
  }
  async fillSource(source: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.collectSamplePage.source).locator('input').fill(source);
  }
  async verifyStatus(status: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.collectSamplePage.status)).toHaveText(status);
  }
  async verifyTestName(testName: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.collectSamplePage.testName)).toHaveText(testName);
  }
}
