import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class PatientRecordPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickSeeAllPatientInfoButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientRecordPage.seeAllPatientInfoButton).click();
  }
}

export async function expectPatientRecordPage(patientId: string, page: Page): Promise<PatientRecordPage> {
  await page.waitForURL(new RegExp(`/patient/${patientId}`));
  return new PatientRecordPage(page);
}
