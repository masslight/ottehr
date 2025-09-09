import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

const PAGE_TITLE = 'Perform Test & Enter Results';

export class PerformTestPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyPerformTestPageOpened(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.performTestPage.title)).toHaveText(PAGE_TITLE);
  }
  async verifyStatus(status: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.performTestPage.status)).toHaveText(status);
  }
  async verifySubmitButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.performTestPage.submitButton)).toBeDisabled();
  }
  async verifySubmitButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.performTestPage.submitButton)).toBeEnabled();
  }
  async clickSubmitButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.performTestPage.submitButton).click();
  }
  async selectTestResult(result: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.performTestPage.testResult(result)).click();
  }
  async submitAndWaitForResults(): Promise<void> {
    await Promise.all([
      this.#page.waitForResponse(
        (resp) => resp.url().includes('/zambda/handle-in-house-lab-results/execute') && resp.status() === 200
      ),
      this.#page.getByTestId(dataTestIds.performTestPage.submitButton).click(),
    ]);
  }
}
