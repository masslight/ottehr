import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class CssHeader {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickSwitchStatusButton(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.cssHeader.switchStatusButton(status)).click();
  }
}