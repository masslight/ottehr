import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { EditMedicationCard } from '../EditMedicationCard';
import { InPersonHeader } from '../InPersonHeader';
import { expectOrderMedicationPage, OrderMedicationPage } from '../OrderMedicationPage';
import { Dialog, expectDialog } from '../patient-information/Dialog';
import { SideMenu } from '../SideMenu';

export class InHouseMedicationsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  medicationDetails(): EditMedicationCard {
    return new EditMedicationCard(this.#page);
  }

  async clickOrderButton(): Promise<OrderMedicationPage> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.orderButton).click();
    return expectOrderMedicationPage(this.#page);
  }

  async verifyMedicationPresent(input: {
    medicationName: string;
    dose: string;
    units: string;
    route: string;
    orderedBy?: string;
    givenBy?: string;
    instructions: string;
    status: string;
    reason?: string;
  }): Promise<void> {
    const testIdToTextArray: { testId: string; text: string | undefined }[] = [
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableMedicationCell,
        text: input.medicationName,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableDoseCell,
        text: input.dose + ' ' + input.units,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableRouteCell,
        text: input.route,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableOrderedByCell,
        text: input.orderedBy,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableGivenByCell,
        text: input.givenBy,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableInstructionsCell,
        text: input.instructions,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableStatusCell,
        text: input.status,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTableReasonCell,
        text: input.reason,
      },
    ];
    let matchedLocator = this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.marTableRow);
    for (const testIdToText of testIdToTextArray) {
      if (testIdToText.text) {
        matchedLocator = matchedLocator.filter({
          has: this.#page.getByTestId(testIdToText.testId).filter({ hasText: testIdToText.text }),
        });
        await expect(matchedLocator.first()).toBeVisible();
      }
    }
  }

  async clickMedicationDetailsTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.medicationDetailsTab).click();
  }

  async clickPencilIcon(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.pencilIconButton).click();
  }

  async clickDeleteButton(medicationName: string): Promise<Dialog> {
    await this.#page
      .getByTestId(dataTestIds.inHouseMedicationsPage.marTableRow)
      .filter({
        hasText: medicationName,
      })
      .getByTestId(dataTestIds.inHouseMedicationsPage.deleteButton)
      .click();
    return expectDialog(this.#page);
  }

  async verifyMedicationInMedicationHistoryTable(input: {
    medication: string;
    dose: string;
    units: string;
    type: string;
    whoAdded: string;
  }): Promise<void> {
    const testIdToTextArray: { testId: string; text: string | undefined }[] = [
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableMedication,
        text: input.medication + ' ' + '(' + input.dose + ' ' + input.units + ')',
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableType,
        text: input.type,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableWhoAdded,
        text: input.whoAdded,
      },
    ];
    let matchedLocator = this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.medicationHistoryTableRow);
    for (const testIdToText of testIdToTextArray) {
      if (testIdToText.text) {
        matchedLocator = matchedLocator.filter({
          has: this.#page.getByTestId(testIdToText.testId).filter({ hasText: testIdToText.text }),
        });
        await expect(matchedLocator.first()).toBeVisible();
      }
    }
  }
}

export async function expectInHouseMedicationsPage(page: Page): Promise<InHouseMedicationsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-medication/mar'));
  await expect(page.getByTestId(dataTestIds.inHouseMedicationsPage.title)).toBeVisible();
  return new InHouseMedicationsPage(page);
}
