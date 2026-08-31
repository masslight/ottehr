import { expect, Page } from '@playwright/test';
import { dataTestIds } from './../../../src/constants/data-test-ids';
import { InPersonHeader } from './InPersonHeader';
import { SideMenu } from './SideMenu';

export class SurgicalHistoryPage {
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

  async addSurgery(): Promise<string> {
    await this.#page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryInput).locator('input').click();
    await expect(this.#page.getByRole('listbox')).toBeVisible();
    const firstOption = this.#page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryOption).first();
    const optionValue = await firstOption.innerText();
    await firstOption.click();
    await expect(this.#page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryList)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryList)).toContainText(optionValue);
    return optionValue;
  }
  async removeSurgery(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryList)).toBeVisible();
    await this.#page.getByTestId(dataTestIds.deleteOutlinedIcon).click();
    await expect(this.#page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryList)).not.toBeVisible();
  }
}

export async function expectSurgicalHistoryPage(page: Page): Promise<SurgicalHistoryPage> {
  await page.waitForURL(new RegExp('/in-person/.*/surgical-history'));
  await expect(page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryTitle)).toBeVisible();
  return new SurgicalHistoryPage(page);
}
