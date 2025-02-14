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
  }

  async selectEMCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentPage.emCodeDropdown).click();
    await this.#page.getByText(code).click();
  }
}

export async function expectAssessmentPage(page: Page): Promise<AssessmentPage> {
  await page.waitForURL(new RegExp('/in-person/.*/assessment'));
  return new AssessmentPage(page);
}
