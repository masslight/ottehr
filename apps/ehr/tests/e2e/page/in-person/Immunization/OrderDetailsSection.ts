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
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.dose).click();
    await this.#page.getByText(dose, { exact: true }).click();
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
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.instructions).click();
    await this.#page.getByText(instructions, { exact: true }).click();
  }

  async verifyInstructions(instructions: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.instructions).locator('input')).toHaveValue(
      instructions
    );
  }
}
