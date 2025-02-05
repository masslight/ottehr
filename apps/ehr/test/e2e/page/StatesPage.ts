import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class StatesPage {
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

  async verifyPaginationState(rows: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.pagination.paginationContainer).locator('p:text("' + rows + '")')
    ).toBeVisible();
  }

  async verifyStatesPresent(states: string[]): Promise<void> {
    for (const state of states) {
      await expect(this.#page.locator('a:text("' + state + '")')).toBeVisible();
    }
  }

  async selectRowsPerPage(rowsPerPage: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.paginationContainer).getByText('10', { exact: true }).click();
    await this.#page.getByText(rowsPerPage).click();
  }

  async searchStates(text: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.statesPage.statesSearch).locator('input').fill(text);
  }

  async clickState(state: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.statesPage.stateRow(state)).locator('a').click();
  }

  async getFisrtState(): Promise<string> {
    return (await this.#page.getByTestId(dataTestIds.statesPage.stateValue).first().locator('a').innerText()).substring(
      0,
      2
    );
  }

  async verifyOperateInState(state: string, operate: boolean): Promise<void> {
    const rowLocator = this.#page.getByTestId(dataTestIds.statesPage.stateRow(state));
    const rowOperate = await rowLocator.getByTestId(dataTestIds.statesPage.operateInStateValue).innerText();
    expect(rowOperate).toBe(operate ? 'YES' : 'NO');
  }
}

export async function expectStatesPage(page: Page): Promise<StatesPage> {
  await page.waitForURL(`/telemed-admin/states`);
  await expect(page.locator('th').getByText('State name')).toBeVisible();
  return new StatesPage(page);
}

export async function openStatesPage(page: Page): Promise<StatesPage> {
  await page.goto('/telemed-admin/states');
  return expectStatesPage(page);
}
