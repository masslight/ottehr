import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { Dialog, expectDialog } from '../../patient-information/Dialog';
import { EditVaccineOrderPage, expectEditVaccineOrderPage } from './EditVaccineOrderPage';

export class MarTab {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyVaccinePresent(input: {
    vaccine: string;
    dose: string;
    units: string;
    route: string;
    instructions: string;
    orderedDate?: string;
    orderedPerson?: string;
    givenDate?: string;
    givenPerson?: string;
    status: string;
    reason?: string;
  }): Promise<void> {
    const testIdToTextArray: { testId: string; text: string | undefined }[] = [
      {
        testId: dataTestIds.immunizationPage.marTableVaccineCell,
        text: input.vaccine,
      },
      {
        testId: dataTestIds.immunizationPage.marTableDoseRouteCell,
        text: input.dose + ' ' + input.units + ' / ' + input.route,
      },
      {
        testId: dataTestIds.immunizationPage.marTableInstructionsCell,
        text: input.instructions,
      },
      {
        testId: dataTestIds.immunizationPage.marTableOrderedDateCell,
        text: input.orderedDate,
      },
      {
        testId: dataTestIds.immunizationPage.marTableOrderedPersonCell,
        text: input.orderedPerson,
      },
      {
        testId: dataTestIds.immunizationPage.marTableGivenDateCell,
        text: input.givenDate,
      },
      {
        testId: dataTestIds.immunizationPage.marTableGivenPersonCell,
        text: input.givenPerson,
      },
      {
        testId: dataTestIds.immunizationPage.marTableStatusCell,
        text: input.status,
      },
      {
        testId: dataTestIds.immunizationPage.marTableReasonCell,
        text: input.reason,
      },
    ];
    let matchedLocator = this.#page.getByTestId(dataTestIds.immunizationPage.marTableRow);
    for (const testIdToText of testIdToTextArray) {
      if (testIdToText.text == null) {
        continue;
      }
      matchedLocator = matchedLocator.filter({
        has: this.#page.getByTestId(testIdToText.testId).filter({ hasText: testIdToText.text }),
      });
      await expect(matchedLocator.first()).toBeVisible();
    }
  }

  async clickEditOrderButton(vaccineName: string): Promise<EditVaccineOrderPage> {
    await this.#page
      .getByTestId(dataTestIds.immunizationPage.marTableRow)
      .filter({
        hasText: vaccineName,
      })
      .getByTestId(dataTestIds.immunizationPage.pencilIconButton)
      .click();
    return expectEditVaccineOrderPage(this.#page);
  }

  async clickDeleteButton(vaccineName: string): Promise<Dialog> {
    await this.#page
      .getByTestId(dataTestIds.immunizationPage.marTableRow)
      .filter({
        hasText: vaccineName,
      })
      .getByTestId(dataTestIds.immunizationPage.deleteButton)
      .click();
    return expectDialog(this.#page);
  }
}

export async function expectMarTab(page: Page): Promise<MarTab> {
  await page.waitForURL(new RegExp(`/in-person/.*/immunization/mar`));
  await expect(page.getByTestId(dataTestIds.immunizationPage.marTab)).toBeVisible();
  return new MarTab(page);
}
