import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { getServiceRequestIdFromPageUrl } from './lab/in-house/helpers';
import { RadioSelectionResult, selectableOption } from './lab/types';

const PAGE_TITLE = 'Perform Test & Enter Results';

export class PerformTestPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  get page(): Page {
    return this.#page;
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

  async selectRadioTestResult(testName: string): Promise<RadioSelectionResult> {
    const resultTestIdPrefix = dataTestIds.performTestPage.testResult();
    const radioOptions = this.#page.locator(`[data-testid^="${resultTestIdPrefix}"]`);

    // confirm there are results entry options
    const count = await radioOptions.count();
    expect(count, `${count} radio options are available to be selected`).toBeGreaterThan(0);

    const availableValues: selectableOption[] = [];
    let selectedValue: selectableOption | undefined;

    for (let i = 0; i < count; i++) {
      const option = radioOptions.nth(i);

      const value = await option.getAttribute('data-testid');
      const display = (await option.textContent())?.trim();

      if (value && display) {
        const selectableOptionConfig = { testId: value, display };
        availableValues.push(selectableOptionConfig);
        if (i === 0) {
          // store as selected option
          selectedValue = selectableOptionConfig;
        }
      }
    }

    if (!selectedValue) {
      throw new Error(`no value was assigned for selection in selectRadioTestResult for inhouse labs`);
    }

    const serviceRequestID = getServiceRequestIdFromPageUrl(this.#page);

    const testDetails = {
      testName,
      testServiceRequestId: serviceRequestID,
      availableValues,
      selectedValue,
    };

    await this.#page.getByTestId(testDetails.selectedValue.testId).click();

    return testDetails;
  }

  async submitOrderResult(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.performTestPage.submitButton).click();
  }
}
