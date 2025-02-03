import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class InsutrancePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickNextPage(): Promise<InsurancePage> {
    await this.#page.getByTestId(dataTestIds.pagination.nextPage).click();
    return this;
  }

  async clickPreviousPage(): Promise<InsurancePage> {
    await this.#page.getByTestId(dataTestIds.pagination.previousPage).click();
    return this;
  }