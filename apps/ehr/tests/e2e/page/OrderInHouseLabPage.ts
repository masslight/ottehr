import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { CssHeader } from './CssHeader';
import { SideMenu } from './SideMenu';

export class OrderInHouseLabPage {
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
  async verifyOrderInHouseLabButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderInHouseLabButton)).toBeDisabled();
  }
  async verifyOrderAndPrintLabeButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton)).toBeDisabled();
  }
  async clickOrderInHouseLabButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderInHouseLabButton).click();
  }
  async clickOrderAndPrintLabelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton).click();
  }
  async selectTestType(testType: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.testTypeField).click();
    await this.#page.getByText(testType).waitFor({ state: 'visible' });
    await this.#page.getByText(testType, { exact: true }).click();
  }
}

export async function expectOrderInHouseLabPage(page: Page): Promise<OrderInHouseLabPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders/create'));
  return new OrderInHouseLabPage(page);
}
