import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class RadiologyPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickOrderButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.radiologyPage.orderButton).click({ timeout: 30000 });
    await this.#page.waitForURL(/.*\/radiology\/create/);
  }

  async verifyRadiologyOrderInList(studyTypeCode: string, diagnosis?: string): Promise<void> {
    const orderRow = diagnosis
      ? this.#page.locator('tr').filter({ hasText: studyTypeCode }).filter({ hasText: diagnosis })
      : this.#page.locator('tr').filter({ hasText: studyTypeCode });

    await expect(orderRow).toBeVisible({ timeout: 60000 });
  }

  async clickRadiologyOrder(studyType: string): Promise<void> {
    await this.#page.getByText(studyType).first().click();
  }

  async clickDeleteButton(studyType: string): Promise<void> {
    const row = this.#page.locator('tr').filter({ hasText: studyType });
    await row
      .locator('button')
      .filter({ has: this.#page.locator('[data-testid="DeleteOutlinedIcon"]') })
      .click({ timeout: 30000 });
  }
}

export class CreateRadiologyOrderPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async selectStudyType(studyType: string): Promise<void> {
    await this.#page.getByLabel('Study Type').click();
    await this.#page.getByRole('option', { name: studyType }).click();
  }

  async selectDiagnosis(diagnosis: string): Promise<void> {
    const diagnosisField = this.#page.getByLabel('Diagnosis');

    // Check if diagnosis is already selected (it might be auto-filled from Assessment)
    const currentValue = await diagnosisField.inputValue();
    if (currentValue.includes(diagnosis)) {
      // Diagnosis already selected, no need to select again
      return;
    }

    // Type first 3 characters to trigger search (autocomplete requires typing)
    await diagnosisField.click();
    const searchTerm = diagnosis.substring(0, 3);
    await diagnosisField.pressSequentially(searchTerm);

    // Wait for options to load (debounced search)
    await this.#page
      .getByRole('option', { name: new RegExp(diagnosis) })
      .waitFor({ state: 'visible', timeout: 30_000 });

    await this.#page.getByRole('option', { name: new RegExp(diagnosis) }).click();
  }

  async fillClinicalHistory(history: string): Promise<void> {
    await this.#page.getByLabel('Clinical History').fill(history);
  }

  async checkStat(): Promise<void> {
    await this.#page.getByLabel('STAT').check();
  }

  async clickSubmitButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.radiologyPage.submitOrderButton).click({ timeout: 30000 });
  }
}

export class DeleteRadiologyOrderDialog {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async confirmDelete(): Promise<void> {
    // Wait for dialog to appear
    await this.#page.getByText('Are you sure').waitFor();
    // Click the confirm button
    await this.#page.getByRole('button', { name: /Delete.*Order/i }).click();
  }

  async cancelDelete(): Promise<void> {
    await this.#page.getByRole('button', { name: 'Keep' }).click();
  }
}

export async function expectRadiologyPage(page: Page): Promise<RadiologyPage> {
  await page.waitForURL(/.*\/radiology$/);
  await expect(page.getByTestId(dataTestIds.radiologyPage.title)).toBeVisible({ timeout: 10000 });
  return new RadiologyPage(page);
}

export async function openRadiologyPage(appointmentId: string, page: Page): Promise<RadiologyPage> {
  await page.goto(`/in-person/${appointmentId}/radiology`);
  return expectRadiologyPage(page);
}

export async function expectCreateRadiologyOrderPage(page: Page): Promise<CreateRadiologyOrderPage> {
  await page.waitForURL(/.*\/radiology\/create/);
  return new CreateRadiologyOrderPage(page);
}
