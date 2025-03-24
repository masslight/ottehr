import { Page, expect } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

const DEFAULT_TIMEOUT = { timeout: 15000 };

export abstract class BaseAssessmentPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async expectDiagnosisDropdown(): Promise<void> {
    const diagnosisAutocomplete = this.#page.getByTestId(dataTestIds.assessmentPage.diagnosisDropdown);
    await expect(diagnosisAutocomplete).toBeVisible(DEFAULT_TIMEOUT);
  }

  async expectMdmField(options?: { text?: string }): Promise<void> {
    const { text } = options ?? {};
    const mdmField = this.#page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField);
    await expect(await mdmField.locator('textarea:visible')).toBeVisible(DEFAULT_TIMEOUT);
    if (text) {
      await expect(await mdmField.locator('textarea:visible')).toHaveText(text);
    }
  }

  async fillMdmField(text: string): Promise<void> {
    const mdmField = this.#page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField);
    await mdmField.locator('textarea:visible').fill(text);
  }

  async selectDiagnosis({
    diagnosisNamePart,
    diagnosisCode,
  }: {
    diagnosisNamePart?: string;
    diagnosisCode?: string;
  }): Promise<void> {
    if (!diagnosisCode && !diagnosisNamePart) {
      throw new Error('Either diagnosisCode or diagnosisNamePart must be provided');
    }

    const diagnosisAutocomplete = await this.#page.getByTestId(dataTestIds.assessmentPage.diagnosisDropdown);

    const searchText = diagnosisCode ?? diagnosisNamePart ?? '';

    await diagnosisAutocomplete.click();
    await diagnosisAutocomplete.locator('input').fill(searchText);
    await this.#page
      .getByRole('option', { name: new RegExp(searchText, 'i') })
      .first()
      .waitFor();
    await this.#page
      .getByRole('option', { name: new RegExp(searchText, 'i') })
      .first()
      .click();
  }
}
