import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { SideMenu } from './SideMenu';
import { CssHeader } from './CssHeader';

export class PatientInfoPage {
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
}

export async function expectPatientInfoPage(patientName: string, page: Page): Promise<PatientInfoPage> {
  await page.waitForURL(new RegExp('/in-person/.*/patient-info'));
  await expect(page.getByTestId(dataTestIds.cssHeader.patientName)).toHaveText(patientName);
  await expect(page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')).toBeChecked({
    checked: false, //
    timeout: 30000,
  });
  return new PatientInfoPage(page);
}
