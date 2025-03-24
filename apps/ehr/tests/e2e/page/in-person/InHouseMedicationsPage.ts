import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { CssHeader } from '../CssHeader';
import { EditMedicationCard } from '../EditMedicationCard';
import { expectOrderMedicationPage, OrderMedicationPage } from '../OrderMedicationPage';
import { SideMenu } from '../SideMenu';

export class InHouseMedicationsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  cssHeader(): CssHeader {
    return new CssHeader(this.#page);
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
    route: string;
    instructions: string;
    status: string;
  }): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.inHouseMedicationsPage.marTableRow)
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.inHouseMedicationsPage.marTableMedicationCell)
            .filter({ hasText: input.medicationName }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.inHouseMedicationsPage.marTableDoseCell)
            .filter({ hasText: input.dose }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.inHouseMedicationsPage.marTableRouteCell)
            .filter({ hasText: input.route }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.inHouseMedicationsPage.marTableInstructionsCell)
            .filter({ hasText: input.instructions }),
        })
        .filter({
          has: this.#page
            .getByTestId(dataTestIds.inHouseMedicationsPage.marTableStatusCell)
            .filter({ hasText: input.status }),
        })
    ).toBeVisible();
  }

  async clickMedicationDetailsTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.medicationDetailsTab).click();
  }

  async clickPencilIcon(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.pencilIconButton).click();
  }
}

export async function expectInHouseMedicationsPage(page: Page): Promise<InHouseMedicationsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-medication/mar'));
  await expect(page.getByTestId(dataTestIds.inHouseMedicationsPage.title)).toBeVisible();
  return new InHouseMedicationsPage(page);
}
