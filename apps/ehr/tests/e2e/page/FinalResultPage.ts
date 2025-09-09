import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class FinalResultPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyStatus(status: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.finalResultPage.dateAndStatus)).toContainText(status);
  }
  async verifyResultsPDFButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.finalResultPage.resultsPDF)).toBeEnabled();
  }
  async verifyResultsPdfOpensInNewTab(): Promise<void> {
    const pdfResponsePromise = this.#page.context().waitForEvent('response', {
      timeout: 15_000,
      predicate: (r) => {
        const ct = (r.headers()['content-type'] ?? '').toLowerCase();
        return r.status() === 200 && ct.includes('application/pdf');
      },
    });

    const [pdfPage] = await Promise.all([
      this.#page.waitForEvent('popup').catch(() => null),
      this.#page.getByTestId(dataTestIds.finalResultPage.resultsPDF).click(),
    ]);

    const pdfResp = await pdfResponsePromise;
    expect(pdfResp.ok()).toBeTruthy();
    if (pdfPage) await pdfPage.close();
  }
  async verifyTestResult(result: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.performTestPage.testResult(result))).toBeChecked();
  }
}
