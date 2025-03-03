import { expect, Page } from '@playwright/test';
import { SideMenu } from './SideMenu';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { CssHeader } from './CssHeader';

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

export class OrderMedicationPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  cssHeader(): CssHeader {
    return new CssHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async selectMedication(medication: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.MEDICATION)!).click();
    await this.#page.getByText(medication, { exact: true }).click();
  }

  async selectAssociatedDx(diagnosis: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.ASSOCIATED_DX)!).click();
    await this.#page.getByText(diagnosis).click();
  }

  async enterDose(dose: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.DOSE)!).click();
    await this.#page.getByText(dose, { exact: true }).click();
  }

  async selectUnits(units: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.UNITS)!).click();
    await this.#page.getByText(units, { exact: true }).click();
  }

  async enterManufacturer(manufacturer: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.MANUFACTURER)!).click();
    await this.#page.getByText(manufacturer, { exact: true }).click();
  }

  async selectRoute(route: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.ROUTE)!).click();
    await this.#page.getByText(route, { exact: true }).click();
  }

  async enterInstructions(instructions: string): Promise<void> {
    await this.#page.getByTestId(FIELD_TO_TEST_ID.get(Field.INSTRUCTIONS)!).click();
    await this.#page.getByText(instructions, { exact: true }).click();
  }

  async verifyValidationErrorShown(field: Field): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(field)!).locator('p:text("This field is required")')
    ).toBeVisible();
  }

  async verifyValidationErrorNotShown(field: Field): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(field)!).locator('p:text("This field is required")')
    ).toBeHidden();
  }

  async verifyFillOrderToSaveButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderMedicationPage.fillOrderToSaveButton)).toBeDisabled();
  }

  async clickOrderMedicationButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderMedicationPage.fillOrderToSaveButton).click();
  }
}

export async function expectOrderMedicationPage(page: Page): Promise<OrderMedicationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-medication/order/new'));
  return new OrderMedicationPage(page);
}
