import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

// The order sentences live both on the create/edit page (one or more lines) and on the vaccine-details tab, which
// renders one card per non-cancelled order. To stay unambiguous when several are present, this section can be scoped
// to one card (a Locator); option lists open in a body-level popper, so those are always resolved against the Page.
type Scope = Page | Locator;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A picked option as the sentence writes it: its first word lower-cased ("intramuscular route"). */
const asWritten = (text: string): RegExp => new RegExp(`^${escapeRegExp(text)}$`, 'i');

/** The order as sentences whose blanks are the fields. */
export class OrderSentencesSection {
  #scope: Scope;
  #page: Page;

  constructor(scope: Scope) {
    this.#scope = scope;
    this.#page = 'goto' in scope ? scope : scope.page();
  }

  async selectVaccine(vaccine: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.vaccine).click();
    await this.#page.getByRole('combobox', { name: 'Immunization' }).fill(vaccine);
    // The menu's right column; a quick pick in the left one may carry the vaccine's name.
    await this.#page
      .getByRole('listbox', { name: 'Vaccines' })
      .getByRole('option', { name: vaccine, exact: true })
      .click();
  }

  async verifyVaccine(vaccine: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.vaccine)).toHaveText(vaccine);
  }

  async enterDose(dose: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.dose).fill(dose);
  }

  async verifyDose(dose: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.dose)).toHaveValue(dose);
  }

  async #pick(blankTestId: string, option: string): Promise<void> {
    await this.#scope.getByTestId(blankTestId).click();
    await this.#page.getByRole('option', { name: option, exact: true }).click();
  }

  async selectUnits(units: string): Promise<void> {
    await this.#pick(dataTestIds.orderVaccinePage.units, units);
  }

  async verifyUnits(units: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.units)).toHaveText(asWritten(units));
  }

  async selectRoute(route: string): Promise<void> {
    await this.#pick(dataTestIds.orderVaccinePage.route, route);
  }

  async verifyRoute(route: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.route)).toHaveText(asWritten(route));
  }

  async selectLocation(location: string): Promise<void> {
    await this.#pick(dataTestIds.orderVaccinePage.location, location);
  }

  async verifyLocation(location: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.location)).toHaveText(asWritten(location));
  }

  async enterInstructions(instructions: string): Promise<void> {
    const blank = this.#scope.getByTestId(dataTestIds.orderVaccinePage.instructions);
    // Offered as a "+ instructions" link until opened or written in.
    if ((await blank.count()) === 0) await this.#scope.getByRole('button', { name: '+ instructions' }).click();
    await blank.fill(instructions);
  }

  async verifyInstructions(instructions: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.instructions)).toHaveValue(instructions);
  }

  async verifyOrderedBy(orderedBy: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.orderedBy)).toHaveText(orderedBy);
  }

  async selectAssociatedDx(dxSearchText: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.associatedDx).click();
    await this.#page.getByRole('combobox', { name: 'Associated Dx' }).fill(dxSearchText);
    await this.#page.getByRole('option').filter({ hasText: dxSearchText }).first().click();
  }

  async verifyAssociatedDx(dxText: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.associatedDx)).toHaveText(
      new RegExp(dxText, 'i')
    );
  }

  async enterManufacturer(manufacturer: string): Promise<void> {
    await this.#scope.getByTestId(dataTestIds.orderVaccinePage.manufacturer).fill(manufacturer);
  }

  async verifyManufacturer(manufacturer: string): Promise<void> {
    await expect(this.#scope.getByTestId(dataTestIds.orderVaccinePage.manufacturer)).toHaveValue(manufacturer);
  }
}
