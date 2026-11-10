import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

// The order form lives both on the standalone create/edit page (one form per page) and on the
// vaccine-details tab, which renders one form per non-cancelled order. To stay unambiguous when
// several orders are present, this section can be scoped to a single order's container (a Locator);
// option lists open in a body-level popper, so those are always resolved against the Page.
type Scope = Page | Locator;

/** Entering and checking an order's details, whichever form shows them (fields here, sentences on the order page). */
export interface OrderDetailsEntry {
  selectVaccine(vaccine: string): Promise<void>;
  verifyVaccine(vaccine: string): Promise<void>;
  enterDose(dose: string): Promise<void>;
  verifyDose(dose: string): Promise<void>;
  selectUnits(units: string): Promise<void>;
  verifyUnits(units: string): Promise<void>;
  selectRoute(route: string): Promise<void>;
  verifyRoute(route: string): Promise<void>;
  selectLocation(location: string): Promise<void>;
  verifyLocation(location: string): Promise<void>;
  enterInstructions(instructions: string): Promise<void>;
  verifyInstructions(instructions: string): Promise<void>;
  verifyOrderedBy(orderedBy: string): Promise<void>;
  selectAssociatedDx(dxSearchText: string): Promise<void>;
  verifyAssociatedDx(dxText: string): Promise<void>;
  enterManufacturer(manufacturer: string): Promise<void>;
  verifyManufacturer(manufacturer: string): Promise<void>;
}

export class OrderDetailsSection implements OrderDetailsEntry {
  #scope: Scope;
  #page: Page;

  constructor(scope: Scope) {
    this.#scope = scope;
    this.#page = 'goto' in scope ? scope : scope.page();
  }

  async selectVaccine(vaccine: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.vaccine).click();
    // Scope to the autocomplete listbox option: the vaccine name can also appear in the MAR table
    // on this page (e.g. orders from earlier tests on a shared appointment), so a plain getByText
    // would match multiple elements and trip strict mode.
    await this.#page.getByRole('option', { name: vaccine, exact: true }).click();
  }

  async verifyVaccine(vaccine: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.vaccine).locator('input')).toHaveValue(vaccine);
  }

  async enterDose(dose: string): Promise<void> {
    await this.#scope
      .getByTestId(dataTestIds.orderVaccinePage.dose)
      .locator('input')
      .locator('visible=true')
      .fill(dose);
  }

  async verifyDose(dose: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.dose).locator('input')).toHaveValue(dose);
  }

  async selectUnits(units: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.units).click();
    await this.#page.getByText(units, { exact: true }).click();
  }

  async verifyUnits(units: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.units).locator('input')).toHaveValue(units);
  }

  async selectRoute(route: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.route).click();
    await this.#page.getByText(route, { exact: true }).click();
  }

  async verifyRoute(route: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.route).locator('input')).toHaveValue(route);
  }

  async selectLocation(location: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.location).click();
    await this.#page.getByText(location, { exact: true }).click();
  }

  async verifyLocation(location: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.location).locator('input')).toHaveValue(location);
  }

  async enterInstructions(instructions: string): Promise<void> {
    await this.#scope
      .getByTestId(dataTestIds.orderVaccinePage.instructions)
      .locator('textarea')
      .locator('visible=true')
      .fill(instructions);
  }

  async verifyInstructions(instructions: string): Promise<void> {
    await expect(
      this.#scope.getByTestId(dataTestIds.orderVaccinePage.instructions).locator('textarea').locator('visible=true')
    ).toHaveValue(instructions);
  }

  async verifyOrderedBy(orderedBy: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.orderedBy).locator('input')).toHaveValue(
      orderedBy
    );
  }

  async selectAssociatedDx(dxSearchText: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.associatedDx).click();
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.associatedDx).locator('input').fill(dxSearchText);
    await this.#page.getByRole('option').filter({ hasText: dxSearchText }).first().waitFor();
    await this.#page.getByRole('option').filter({ hasText: dxSearchText }).first().click();
  }

  async verifyAssociatedDx(dxText: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.associatedDx).locator('input')).toHaveValue(
      new RegExp(dxText, 'i')
    );
  }

  async enterManufacturer(manufacturer: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.manufacturer).locator('input').fill(manufacturer);
  }

  async verifyManufacturer(manufacturer: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.manufacturer).locator('input')).toHaveValue(
      manufacturer
    );
  }
}
