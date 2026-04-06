import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  configBundleHeaderRowTitleTestId,
  configBundleRowTestId,
  configBundleTableTestId,
} from 'src/features/external-labs/utils/test-ids';
import { ExternalLabsStatus } from 'utils';
import { CreateExternalLabPage } from './CreateExternalLabPage';

const tableTestIds = dataTestIds.externalLabs.labsTable;

export class ExternalLabsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  static async isOpen(page: Page): Promise<ExternalLabsPage> {
    await page.waitForURL(new RegExp('/in-person/.*/external-lab-orders'));

    const externalLabsPageContainer = page.getByTestId(tableTestIds.patientChartExternalLabsPage);
    await externalLabsPageContainer.waitFor({ state: 'visible' });

    return new ExternalLabsPage(page);
  }

  async clickOrderButton(): Promise<CreateExternalLabPage> {
    await this.#page.getByTestId(tableTestIds.addExternalLabBtn).click();
    return CreateExternalLabPage.isOpen(this.#page);
  }

  async confirmTestWithOutResultsIsPresent(input: {
    fillerLabName: string;
    testName: string;
    status: ExternalLabsStatus;
    submitBtnDisplay: 'disabled';
  }): Promise<Locator> {
    const { fillerLabName, testName, status, submitBtnDisplay } = input;
    const bundleContainer = this.#page.getByTestId(configBundleTableTestId(fillerLabName));
    const header = bundleContainer.getByTestId(configBundleHeaderRowTitleTestId(fillerLabName));

    // confirm header is correct
    await expect(header, `Confirming bundle exists with the title ${fillerLabName}`).toHaveText(fillerLabName);

    if (submitBtnDisplay === 'disabled') {
      const submitBtn = bundleContainer.getByTestId(tableTestIds.bundleRowSubmitBtn);
      await expect(submitBtn, 'Confirming submit button is disabled').toBeDisabled();
    }

    // confirm test is in the bundleContainer
    const testRow = bundleContainer.getByTestId(configBundleRowTestId(testName));
    const testNameCell = testRow.getByTestId(tableTestIds.bundleRowCellTestType);
    await expect(testNameCell, `Confirming ${testName} is present in the bundle`).toHaveText(testName);

    // confirm status is pending
    const statusChip = testRow.getByTestId(dataTestIds.externalLabs.labsStatusChip);
    await expect(statusChip, `Confirming status is ${status}`).toHaveText(status);

    // confirm delete button is present
    const deleteBtn = testRow.getByTestId(tableTestIds.bundleRowDeleteBtn);
    await expect(deleteBtn, `Confirming delete button is visible`).toBeVisible();

    return testRow;
  }
}
