import { expect, Page } from '@playwright/test';
import { dataTestIds } from './../../../src/constants/data-test-ids';
import { InPersonHeader } from './InPersonHeader';
import { SideMenu } from './SideMenu';

export class MedicalConditionsPage {
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
  async addAMedicalCondition(medicalCondition: string): Promise<void> {
    const input = await this.#page.getByTestId(dataTestIds.medicalConditions.medicalConditionsInput).locator('input');
    await input.fill(medicalCondition);
    await expect(this.#page.getByRole('listbox')).toBeVisible();
    await this.#page.getByRole('option', { name: medicalCondition, exact: false }).click();
    await expect(this.#page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList)).toContainText(
      medicalCondition
    );
  }
  async removeMedicalCondition(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList)).toBeVisible();
    await this.#page.getByTestId(dataTestIds.deleteOutlinedIcon).click();
    await expect(this.#page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList)).not.toBeVisible();
  }
}

export async function expectMedicalConditionsPage(page: Page): Promise<MedicalConditionsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/medical-conditions'));
  await expect(page.getByTestId(dataTestIds.medicalConditions.medicalConditionsPageTitle)).toBeVisible();
  return new MedicalConditionsPage(page);
}
