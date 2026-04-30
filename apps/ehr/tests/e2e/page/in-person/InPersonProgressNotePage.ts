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

  async verifyRosReviewSectionVisible(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.rosReviewContainer),
      'ROS review section should be visible on the progress note'
    ).toBeVisible({ timeout: 15000 });
  }

  async verifyRosReviewSectionHidden(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.rosReviewContainer),
      'ROS review section should not be visible when no findings are documented'
    ).not.toBeVisible();
  }

  async verifyRosFinding(findingLabel: string, abnormal: boolean): Promise<void> {
    const rosContainer = this.#page.getByTestId(dataTestIds.progressNotePage.rosReviewContainer);
    const findingText = rosContainer.getByText(findingLabel, { exact: true });
    await expect(findingText, `Finding "${findingLabel}" should be visible in ROS section`).toBeVisible();
    if (abnormal) {
      await expect(findingText, `Reports finding "${findingLabel}" should be bold`).toHaveCSS('font-weight', '700');
    } else {
      await expect(findingText, `Denies finding "${findingLabel}" should not be bold`).not.toHaveCSS(
        'font-weight',
        '700'
      );
    }
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
