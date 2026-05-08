import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

export class OrderDetailsSection {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async selectVaccine(vaccine: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.vaccine).click();
    await this.#page.getByText(vaccine, { exact: true }).click();
  }

  async verifyVaccine(vaccine: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.vaccine).locator('input')).toHaveValue(vaccine);
  }

  async enterDose(dose: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.dose).locator('input').locator('visible=true').fill(dose);
  }

  async verifyDose(dose: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.dose).locator('input')).toHaveValue(dose);
  }

  async selectUnits(units: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.units).click();
    await this.#page.getByText(units, { exact: true }).click();
  }

  async verifyUnits(units: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.units).locator('input')).toHaveValue(units);
  }

  async selectRoute(route: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.route).click();
    await this.#page.getByText(route, { exact: true }).click();
  }

  async verifyRoute(route: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.route).locator('input')).toHaveValue(route);
  }

  async selectLocation(location: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.location).click();
    await this.#page.getByText(location, { exact: true }).click();
  }

  async verifyLocation(location: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.location).locator('input')).toHaveValue(location);
  }

  async enterInstructions(instructions: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.orderVaccinePage.instructions)
      .locator('textarea')
      .locator('visible=true')
      .fill(instructions);
  }

  async verifyInstructions(instructions: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.orderVaccinePage.instructions).locator('textarea').locator('visible=true')
    ).toHaveValue(instructions);
  }

  async verifyOrderedBy(orderedBy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.orderedBy).locator('input')).toHaveValue(
      orderedBy
    );
  }

  async selectAssociatedDx(dxSearchText: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.associatedDx).click();
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.associatedDx).locator('input').fill(dxSearchText);
    await this.#page.getByRole('option').filter({ hasText: dxSearchText }).first().waitFor();
    await this.#page.getByRole('option').filter({ hasText: dxSearchText }).first().click();
  }

  async verifyAssociatedDx(dxText: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.associatedDx).locator('input')).toHaveValue(
      new RegExp(dxText, 'i')
    );
  }

  async enterManufacturer(manufacturer: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.manufacturer).locator('input').fill(manufacturer);
  }

  async verifyManufacturer(manufacturer: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.manufacturer).locator('input')).toHaveValue(
      manufacturer
    );
  }
}
