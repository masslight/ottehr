import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { CssHeader } from './CssHeader';
import { EditMedicationCard } from './EditMedicationCard';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './InHouseMedicationsPage';
import { SideMenu } from './SideMenu';

export class OrderMedicationPage {
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

  editMedicationCard(): EditMedicationCard {
    return new EditMedicationCard(this.#page);
  }

  async verifyFillOrderToSaveButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderMedicationPage.fillOrderToSaveButton)).toBeDisabled();
  }

  async clickOrderMedicationButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderMedicationPage.fillOrderToSaveButton).click();
  }

  async clickBackButton(): Promise<InHouseMedicationsPage> {
    await this.#page.getByTestId(dataTestIds.orderMedicationPage.backButton).click();
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
