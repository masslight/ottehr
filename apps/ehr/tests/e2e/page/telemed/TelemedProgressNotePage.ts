import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { BaseProgressNotePage } from '../abstract/BaseProgressNotePage';

export class TelemedProgressNotePage extends BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  async expectLoaded(): Promise<void> {
    await this.#page.waitForURL(new RegExp('/telemed/.*'));
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();
  }
}
