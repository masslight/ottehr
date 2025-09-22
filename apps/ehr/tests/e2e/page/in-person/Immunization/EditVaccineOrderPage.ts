import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../../src/constants/data-test-ids';
import { OrderDetailsSection } from './OrderDetailsSection';

export class EditVaccineOrderPage {
  #page: Page;
  #orderDetailsSection: OrderDetailsSection;

  constructor(page: Page) {
    this.#page = page;
    this.#orderDetailsSection = new OrderDetailsSection(this.#page);
  }

  get orderDetailsSection(): OrderDetailsSection {
    return this.#orderDetailsSection;
  }

  async clickConfirmationButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.orderVaccineButton).click();
  }
}

export async function expectEditVaccineOrderPage(appointmentId: string, page: Page): Promise<EditVaccineOrderPage> {
  await page.waitForURL(new RegExp(`/in-person/${appointmentId}/immunization/*`));
  await expect(page.getByTestId(dataTestIds.orderVaccinePage.title)).toBeVisible();
  return new EditVaccineOrderPage(page);
}

export async function openCreateVaccineOrderPage(appointmentId: string, page: Page): Promise<EditVaccineOrderPage> {
  await page.goto(`/in-person/${appointmentId}/immunization/order`);
  return expectEditVaccineOrderPage(appointmentId, page);
}
