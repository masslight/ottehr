import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

const DEFAULT_TIMEOUT = { timeout: 15000 };

export abstract class BaseAssessmentPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async expectDiagnosisDropdown(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.diagnosisContainer.diagnosisDropdown).locator('input').waitFor({
      state: 'visible',
    });
    const diagnosisAutocomplete = this.#page.getByTestId(dataTestIds.diagnosisContainer.diagnosisDropdown);
    await expect(await diagnosisAutocomplete.locator('input')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async expectMdmField(options?: { text?: string }): Promise<void> {
    const { text } = options ?? {};
    const mdmField = this.#page.getByTestId(dataTestIds.assessmentCard.medicalDecisionField);
    await expect(mdmField.locator('textarea:visible')).toBeVisible(DEFAULT_TIMEOUT);
    if (text) {
      await expect(mdmField.locator('textarea:visible')).toHaveText(text);
    }
  }

  async fillMdmField(text: string): Promise<void> {
    const mdmField = await this.#page.getByTestId(dataTestIds.assessmentCard.medicalDecisionField);
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

    const diagnosisAutocomplete = await this.#page.getByTestId(dataTestIds.diagnosisContainer.diagnosisDropdown);

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

  async expectEmCodeDropdown(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown)).toBeVisible();
  }

  async selectEmCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).click();
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).locator('input').fill(code);
    await this.#page.getByRole('option').first().waitFor();
    await this.#page.getByRole('option').first().click();
  }
}
