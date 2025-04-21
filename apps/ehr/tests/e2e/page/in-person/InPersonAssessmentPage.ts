import { expect, Page } from '@playwright/test';
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
  }

  async selectEmCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).click();
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).locator('input').fill(code);
    await this.#page.getByRole('option').first().waitFor();
    await this.#page.getByRole('option').first().click();
  }
}

export async function expectAssessmentPage(page: Page): Promise<InPersonAssessmentPage> {
  await page.waitForURL(new RegExp('/in-person/.*/assessment'));
  await expect(page.getByTestId(dataTestIds.assessmentCard.medicalDecisionField)).toBeEnabled({
    timeout: 30000,
  });
  return new InPersonAssessmentPage(page);
}
