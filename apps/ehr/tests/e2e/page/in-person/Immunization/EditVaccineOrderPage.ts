import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../../src/constants/data-test-ids';
import { OrderSentencesSection } from './OrderSentencesSection';

export class EditVaccineOrderPage {
  #page: Page;
  #orderDetailsSection: OrderSentencesSection;

  constructor(page: Page) {
    this.#page = page;
    this.#orderDetailsSection = new OrderSentencesSection(this.#page);
  }

  get orderDetailsSection(): OrderSentencesSection {
    return this.#orderDetailsSection;
  }

  async clickConfirmationButton(): Promise<void> {
    const buttonLocator = this.#page.getByTestId(dataTestIds.orderVaccinePage.orderVaccineButton);
    await buttonLocator.click();
    await expect(buttonLocator).toBeDisabled();
    await this.#page.waitForURL(new RegExp('/in-person/.*/immunization/mar'), { timeout: 30000 });
  }
}

export async function expectCreateVaccineOrderPage(page: Page): Promise<EditVaccineOrderPage> {
  await page.waitForURL(new RegExp(`/in-person/.*/immunization/order`));
  await expect(page.getByTestId(dataTestIds.orderVaccinePage.title)).toBeVisible({ timeout: 60000 });
  return new EditVaccineOrderPage(page);
}

export async function expectEditVaccineOrderPage(page: Page): Promise<EditVaccineOrderPage> {
  await page.waitForURL(new RegExp(`/in-person/.*/immunization/.*`));
  await expect(page.getByTestId(dataTestIds.orderVaccinePage.title)).toBeVisible({ timeout: 60000 });
  return new EditVaccineOrderPage(page);
}

export async function openCreateVaccineOrderPage(appointmentId: string, page: Page): Promise<EditVaccineOrderPage> {
  await page.goto(`/in-person/${appointmentId}/immunization/order`, { timeout: 60000 });
  return expectEditVaccineOrderPage(page);
}
