import { expect, Page } from '@playwright/test';
import { SideMenu } from './SideMenu';
import { CssHeader } from './CssHeader';
import { dataTestIds } from '../../../src/constants/data-test-ids';

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
  }
}

export async function expectHospitalizationPage(page: Page): Promise<HospitalizationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/hospitalization'));
  await expect(page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationTitle)).toBeVisible();
  return new HospitalizationPage(page);
}
