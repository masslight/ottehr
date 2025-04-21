import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { BaseAssessmentPage } from '../abstract/BaseAssessmentPage';

export class InPersonAssessmentPage extends BaseAssessmentPage {
  constructor(page: Page) {
    super(page);
  }
}

export async function expectAssessmentPage(page: Page): Promise<InPersonAssessmentPage> {
  await page.waitForURL(new RegExp('/in-person/.*/assessment'));
  await expect(page.getByTestId(dataTestIds.assessmentCard.medicalDecisionField)).toBeEnabled({
    timeout: 30000,
  });
  return new InPersonAssessmentPage(page);
}
