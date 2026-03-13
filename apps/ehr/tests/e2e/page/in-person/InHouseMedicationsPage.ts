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
        testId: dataTestIds.inHouseMedicationsPage.marTable.medicationCell,
        text: input.medicationName,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTable.doseCell,
        text: input.dose + ' ' + input.units,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTable.routeCell,
        text: input.route,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTable.orderedByCell,
        text: input.orderedBy,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTable.givenByCell,
        text: input.givenBy,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTable.instructionsCell,
        text: input.instructions,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTable.statusCell,
        text: input.status,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.marTable.reasonCell,
        text: input.reason,
      },
    ];
    let matchedLocator = this.#page.locator(
      `[data-testid^="${dataTestIds.inHouseMedicationsPage.marTable.medicationRowPrefix}"]`
    );
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

  async clickMarTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.marTab).click();
  }

  async clickPencilIcon(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.pencilIconButton).click();
  }

  async clickDeleteButton(medicationName: string): Promise<Dialog> {
    await this.#page
      .locator(`[data-testid^="${dataTestIds.inHouseMedicationsPage.marTable.medicationRowPrefix}"]`)
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
