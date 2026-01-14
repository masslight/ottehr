import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import {
  AdministeredDialogue,
  expectAdministrationConfirmationDialogue,
} from './in-person/inHouseMedicationsAdministrationDialog';

export enum Field {
  MEDICATION,
  DOSE,
  ASSOCIATED_DX,
  UNITS,
  MANUFACTURER,
  ROUTE,
  INSTRUCTIONS,
  ORDERED_BY,
  LOT_NUMBER,
  EXP_DATE,
}

const FIELD_TO_TEST_ID = new Map<Field, string>()
  .set(Field.MEDICATION, dataTestIds.orderMedicationPage.inputField('medicationId'))
  .set(Field.DOSE, dataTestIds.orderMedicationPage.inputField('dose'))
  .set(Field.ASSOCIATED_DX, dataTestIds.orderMedicationPage.inputField('associatedDx'))
  .set(Field.UNITS, dataTestIds.orderMedicationPage.inputField('units'))
  .set(Field.MANUFACTURER, dataTestIds.orderMedicationPage.inputField('manufacturer'))
  .set(Field.ROUTE, dataTestIds.orderMedicationPage.inputField('route'))
  .set(Field.INSTRUCTIONS, dataTestIds.orderMedicationPage.inputField('instructions'))
  .set(Field.ORDERED_BY, dataTestIds.orderMedicationPage.inputField('providerId'))
  .set(Field.LOT_NUMBER, dataTestIds.orderMedicationPage.inputField('lotNumber'))
  .set(Field.EXP_DATE, dataTestIds.orderMedicationPage.inputField('expDate'));

export const DIAGNOSIS_EMPTY_VALUE = 'Select Associated Dx';
export const ORDERED_BY_EMPTY_VALUE = 'Select Ordered By';

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
    await this.chooseOption(medication, true);
  }

  async clearMedication(): Promise<void> {
    const dataTestId = this.getDataTestId(Field.MEDICATION);
    await this.#page.getByTestId(dataTestId).locator('input').fill('');
  }

  async verifyMedication(medication: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.MEDICATION);
    await expect(this.#page.getByTestId(dataTestId).locator('input')).toHaveValue(medication);
  }

  async selectAssociatedDx(diagnosis: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
    await this.#page.getByTestId(dataTestId).click();
    await this.chooseOption(diagnosis);
  }

  async chooseOption(optionName: string, exact: boolean = false): Promise<void> {
    await this.#page.getByRole('option', { name: optionName, exact }).waitFor({ state: 'visible' });
    await this.#page.getByRole('option', { name: optionName, exact }).click();
  }

  async selectOrderedBy(orderedBy: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ORDERED_BY);

    // mui set tabindex 0 to enabled element
    await this.#page.locator(`[data-testid="${dataTestId}"] [role="combobox"][tabindex="0"]`).waitFor({
      timeout: 30000,
    });

    await this.#page.getByTestId(dataTestId).click();
    await this.chooseOption(orderedBy);
  }

  async selectFirstNonEmptyOrderedBy(): Promise<string> {
    const dataTestId = this.getDataTestId(Field.ORDERED_BY);

    // mui set tabindex 0 to enabled element
    await this.#page.locator(`[data-testid="${dataTestId}"] [role="combobox"][tabindex="0"]`).waitFor({
      timeout: 30000,
    });

    await this.#page.getByTestId(dataTestId).click();
    const options = await this.#page.getByRole('option').all();
    for (const option of options) {
      const text = await option.textContent();
      if (text && text.trim() !== ORDERED_BY_EMPTY_VALUE) {
        const dataValue = await option.getAttribute('data-value');
        if (dataValue && dataValue !== '') {
          await option.click();
          return text;
        }
      }
    }
    throw new Error('Failed to select order by');
  }

  async verifyAssociatedDx(diagnosis: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
    await expect(this.#page.getByTestId(dataTestId).locator('div:text("' + diagnosis + '")')).toBeVisible();
  }

  async waitForLoadOrderedBy(): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ORDERED_BY);
    await this.#page.locator(`[data-testid="${dataTestId}"] [role="combobox"][tabindex="0"]`).waitFor({
      timeout: 30000,
    });
  }

  async waitForLoadAssociatedDx(): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
    await this.#page.locator(`[data-testid="${dataTestId}"] [role="combobox"][tabindex="0"]`).waitFor({
      timeout: 30000,
    });
  }

  async verifyDiagnosisNotAllowed(diagnosis: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByRole('option', { name: DIAGNOSIS_EMPTY_VALUE }).waitFor({ state: 'visible' });
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
    await this.chooseOption(units, true);
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
    await this.chooseOption(route, true);
  }

  async verifyRoute(route: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.ROUTE);
    const input = this.#page.getByTestId(dataTestId).locator('div:text("' + route + '")');
    await expect(input).toBeVisible();
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

  async expectSaved(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderMedicationPage.fillOrderToSaveButton)).toHaveText('Saved');
  }

  async enterLotNumber(lotNumber: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.LOT_NUMBER);
    await this.#page.getByTestId(dataTestId).locator('input').fill('');
    await this.#page.getByTestId(dataTestId).locator('input').pressSequentially(lotNumber);
  }

  async enterExpiratrionDate(expirationDate: string): Promise<void> {
    const dataTestId = this.getDataTestId(Field.EXP_DATE);
    await this.#page.getByTestId(dataTestId).click();
    await this.#page.getByTestId(dataTestId).pressSequentially(expirationDate);
  }

  async clickAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.administeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }

  async clickPartlyAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.partlyAdministeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }

  async clickNotAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.notAdministeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }
}
