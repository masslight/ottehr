import { expect, Page } from '@playwright/test';
import { waitForResponseWithData } from 'test-utils';
import { DeleteChartDataResponse } from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { BaseAssessmentPage } from '../abstract/BaseAssessmentPage';

export class InPersonAssessmentPage extends BaseAssessmentPage {
  #page: Page;
  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  async selectCptCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentCard.cptCodeField).locator('input').fill(code);
    await this.#page.getByRole('option').filter({ hasText: code }).first().waitFor();
    await this.#page.getByRole('option').filter({ hasText: code }).first().click();

    // Find the specific CPT code entry and verify its delete button is enabled to ensure the code is saved
    const cptCodeEntry = this.#page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(code));
    await expect(cptCodeEntry).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.billingContainer.deleteCptCodeButton(code))).toBeEnabled();
  }

  async selectEmCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).click();
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).locator('input').fill(code);
    await this.#page.getByRole('option').first().waitFor();
    await this.#page.getByRole('option').first().click();

    // Verify that the delete button is enabled to ensure the code is saved
    await expect(this.#page.getByTestId(dataTestIds.billingContainer.deleteButton)).toBeEnabled();
  }

  async verifyCptCode(code: string): Promise<void> {
    const value = await this.#page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(code)).textContent();
    expect(value).toContain(code);
  }

  async verifyCptCodeAbsent(code: string): Promise<void> {
    const value = await this.#page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(code));
    await expect(value).toBeHidden();
  }

  async deleteCptCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.billingContainer.deleteCptCodeButton(code)).click();
    await waitForResponseWithData<DeleteChartDataResponse>(this.#page, '/delete-chart-data', () => true);
  }

  async expectBillingCodesElement(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.billingContainer.container).waitFor();
  }
}

export async function expectAssessmentPage(page: Page): Promise<InPersonAssessmentPage> {
  await page.waitForURL(new RegExp('/in-person/.*/assessment'));
  await expect(page.getByTestId(dataTestIds.assessmentCard.medicalDecisionField)).toBeEnabled({
    timeout: 30000,
  });
  return new InPersonAssessmentPage(page);
}
