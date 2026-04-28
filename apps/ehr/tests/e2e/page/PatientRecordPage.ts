import { expect, Page } from '@playwright/test';
import { configBundleRowTestId } from 'src/features/external-labs/utils/test-ids';
import { ExternalLabsStatus } from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class PatientRecordPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickSeeAllPatientInfoButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientRecordPage.seeAllPatientInfoButton).click();
  }

  async clickLabsTableTab(): Promise<void> {
    const labsTab = this.#page.getByTestId(dataTestIds.externalLabs.patientRecordLabsTab);

    await expect(labsTab).toBeVisible();
    await labsTab.click();
  }

  async confirmPatientRecordLab(input: {
    testName: string;
    status: ExternalLabsStatus;
    navToLabDetailPage: boolean;
  }): Promise<void> {
    const { testName, status, navToLabDetailPage } = input;
    const tableTestIds = dataTestIds.externalLabs.labsTable;

    // confirm test is in the table
    const patientRecordLabsTable = this.#page.getByTestId(tableTestIds.patientRecordExternalLabsPage);
    const testRow = patientRecordLabsTable.getByTestId(configBundleRowTestId(testName));
    const testNameCell = testRow.getByTestId(tableTestIds.bundleRowCellTestType);
    await expect(testNameCell, `Confirming ${testName} is present in the table`).toHaveText(testName);

    // confirm status
    const statusChip = testRow.getByTestId(dataTestIds.externalLabs.labsStatusChip);
    await expect(statusChip, `Confirming status is ${status}`).toHaveText(status);

    // confirm delete button is NOT present
    const deleteBtn = testRow.getByTestId(tableTestIds.bundleRowDeleteBtn);
    await expect(deleteBtn, `Confirming there is no delete button`).toHaveCount(0);

    if (navToLabDetailPage) {
      await testRow.click();
      const detailPageContainer = this.#page.getByTestId(dataTestIds.externalLabs.detailsPg.pageContainer);
      await expect(detailPageContainer, `Confirming that we have navigated to the labs detail page`).toBeVisible();
    }
  }
}

export async function expectPatientRecordPage(patientId: string, page: Page): Promise<PatientRecordPage> {
  await page.waitForURL(new RegExp(`/patient/${patientId}`));
  return new PatientRecordPage(page);
}
