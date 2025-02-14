import { expect, Page } from '@playwright/test';
import { SideMenu } from './SideMenu';
import { CssHeader } from './CssHeader';

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
  await expect(page.locator('p').getByText('Hospitalization')).toBeVisible();
  return new HospitalizationPage(page);
}
