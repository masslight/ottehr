import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { CollectSamplePage } from './CollectSamplePage';
import { CssHeader } from './CssHeader';
import { SideMenu } from './SideMenu';

export class OrderInHouseLabPage {
  #page: Page;
  #collectSamplePage: CollectSamplePage;

  constructor(page: Page) {
    this.#page = page;
    this.#collectSamplePage = new CollectSamplePage(this.#page);
  }
  cssHeader(): CssHeader {
    return new CssHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  get collectSamplePage(): CollectSamplePage {
    return this.#collectSamplePage;
  }
  async verifyOrderInHouseLabButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderInHouseLabButton)).toBeDisabled();
  }
  async verifyOrderAndPrintLabeButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton)).toBeDisabled();
  }
  async verifyOrderInHouseLabButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderInHouseLabButton)).toBeEnabled();
  }
  async verifyOrderAndPrintLabelButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton)).toBeEnabled();
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
  async verifyCPTCode(CPTCode: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.CPTCodeField).locator('input')).toHaveValue(
      CPTCode
    );
  }
}

export async function expectOrderInHouseLabPage(page: Page): Promise<OrderInHouseLabPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders/create'));
  return new OrderInHouseLabPage(page);
}

export async function expectOrderDetailsPage(page: Page): Promise<OrderInHouseLabPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders/.*/order-details'));
  return new OrderInHouseLabPage(page);
}
