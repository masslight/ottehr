import { Page, expect } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { BaseProgressNotePage } from '../abstract/BaseProgressNotePage';

export class TelemedProgressNotePage extends BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }
}

export async function expectTelemedProgressNotePage(page: Page): Promise<TelemedProgressNotePage> {
  await page.waitForURL(new RegExp('/telemed/.*'));
  await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();
  return new TelemedProgressNotePage(page);
}
