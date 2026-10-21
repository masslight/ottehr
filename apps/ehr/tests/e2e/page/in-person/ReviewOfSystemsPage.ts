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

  #getCommentTextarea(systemKey: string): Locator {
    return this.#page
      .getByTestId(dataTestIds.reviewOfSystemsPage.rosCommentField(systemKey))
      .locator('textarea')
      .locator('visible=true');
  }

  async fillComment(systemKey: string, comment: string): Promise<void> {
    // The comment is saved by a debounced onChange, so wait for the save carrying this text
    const savePromise = this.#page.waitForResponse(
      (response) =>
        response.url().includes('/save-chart-data') &&
        response.status() === 200 &&
        (response.request().postData() ?? '').includes(comment),
      { timeout: 30_000 }
    );
    await this.#getCommentTextarea(systemKey).fill(comment);
    await savePromise;
  }

  async assertCommentValue(systemKey: string, expectedComment: string): Promise<void> {
    await expect(
      this.#getCommentTextarea(systemKey),
      `Comment for "${systemKey}" should be "${expectedComment}"`
    ).toHaveValue(expectedComment);
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
