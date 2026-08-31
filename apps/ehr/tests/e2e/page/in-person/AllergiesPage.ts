import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { InPersonHeader } from '../InPersonHeader';
import { SideMenu } from '../SideMenu';

export class AllergiesPage {
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

  async addAllergy(allergy: string): Promise<void> {
    const input = await this.#page.getByTestId(dataTestIds.allergies.knownAllergiesInput).locator('input');
    await input.fill(allergy);
    await expect(this.#page.getByRole('listbox')).toBeVisible();
    await this.#page.getByRole('option', { name: allergy, exact: true }).click();
    await expect(this.#page.getByTestId(dataTestIds.allergies.knownAllergiesList)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.allergies.knownAllergiesList)).toContainText(allergy);
  }

  async checkAddedAllergyIsShownInHeader(allergy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.allergies)).toContainText(allergy);
  }

  async removeAllergy(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.deleteOutlinedIcon).click();
    await expect(this.#page.getByTestId(dataTestIds.allergies.knownAllergiesList)).not.toBeVisible();
  }

  async checkRemovedAllergyIsNotShownInHeader(allergy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.allergies)).not.toContainText(allergy);
  }
}

export async function expectAllergiesPage(page: Page): Promise<AllergiesPage> {
  await page.waitForURL(new RegExp('/in-person/.*/allergies'));
  await expect(page.getByTestId(dataTestIds.allergies.allergiesPageTitle)).toBeVisible();
  return new AllergiesPage(page);
}
