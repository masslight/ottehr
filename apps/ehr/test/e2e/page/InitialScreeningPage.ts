import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class InitialScreeningPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async checkStatus(appointmentStatus: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.appointmentStatus)).toHaveText(appointmentStatus);
  }
}

export async function expectInitialScreeningPage(patientName: string, page: Page): Promise<InitialScreeningPage> {
  await page.waitForURL(new RegExp('/in-person/.*/patient-info'));
  await expect(page.getByTestId(dataTestIds.cssHeader.patientName)).toHaveText(patientName);
  return new InitialScreeningPage(page);
}
