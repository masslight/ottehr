import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { InPersonHeader } from './InPersonHeader';
import { SideMenu } from './SideMenu';

export class PatientInfoPage {
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
}

export async function expectPatientInfoPage(appointmentId: string, page: Page): Promise<PatientInfoPage> {
  await page.waitForURL(new RegExp(`/in-person/${appointmentId}/patient-info`), { timeout: 10000 });
  await expect(
    page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')
  ).toBeEnabled();
  await page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input').setChecked(true);
  await expect(
    page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')
  ).toBeEnabled();
  return new PatientInfoPage(page);
}
