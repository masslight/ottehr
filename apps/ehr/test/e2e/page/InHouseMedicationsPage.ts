import { expect, Page } from '@playwright/test';
import { SideMenu } from './SideMenu';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { CssHeader } from './CssHeader';
import { expectOrderMedicationPage, OrderMedicationPage } from './OrderMedicationPage';

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

  async clickOrderButton(): Promise<OrderMedicationPage> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.orderButton).click();
    return expectOrderMedicationPage(this.#page);
  }

}

export async function expectInHouseMedicationsPage(page: Page): Promise<InHouseMedicationsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-medication/mar'));
  await expect(page.getByTestId(dataTestIds.inHouseMedicationsPage.title)).toBeVisible();
  return new InHouseMedicationsPage(page);
}
