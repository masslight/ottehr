import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { CssHeader } from './CssHeader';
import { SideMenu } from './SideMenu';

export class HospitalizationPage {
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

  async clickCompleteIntakeButton(): Promise<void> {
    await this.#page.locator('button:text("Confirmed No Hospitalization AND Complete Intake")').click();
    await this.sideMenu().clickCompleteIntakeButton();
  }
}

export async function expectHospitalizationPage(page: Page): Promise<HospitalizationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/hospitalization'));
  await expect(page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationTitle)).toBeVisible();
  return new HospitalizationPage(page);
}
