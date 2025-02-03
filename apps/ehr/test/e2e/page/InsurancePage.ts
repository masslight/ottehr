import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class InsutrancePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickNextPage(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.nextPage).click();
  }

  async clickPreviousPage(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.previousPage).click();
  }
}
