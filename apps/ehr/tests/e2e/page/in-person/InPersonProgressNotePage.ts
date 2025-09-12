import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { BaseProgressNotePage } from '../abstract/BaseProgressNotePage';
import { CssHeader } from '../CssHeader';
import { SideMenu } from '../SideMenu';

export class InPersonProgressNotePage extends BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  cssHeader(): CssHeader {
    return new CssHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async expectLoaded(): Promise<void> {
    await this.#page.waitForURL(new RegExp('/in-person/.*/progress-note'));
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();
  }
}

export async function expectInPersonProgressNotePage(page: Page): Promise<InPersonProgressNotePage> {
  await page.waitForURL(new RegExp('/in-person/.*/progress-note'));
  return new InPersonProgressNotePage(page);
}

export async function openInPersonProgressNotePage(
  appointmentId: string,
  page: Page
): Promise<InPersonProgressNotePage> {
  await page.goto(`/in-person/${appointmentId}/progress-note`);
  return expectInPersonProgressNotePage(page);
}
