import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { BaseProgressNotePage } from '../abstract/BaseProgressNotePage';
import { InPersonHeader } from '../InPersonHeader';
import { SideMenu } from '../SideMenu';

export class InPersonProgressNotePage extends BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async expectLoaded(): Promise<void> {
    await this.#page.waitForURL(new RegExp('/in-person/.*/review-and-sign'));
    // Ensure no error occurred
    await expect(this.#page.getByText('An error has occurred'))
      .not.toBeVisible({ timeout: 5000 })
      .catch(() => {
        // If error message is visible, throw
        throw new Error('Page loaded with error state');
      });
    // Wait for the card to appear (it may take time to render after data loads)
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible({
      timeout: 60000,
    });
  }
}

export async function expectInPersonProgressNotePage(page: Page): Promise<InPersonProgressNotePage> {
  const progressNotePage = new InPersonProgressNotePage(page);
  await progressNotePage.expectLoaded();
  return progressNotePage;
}

export async function openInPersonProgressNotePage(
  appointmentId: string,
  page: Page
): Promise<InPersonProgressNotePage> {
  await page.goto(`/in-person/${appointmentId}/review-and-sign`);
  return expectInPersonProgressNotePage(page);
}
