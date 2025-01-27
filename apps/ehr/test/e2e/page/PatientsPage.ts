import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class PatientsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async searchByName(name: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchNameField).locator('input').fill(name);
  }
}

export async function expectPatientsPage(page: Page): Promise<PatientsPage> {
  await page.waitForURL('/patients');
  await page.locator('p').getByText('Set up search filter and press Search to find patients').isVisible();
  return new PatientsPage(page);
}
