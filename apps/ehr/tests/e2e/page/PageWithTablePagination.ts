import { Page, expect } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class PageWithTablePagination {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickNextPage(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.paginationContainer).getByTitle('Go to next page').click();
  }

  async clickPreviousPage(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.paginationContainer).getByTitle('Go to previous page').click();
  }

  async verifyPaginationState(rows: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.pagination.paginationContainer).locator('p:text("' + rows + '")')
    ).toBeVisible();
  }

  async selectRowsPerPage(rowsPerPage: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.pagination.paginationContainer).getByText('10', { exact: true }).click();
    await this.#page.getByText(rowsPerPage).click();
  }

  async canGoNextPage(): Promise<boolean> {
    return (
      await this.#page.getByTestId(dataTestIds.pagination.paginationContainer).getByTitle('Go to next page')
    ).isEnabled();
  }

  /**
   * Iterates through paginated results and finds an expected value.
   * @param callback - A function that returns `true` when the expected element is found.
   * @param pageLoadedCallback - (Optional) A function to wait for the page to load after pagination.
   * @returns `true` if the element is found, otherwise `false`.
   */
  async findInPages(callback: () => Promise<boolean>, pageLoadedCallback?: () => Promise<void>): Promise<boolean> {
    if (pageLoadedCallback) {
      await pageLoadedCallback(); // Wait for the page to load initially
    }
    do {
      if (await callback()) {
        return true; // Stop when the condition is met
      }
    } while (await this.goToNextPageIfPossible(pageLoadedCallback));

    return false; // Element not found in any page
  }

  /**
   * Moves to the next page and waits for it to load.
   * @param pageLoadedCallback - (Optional) A function to wait for the page to fully load.
   * @returns `true` if pagination moved to the next page, otherwise `false`.
   */
  private async goToNextPageIfPossible(pageLoadedCallback?: () => Promise<void>): Promise<boolean> {
    if (await this.canGoNextPage()) {
      await this.clickNextPage();
      if (pageLoadedCallback) {
        await pageLoadedCallback(); // Wait for the page to load dynamically
      }
      return true;
    }
    return false;
  }
}
