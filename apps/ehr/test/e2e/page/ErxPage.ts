import { expect, Page } from '@playwright/test';
import { SideMenu } from './SideMenu';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class eRXPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async clickNewOrderButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.eRXPage.newOrderButton).click();
  }
}

export async function expectErxPage(page: Page): Promise<ErxPage> {
  await page.waitForURL(new RegExp('/in-person/.*/erx'));
  await expect(page.getByTestId(dataTestIds.eRXPage.erxTitle)).toBeVisible();
  return new ErxPage(page);
}
