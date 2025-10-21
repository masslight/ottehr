import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { InPersonHeader } from '../InPersonHeader';
import { expectOrderInHouseLabPage, OrderInHouseLabPage } from '../OrderInHouseLabPage';
import { SideMenu } from '../SideMenu';

export class InHouseLabsPage {
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

  async clickOrderButton(): Promise<OrderInHouseLabPage> {
    await this.#page.getByTestId(dataTestIds.inHouseLabsPage.orderButton).click();
    return expectOrderInHouseLabPage(this.#page);
  }

  async clickDeleteButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.deleteOutlinedIcon).click();
  }
}

export async function expectInHouseLabsPage(page: Page): Promise<InHouseLabsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders'));
  await expect(page.getByTestId(dataTestIds.inHouseLabsPage.title)).toBeVisible();
  return new InHouseLabsPage(page);
}
