import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { CollectSamplePage } from './CollectSamplePage';
import { InPersonHeader } from './InPersonHeader';
import { SideMenu } from './SideMenu';

export class OrderInHouseLabPage {
  #page: Page;
  #collectSamplePage: CollectSamplePage;

  constructor(page: Page) {
    this.#page = page;
    this.#collectSamplePage = new CollectSamplePage(this.#page);
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
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
  async selectTestType(): Promise<string> {
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.testTypeField).click();
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.testTypeList).waitFor({ state: 'visible' });
    const firstOption = this.#page.getByTestId(dataTestIds.orderInHouseLabPage.testTypeList).locator('li').first();
    const optionValue = await firstOption.innerText();
    await firstOption.click();
    return optionValue;
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
