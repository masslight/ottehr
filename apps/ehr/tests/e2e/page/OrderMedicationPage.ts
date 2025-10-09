import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { EditMedicationCard } from './EditMedicationCard';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './in-person/InHouseMedicationsPage';
import { InPersonHeader } from './InPersonHeader';
import { SideMenu } from './SideMenu';

export class OrderMedicationPage {
  #page: Page;
  #editMedicationCard: EditMedicationCard;

  constructor(page: Page) {
    this.#page = page;
    this.#editMedicationCard = new EditMedicationCard(this.#page);
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  get editMedicationCard(): EditMedicationCard {
    return this.#editMedicationCard;
  }

  async verifyFillOrderToSaveButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderMedicationPage.fillOrderToSaveButton)).toBeDisabled();
  }

  async clickOrderMedicationButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderMedicationPage.fillOrderToSaveButton).click();
  }

  async clickBackButton(): Promise<InHouseMedicationsPage> {
    await this.#page.getByTestId(dataTestIds.orderMedicationPage.backButton).click();
    const dialog = this.#page.getByTestId(dataTestIds.inPersonModal.confirmationDialogue);
    await dialog.waitFor({ state: 'visible', timeout: 500 }).catch(() => null);
    if (await dialog.isVisible()) {
      await this.#page.getByTestId(dataTestIds.dialog.cancelButton).click();
    }
    return expectInHouseMedicationsPage(this.#page);
  }
}

export async function expectOrderMedicationPage(page: Page): Promise<OrderMedicationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-medication/order/new'));
  return new OrderMedicationPage(page);
}

export async function expectEditOrderPage(page: Page): Promise<OrderMedicationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-medication/order/edit/.*'));
  return new OrderMedicationPage(page);
}
