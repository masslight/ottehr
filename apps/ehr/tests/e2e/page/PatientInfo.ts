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
  const verifiedCheckbox = page.getByTestId(dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox).locator('input');
  // The checkbox becomes enabled before the chart query backing it settles, so a click can land and
  // then be discarded by the re-render that follows. setChecked clicks exactly once and fails outright
  // when the state doesn't change ("Clicking the checkbox did not change its state"), which is how this
  // flakes. Retry the check-and-verify pair instead; check() is a no-op once the box is really checked,
  // so retrying can never toggle it back off.
  await expect(async () => {
    await verifiedCheckbox.check();
    await expect(verifiedCheckbox).toBeChecked();
  }).toPass({ timeout: 35_000 });
  return new PatientInfoPage(page);
}
