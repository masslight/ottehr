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

  async fillChiefComplaints(): Promise<void> {
    const textField = this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes);
    await expect(textField).toBeVisible();
    await textField.locator('textarea').first().fill('The patient reports having a cough for 3 days.');
  }
}

export async function expectPatientInfoPage(page: Page): Promise<PatientInfoPage> {
  const patientInfoPath = new RegExp(`/in-person/.*/cc-and-intake-notes`);

  try {
    await page.waitForURL(patientInfoPath, { timeout: 5000 });
  } catch {
    await page.getByTestId(dataTestIds.sideMenu.sideMenuItem('cc-and-intake-notes')).click();
    await page.waitForURL(patientInfoPath, { timeout: 10000 });
  }
  await expect(
    page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')
  ).toBeEnabled();
  await page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input').setChecked(true);
  await expect(
    page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input')
  ).toBeEnabled();
  return new PatientInfoPage(page);
}
