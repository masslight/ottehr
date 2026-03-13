import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { expectMarTab, MarTab } from './MarTab';
import { expectVaccineDetailsTab, VaccineDetailsTab } from './VaccineDetailsTab';

export class ImmunizationPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickVaccineDetailsTab(): Promise<VaccineDetailsTab> {
    await this.#page.getByTestId(dataTestIds.immunizationPage.vaccineDetailsTab).click();
    return expectVaccineDetailsTab(this.#page);
  }

  async clickMarTab(): Promise<MarTab> {
    await this.#page.getByTestId(dataTestIds.immunizationPage.marTab).click();
    return expectMarTab(this.#page);
  }
}

export async function expectImmunizationPage(page: Page): Promise<ImmunizationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/immunization/*'));
  await expect(page.getByTestId(dataTestIds.immunizationPage.title)).toBeVisible({ timeout: 60000 });
  return new ImmunizationPage(page);
}

export async function openImmunizationPage(appointmentId: string, page: Page): Promise<ImmunizationPage> {
  await page.goto(`/in-person/${appointmentId}/immunization/mar`, { timeout: 60000 });
  return expectImmunizationPage(page);
}
