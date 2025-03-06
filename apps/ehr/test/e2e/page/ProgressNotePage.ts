import { expect, Page } from '@playwright/test';
import { SideMenu } from './SideMenu';
import { CssHeader } from './CssHeader';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class ProgressNotePage {
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

  async clickReviewAndSignButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton).click();
  }

  async verifyReviewAndSignButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton)).toBeDisabled();
  }

  async clickSignButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
  }
}

export async function expectProgressNotePage(page: Page): Promise<ProgressNotePage> {
  await page.waitForURL(new RegExp('/in-person/.*/progress-note'));
  return new ProgressNotePage(page);
}
