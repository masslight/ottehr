import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class StatesPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickNextPage(): Promise<StatesPage> {
    await this.#page.getByTestId(dataTestIds.pagination.nextPage).click();
    return this;
  }

  async clickPreviousPage(): Promise<StatesPage> {
    await this.#page.getByTestId(dataTestIds.pagination.previousPage).click();
    return this;
  }

  async verifyPaginationState(rows: string): Promise<StatesPage> {
    await expect(
      this.#page.getByTestId(dataTestIds.pagination.paginationContainer).locator('p:text("' + rows + '")')
    ).toBeVisible();
    return this;
  }

  async verifyStatesPresent(states: string[]): Promise<StatesPage> {
    for (const state of states) {
      await expect(this.#page.locator('a:text("' + state + '")')).toBeVisible();
    }
    return this;
  }

  async selectRowsPerPage(rowsPerPage: string): Promise<StatesPage> {
    await this.#page.getByTestId(dataTestIds.pagination.paginationContainer).getByText('10', { exact: true }).click();
    await this.#page.getByText(rowsPerPage).click();
    return this;
  }

  async searchStates(text: string): Promise<StatesPage> {
    await this.#page.getByTestId(dataTestIds.statesPage.statesSearch).locator('input').fill(text);
    return this;
  }

  async clickState(state: string): Promise<StatesPage> {
    await this.#page.locator('a:text("' + state + '")').click();
    return this;
  }
}

export async function expectStatesPage(page: Page): Promise<StatesPage> {
  await page.waitForURL(`/telemed-admin/states`);
  await expect(page.locator('th').getByText('State name')).toBeVisible();
  return new StatesPage(page);
}
