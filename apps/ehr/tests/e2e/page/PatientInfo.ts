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
  await page.waitForURL(new RegExp(`/in-person/.*/cc-and-intake-notes`), { timeout: 10000 });
  const checkbox = page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input');
  // toPass retries the whole sequence: chart-data loading can briefly re-disable the checkbox mid-click.
  await expect(async () => {
    await expect(checkbox).toBeEnabled();
    await checkbox.check({ timeout: 3000 });
    await expect(checkbox).toBeChecked();
  }).toPass({ timeout: 15000 });
  return new PatientInfoPage(page);
}
