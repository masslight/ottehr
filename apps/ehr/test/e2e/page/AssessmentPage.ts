import { expect, Page } from '@playwright/test';
import { SideMenu } from './SideMenu';
import { CssHeader } from './CssHeader';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class AssessmentPage {
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

  async selectDiagnosis(diagnosis: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentPage.diagnosisDropdown).locator('input').fill(diagnosis);
    await this.#page.getByText(diagnosis).click();
    await expect(this.#page.getByTestId(dataTestIds.diagnosisContainer.deleteButton)).toBeEnabled({ timeout: 30000 });
  }
}

export async function expectAssessmentPage(page: Page): Promise<AssessmentPage> {
  await page.waitForURL(new RegExp('/in-person/.*/assessment'));
  await expect(page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField)).toBeEnabled({
    enabled: true,
    timeout: 30000,
  });
  return new AssessmentPage(page);
}
