import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { SideMenu } from '../SideMenu';

export class InPersonAssessmentPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async selectDiagnosis(diagnosis: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentPage.diagnosisDropdown).locator('input').fill(diagnosis);
    await this.#page.getByText(diagnosis).click();
    await expect(this.#page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosisDeleteButton)).toBeEnabled({
      timeout: 30000,
    });
    //wait the diagnosis to be processed
    await this.#page.waitForTimeout(3000);
  }

  async selectEMCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentPage.emCodeDropdown).click();
    await this.#page.getByText(code).click();
    await expect(this.#page.getByTestId(dataTestIds.billingContainer.deleteButton)).toBeEnabled({ timeout: 30000 });
  }
}

export async function expectAssessmentPage(page: Page): Promise<InPersonAssessmentPage> {
  await page.waitForURL(new RegExp('/in-person/.*/assessment'));
  await expect(page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField)).toBeEnabled({
    timeout: 30000,
  });
  return new InPersonAssessmentPage(page);
}
