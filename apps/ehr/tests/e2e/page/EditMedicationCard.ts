import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export enum Field {
  MEDICATION,
  DOSE,
  ASSOCIATED_DX,
  UNITS,
  MANUFACTURER,
  ROUTE,
  INSTRUCTIONS,
  ORDERED_BY,
}

const FIELD_TO_TEST_ID = new Map<Field, string>()
  .set(Field.MEDICATION, dataTestIds.orderMedicationPage.inputField('medicationId'))
  .set(Field.DOSE, dataTestIds.orderMedicationPage.inputField('dose'))
  .set(Field.ASSOCIATED_DX, dataTestIds.orderMedicationPage.inputField('associatedDx'))
  .set(Field.UNITS, dataTestIds.orderMedicationPage.inputField('units'))
  .set(Field.MANUFACTURER, dataTestIds.orderMedicationPage.inputField('manufacturer'))
  .set(Field.ROUTE, dataTestIds.orderMedicationPage.inputField('route'))
  .set(Field.INSTRUCTIONS, dataTestIds.orderMedicationPage.inputField('instructions'))
  .set(Field.ORDERED_BY, dataTestIds.orderMedicationPage.inputField('providerId'));

export class EditMedicationCard {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  getDataTestId(field: Field): string {
    const dataTestId = FIELD_TO_TEST_ID.get(field)!;
    if (!dataTestId) {
      throw new Error('Field is not found');
    }
    return dataTestId;
  }

  async selectMedication(medication: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.MEDICATION);
    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByText(medication, { exact: true }).click();
  }

  async verifyMedication(medication: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.MEDICATION);
    await expect(this.#page.getByTestId(dataTestId).locator('input')).toHaveValue(medication);
  }

  async selectAssociatedDx(diagnosis: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByRole('option', { name: diagnosis }).waitFor({ state: 'visible' });
    await this.#page.getByRole('option', { name: diagnosis }).click();
  }

  async selectOrderedBy(orderedBy: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ORDERED_BY);

    // mui set tabindex 0 to enabled element
    await this.#page.locator(`[data-testid="${dataTestId}"] [role="combobox"][tabindex="0"]`).waitFor({
      timeout: 30000,
    });

    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByRole('option', { name: orderedBy }).waitFor({ state: 'visible' });
    await this.#page.getByRole('option', { name: orderedBy }).click();
  }

  async verifyAssociatedDx(diagnosis: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
    await expect(this.#page.getByTestId(dataTestId).locator('div:text("' + diagnosis + '")')).toBeVisible();
  }

  async verifyDiagnosisNotAllowed(diagnosis: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByText(diagnosis).locator('input').isHidden();
  }

  async enterDose(dose: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.DOSE);
    await this.#page.getByTestId(dataTestId).locator('input').fill('');
    await this.#page.getByTestId(dataTestId).locator('input').pressSequentially(dose);
  }
  async clearDose(): Promise<void> {
    const dataTestId = this.getDataTestId(Field.DOSE);
    await this.#page.getByTestId(dataTestId).locator('input').clear();
  }

  async verifyDose(dose: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.DOSE);
    await expect(this.#page.getByTestId(dataTestId).locator('input')).toHaveValue(dose);
  }

  async selectUnits(units: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.UNITS);
    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByText(units, { exact: true }).click();
  }

  async verifyUnits(units: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.UNITS);
    await expect(this.#page.getByTestId(dataTestId).locator('div:text("' + units + '")')).toBeVisible();
  }

  async enterManufacturer(manufacturer: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.MANUFACTURER);
    await this.#page.getByTestId(dataTestId).locator('input').fill(manufacturer);
  }

  async verifyManufacturer(manufacturer: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.MANUFACTURER);
    await expect(this.#page.getByTestId(dataTestId).locator('input')).toHaveValue(manufacturer);
  }

  async clearManufacturer(): Promise<void> {
    const dataTestId = this.getDataTestId(Field.MANUFACTURER);
    await this.#page.getByTestId(dataTestId).locator('input').clear();
  }

  async selectRoute(route: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ROUTE);
    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByText(route, { exact: true }).click();
  }

  async verifyRoute(route: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ROUTE);
    await expect(this.#page.getByTestId(dataTestId).locator('div:text("' + route + '")')).toBeVisible();
  }

  async enterInstructions(instructions: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.INSTRUCTIONS);
    await this.#page.getByTestId(dataTestId).locator('textarea:visible').fill(instructions);
  }

  async verifyInstructions(instructions: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.INSTRUCTIONS);
    await expect(this.#page.getByTestId(dataTestId).locator('textarea:visible')).toHaveText(instructions);
  }

  async clearInstructions(): Promise<void> {
    const dataTestId = this.getDataTestId(Field.INSTRUCTIONS);
    await this.#page.getByTestId(dataTestId).locator('textarea:visible').clear();
  }

  async verifyValidationErrorShown(field: Field, closeErrorDialog = true): Promise<void> {
    if (closeErrorDialog) {
      await this.#page.getByTestId(dataTestIds.dialog.closeButton).click();
    }
    const dataTestId = this.getDataTestId(field);
    await expect(this.#page.getByTestId(dataTestId).locator('p:text("This field is required")')).toBeVisible();
  }

  async verifyValidationErrorNotShown(field: Field): Promise<void> {
    const dataTestId = this.getDataTestId(field);
    await expect(this.#page.getByTestId(dataTestId).locator('p:text("This field is required")')).toBeHidden();
  }
}
