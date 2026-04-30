import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

export class ReviewOfSystemsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  page(): Page {
    return this.#page;
  }

  async validateSystemTablesLoaded(expectedNumberOfTables: number): Promise<void> {
    const tables = this.#page.getByTestId(dataTestIds.reviewOfSystemsPage.rosTable);
    await expect(tables, `Validate there are ${expectedNumberOfTables} system tables visible`).toHaveCount(
      expectedNumberOfTables
    );
  }

  #getFindingRow(systemLabel: string, findingLabel: string): Locator {
    const systemTable = this.#page
      .getByTestId(dataTestIds.reviewOfSystemsPage.rosTable)
      .filter({ hasText: systemLabel });
    return systemTable.getByRole('row').filter({ hasText: findingLabel });
  }

  async checkDenies(systemLabel: string, findingLabel: string): Promise<void> {
    const row = await this.#getFindingRow(systemLabel, findingLabel);
    const cell = row.getByTestId(dataTestIds.reviewOfSystemsPage.deniesCheckboxCell);
    const checkbox = cell.getByRole('checkbox');
    await checkbox.click();
  }

  async checkReports(systemLabel: string, findingLabel: string): Promise<void> {
    const row = await this.#getFindingRow(systemLabel, findingLabel);
    const cell = row.getByTestId(dataTestIds.reviewOfSystemsPage.reportsCheckboxCell);
    const checkbox = cell.getByRole('checkbox');
    await checkbox.click();
  }

  async assertDeniesChecked(systemLabel: string, findingLabel: string, checked: boolean): Promise<void> {
    const row = await this.#getFindingRow(systemLabel, findingLabel);
    const cell = row.getByTestId(dataTestIds.reviewOfSystemsPage.deniesCheckboxCell);
    const checkbox = cell.getByRole('checkbox');

    if (checked) {
      await expect(checkbox, `Denies checkbox for "${findingLabel}" should be checked`).toBeChecked();
    } else {
      await expect(checkbox, `Denies checkbox for "${findingLabel}" should be unchecked`).not.toBeChecked();
    }
  }

  async assertReportsChecked(systemLabel: string, findingLabel: string, checked: boolean): Promise<void> {
    const row = await this.#getFindingRow(systemLabel, findingLabel);
    const cell = row.getByTestId(dataTestIds.reviewOfSystemsPage.reportsCheckboxCell);
    const checkbox = cell.getByRole('checkbox');

    if (checked) {
      await expect(checkbox, `Reports checkbox for "${findingLabel}" should be checked`).toBeChecked();
    } else {
      await expect(checkbox, `Reports checkbox for "${findingLabel}" should be unchecked`).not.toBeChecked();
    }
  }
}

export async function expectReviewOfSystemsPage(page: Page): Promise<ReviewOfSystemsPage> {
  await page.waitForURL(new RegExp(`/in-person/.*/review-of-systems`));
  await expect(
    page.getByTestId(dataTestIds.reviewOfSystemsPage.rosTableContainer),
    `Verify the review of systems page container is visible`
  ).toBeVisible();
  return new ReviewOfSystemsPage(page);
}
