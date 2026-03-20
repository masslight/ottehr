import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { RadioSelectionResult } from './lab';

export class FinalResultPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyStatus(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.finalResultPage.dateAndStatus).waitFor();
    await expect(
      this.#page.getByTestId(dataTestIds.finalResultPage.dateAndStatus),
      `${status} status is present`
    ).toContainText(status);
  }

  async verifyResultsPDFButtonEnabled(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.finalResultPage.resultsPDF),
      'result pdf button is present'
    ).toBeEnabled();
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

  async verifyTestResult(resultTestId: string): Promise<void> {
    await expect(this.#page.getByTestId(resultTestId!), `result with testId ${resultTestId} is selected`).toBeChecked();
  }

  async verifyEditResultFunctionality(testDetails: RadioSelectionResult): Promise<void> {
    const originalResultTestId = testDetails.selectedValue.testId;

    // save button should be hidden
    await this.findSaveChangesButtonAndClickIfVisible(false, testDetails);

    // click a different result
    await this.selectNewRadioEntry(testDetails);

    // confirm save button is present & click
    await this.findSaveChangesButtonAndClickIfVisible(true, testDetails);

    // confirm that the result is different and selected
    await this.findSaveChangesButtonAndClickIfVisible(false, testDetails);
    expect(originalResultTestId, `verify new result value is saved`).not.toBe(testDetails.selectedValue.testId);
    await this.verifyTestResult(testDetails.selectedValue.testId);
  }

  async findSaveChangesButtonAndClickIfVisible(isVisible: boolean, testDetails: RadioSelectionResult): Promise<void> {
    const submitButton = this.#page.getByTestId(dataTestIds.performTestPage.submitButton);

    if (isVisible) {
      await expect(submitButton, 'submit button is visible').toBeVisible();
      await expect(submitButton, 'verify submit button is labeled as Save Changes').toHaveText('Save changes');
      await submitButton.click();
      await submitButton.isDisabled();

      // wait for loading to start
      const loader = this.#page.getByTestId(dataTestIds.orderInHouseLabPage.loading);
      await expect(loader).toBeVisible();

      // loading should be done and the test name visible again
      await this.#page.getByTestId(dataTestIds.finalResultPage.testName).waitFor();
      const testName = this.#page.getByTestId(dataTestIds.finalResultPage.testName);
      await expect(testName, `page reloaded, test name ${testDetails.testName} is visible`).toContainText(
        testDetails.testName
      );
    } else {
      await expect(submitButton, 'submit button is hidden').toHaveCount(0);
    }
  }

  async selectNewRadioEntry(testDetails: RadioSelectionResult): Promise<RadioSelectionResult> {
    const newSelection = testDetails.availableValues.find(
      (option) => option.testId !== testDetails.selectedValue.testId
    );

    if (!newSelection) throw new Error(`Could not select a new result entry, no new selection value`);

    await this.#page.getByTestId(newSelection.testId).click();

    testDetails.selectedValue = newSelection;

    return testDetails;
  }
}
