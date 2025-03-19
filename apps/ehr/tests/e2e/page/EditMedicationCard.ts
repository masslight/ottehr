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
}

const FIELD_TO_TEST_ID = new Map<Field, string>()
  .set(Field.MEDICATION, dataTestIds.orderMedicationPage.inputField('medicationId'))
  .set(Field.DOSE, dataTestIds.orderMedicationPage.inputField('dose'))
  .set(Field.ASSOCIATED_DX, dataTestIds.orderMedicationPage.inputField('associatedDx'))
  .set(Field.UNITS, dataTestIds.orderMedicationPage.inputField('units'))
  .set(Field.MANUFACTURER, dataTestIds.orderMedicationPage.inputField('manufacturer'))
  .set(Field.ROUTE, dataTestIds.orderMedicationPage.inputField('route'))
  .set(Field.INSTRUCTIONS, dataTestIds.orderMedicationPage.inputField('instructions'));

export class EditMedicationCard {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async selectMedication(medication: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.MEDICATION)!).click();
    await this.#page.getByText(medication, { exact: true }).click();
  }

  async verifyMedication(medication: string): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.MEDICATION)!).locator('div:text("' + medication + '")')
    ).toBeVisible();
  }

  async selectAssociatedDx(diagnosis: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.ASSOCIATED_DX)!).click();
    await this.#page.getByText(diagnosis).click();
  }

  async verifyAssociatedDx(diagnosis: string): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.ASSOCIATED_DX)!).locator('div:text("' + diagnosis + '")')
    ).toBeVisible();
  }

  async verifyDiagnosisNotAllowed(diagnosis: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.ASSOCIATED_DX)!).click();
    await this.#page.getByText(diagnosis).locator('input').isHidden();
  }

  async enterDose(dose: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.DOSE)!).locator('input').pressSequentially(dose);
  }
  async clearDose(): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.DOSE)!).locator('input').clear();
  }

  async verifyDose(dose: string): Promise<void> {
    await expect(this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.DOSE)!).locator('input')).toHaveValue(dose);
  }

  async selectUnits(units: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.UNITS)!).click();
    await this.#page.getByText(units, { exact: true }).click();
  }

  async verifyUnits(units: string): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.UNITS)!).locator('div:text("' + units + '")')
    ).toBeVisible();
  }

  async enterManufacturer(manufacturer: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.MANUFACTURER)!).locator('input').fill(manufacturer);
  }

  async verifyManufacturer(manufacturer: string): Promise<void> {
    await expect(this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.MANUFACTURER)!).locator('input')).toHaveValue(
      manufacturer
    );
  }

  async clearManufacturer(): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.MANUFACTURER)!).locator('input').clear();
  }

  async selectRoute(route: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.ROUTE)!).click();
    await this.#page.getByText(route, { exact: true }).click();
  }

  async verifyRoute(route: string): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.ROUTE)!).locator('div:text("' + route + '")')
    ).toBeVisible();
  }

  async enterInstructions(instructions: string): Promise<void> {
    await this.#page
      .getByTestId(FIELD_TO_TEST_ID.get(Field.INSTRUCTIONS)!)
      .locator('textarea:visible')
      .fill(instructions);
  }

  async verifyInstructions(instructions: string): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.INSTRUCTIONS)!).locator('textarea:visible')
    ).toHaveText(instructions);
  }

  async clearInstructions(): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.INSTRUCTIONS)!).locator('textarea:visible').clear();
  }

  async verifyValidationErrorShown(field: Field, closeErrorDialog = true): Promise<void> {
    if (closeErrorDialog) {
      await this.#page.getByTestId(dataTestIds.dialog.closeButton).click();
    }
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(field)!).locator('p:text("This field is required")')
    ).toBeVisible();
  }

  async verifyValidationErrorNotShown(field: Field): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(field)!).locator('p:text("This field is required")')
    ).toBeHidden();
  }
}
