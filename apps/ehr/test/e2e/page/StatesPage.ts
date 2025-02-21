import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { PageWithTablePagination } from './PageWithTablePagination';

export class StatesPage extends PageWithTablePagination {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  async verifyStatePresent(state: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.statesPage.stateRow(state))).toBeVisible();
  }

  async verifyStateNameField(stateNameText: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.stateNameField).locator('input')).toHaveValue(
      new RegExp(stateNameText + '.*')
    );
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
