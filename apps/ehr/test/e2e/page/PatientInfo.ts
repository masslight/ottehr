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

export async function expectPatientInfoPage(patientId: string, page: Page): Promise<PatientInfoPage> {
  await page.waitForURL(new RegExp(`/in-person/${patientId}/patient-info`));
  await expect(
    page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')
  ).toBeEnabled();
  await page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input').setChecked(true);
  await expect(
    page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')
  ).toBeDisabled();
  await expect(
    page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')
  ).toBeEnabled();
  return new PatientInfoPage(page);
}
