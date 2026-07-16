import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export class InPersonExamPage {
  constructor(_page: Page) {}
}

export async function expectExamPage(page: Page): Promise<InPersonExamPage> {
  await page.waitForURL(new RegExp(`/in-person/.*/examination`));
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable)).toBeEnabled({
    timeout: 30000,
  });
  return new InPersonExamPage(page);
}
