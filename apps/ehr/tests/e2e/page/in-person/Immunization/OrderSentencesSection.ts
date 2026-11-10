import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { OrderDetailsEntry } from './OrderDetailsSection';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A picked option as the sentence writes it: its first word lower-cased ("intramuscular route"). */
const asWritten = (text: string): RegExp => new RegExp(`^${escapeRegExp(text)}$`, 'i');

/**
 * The order form as sentences, on the create/edit page (one or more immunizations, each a set of sentences whose
 * blanks are the fields). Option lists open in a body-level popover, so they are resolved against the page. The
 * vaccine-details tab still renders the field form: see OrderDetailsSection.
 */
export class OrderSentencesSection implements OrderDetailsEntry {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async selectVaccine(vaccine: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.vaccine).click();
    await this.#page.getByRole('combobox', { name: 'Immunization' }).fill(vaccine);
    // The menu's right column; a quick pick in the left one may carry the vaccine's name.
    await this.#page
      .getByRole('listbox', { name: 'Vaccines' })
      .getByRole('option', { name: vaccine, exact: true })
      .click();
  }

  async verifyVaccine(vaccine: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.vaccine)).toHaveText(vaccine);
  }

  async enterDose(dose: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.dose).fill(dose);
  }

  async verifyDose(dose: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.dose)).toHaveValue(dose);
  }

  async #pick(blankTestId: string, option: string): Promise<void> {
    await this.#page.getByTestId(blankTestId).click();
    await this.#page.getByRole('option', { name: option, exact: true }).click();
  }

  async selectUnits(units: string): Promise<void> {
    await this.#pick(dataTestIds.orderVaccinePage.units, units);
  }

  async verifyUnits(units: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.units)).toHaveText(asWritten(units));
  }

  async selectRoute(route: string): Promise<void> {
    await this.#pick(dataTestIds.orderVaccinePage.route, route);
  }

  async verifyRoute(route: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.route)).toHaveText(asWritten(route));
  }

  async selectLocation(location: string): Promise<void> {
    await this.#pick(dataTestIds.orderVaccinePage.location, location);
  }

  async verifyLocation(location: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.location)).toHaveText(asWritten(location));
  }

  async enterInstructions(instructions: string): Promise<void> {
    const blank = this.#page.getByTestId(dataTestIds.orderVaccinePage.instructions);
    // Offered as a "+ instructions" link until opened or written in.
    if ((await blank.count()) === 0) await this.#page.getByRole('button', { name: '+ instructions' }).click();
    await blank.fill(instructions);
  }

  async verifyInstructions(instructions: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.instructions)).toHaveValue(instructions);
  }

  async verifyOrderedBy(orderedBy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.orderedBy)).toHaveText(orderedBy);
  }

  async selectAssociatedDx(dxSearchText: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.associatedDx).click();
    await this.#page.getByRole('combobox', { name: 'Associated Dx' }).fill(dxSearchText);
    await this.#page.getByRole('option').filter({ hasText: dxSearchText }).first().click();
  }

  async verifyAssociatedDx(dxText: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.associatedDx)).toHaveText(new RegExp(dxText, 'i'));
  }

  async enterManufacturer(manufacturer: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderVaccinePage.manufacturer).fill(manufacturer);
  }

  async verifyManufacturer(manufacturer: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderVaccinePage.manufacturer)).toHaveValue(manufacturer);
  }
}
