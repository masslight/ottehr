import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class FinalResultPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyStatus(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.finalResultPage.dateAndStatus).waitFor();
    await expect(this.#page.getByTestId(dataTestIds.finalResultPage.dateAndStatus)).toContainText(status);
  }
  async verifyResultsPDFButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.finalResultPage.resultsPDF)).toBeEnabled();
  }
  async verifyResultsPdfOpensInNewTab(): Promise<void> {
    // Patch window.open to capture the URL
    await this.#page.evaluate(() => {
      const original = window.open;
      (window as any).lastOpenUrl = '';
      window.open = new Proxy(original, {
        apply(target, thisArg, argArray: unknown[]) {
          try {
            (window as any).lastOpenUrl = String(argArray?.[0] ?? '');
          } catch (e) {
            console.warn('Failed to capture open URL', e);
          }
          return target.apply(thisArg, argArray as any);
        },
      });
    });

    const [popup] = await Promise.all([
      this.#page.waitForEvent('popup').catch(() => null),
      this.#page.getByTestId(dataTestIds.finalResultPage.resultsPDF).click(),
    ]);
    expect(popup).toBeTruthy();

    const openedUrl = await this.#page.evaluate(() => (window as any).lastOpenUrl || '');
    expect(openedUrl).not.toEqual('');
    const formattedUrl = openedUrl.split(/[?#]/)[0];
    expect(formattedUrl.toLowerCase()).toMatch(/\.pdf$/);
  }
  async verifyTestResult(result: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.performTestPage.testResult(result))).toBeChecked();
  }
}
