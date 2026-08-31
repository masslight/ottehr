import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { NursingOrderCreatePage } from './NursingOrderCreatePage';
import { NursingOrderDetailsPage } from './NursingOrderDetailsPage';

export class NursingOrderRow {
  #row: Locator;
  #page: Page;

  constructor(row: Locator, page: Page) {
    this.#row = row;
    this.#page = page;
  }

  async verifyOrderNote(expectedNote: string): Promise<void> {
    await expect(this.#row.getByTestId(dataTestIds.nursingOrdersPage.orderNote)).toContainText(expectedNote);
  }

  async verifyStatus(expectedStatus: string): Promise<void> {
    await expect(this.#row.getByTestId(dataTestIds.nursingOrdersPage.status)).toContainText(expectedStatus);
  }

  async verifyOrderAddedDate(): Promise<void> {
    await expect(this.#row.getByTestId(dataTestIds.nursingOrdersPage.orderAddedDate)).toBeVisible();
  }

  async click(): Promise<NursingOrderDetailsPage> {
    await this.#row.click();
    await this.#page.waitForURL(new RegExp('/in-person/.*/nursing-orders/.*'));
    return new NursingOrderDetailsPage(this.#page);
  }

  async clickDeleteButton(): Promise<void> {
    await this.#row.getByTestId(dataTestIds.nursingOrdersPage.deleteButton).click();

    const confirmButton = this.#page.getByTestId(dataTestIds.dialog.proceedButton);
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
  }

  async verifyDeleteButtonVisible(): Promise<void> {
    await expect(this.#row.getByTestId(dataTestIds.nursingOrdersPage.deleteButton)).toBeVisible();
  }

  async verifyDeleteButtonHidden(): Promise<void> {
    await expect(this.#row.getByTestId(dataTestIds.nursingOrdersPage.deleteButton)).not.toBeVisible();
  }
}

export class NursingOrdersPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickOrderButton(): Promise<NursingOrderCreatePage> {
    await this.#page.getByTestId(dataTestIds.nursingOrdersPage.orderButton).click();
    await this.#page.waitForURL(new RegExp('/in-person/.*/nursing-orders/create'));
    return new NursingOrderCreatePage(this.#page);
  }

  async verifyOrderButtonVisible(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrdersPage.orderButton)).toBeVisible();
  }

  async verifyOrderButtonHidden(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrdersPage.orderButton)).not.toBeVisible();
  }

  async getFirstOrderRow(): Promise<NursingOrderRow> {
    const table = this.#page.getByTestId(dataTestIds.nursingOrdersPage.table);
    await expect(table).toBeVisible();

    const firstRow = table.getByTestId(dataTestIds.nursingOrdersPage.orderRow).first();
    await expect(firstRow).toBeVisible();

    return new NursingOrderRow(firstRow, this.#page);
  }

  async getOrderRowByNote(note: string): Promise<NursingOrderRow> {
    const table = this.#page.getByTestId(dataTestIds.nursingOrdersPage.table);
    const row = table.getByTestId(dataTestIds.nursingOrdersPage.orderRow).filter({ hasText: note });
    await expect(row).toBeVisible();

    return new NursingOrderRow(row, this.#page);
  }

  async verifyOrderNotExists(note: string): Promise<void> {
    const loadingText = this.#page.getByTestId(dataTestIds.nursingOrdersPage.loading);
    await expect(loadingText).not.toBeVisible();
    const table = this.#page.getByTestId(dataTestIds.nursingOrdersPage.table);
    const row = table.getByTestId(dataTestIds.nursingOrdersPage.orderRow).filter({ hasText: note });
    await expect(row).not.toBeVisible();
  }

  async verifyEmptyState(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrdersPage.emptyState)).toBeVisible();
  }

  async getOrderCount(): Promise<number> {
    const table = this.#page.getByTestId(dataTestIds.nursingOrdersPage.table);
    const rows = table.getByTestId(dataTestIds.nursingOrdersPage.orderRow);
    return await rows.count();
  }

  async verifyOrderCount(expectedCount: number): Promise<void> {
    const actualCount = await this.getOrderCount();
    expect(actualCount).toBe(expectedCount);
  }
}

export async function expectNursingOrdersPage(page: Page): Promise<NursingOrdersPage> {
  await page.waitForURL(new RegExp('/in-person/.*/nursing-orders$'));
  await expect(page.getByTestId(dataTestIds.nursingOrdersPage.title)).toBeVisible();
  return new NursingOrdersPage(page);
}

export async function openNursingOrdersPage(appointmentId: string, page: Page): Promise<NursingOrdersPage> {
  await page.goto(`/in-person/${appointmentId}/nursing-orders`);
  return expectNursingOrdersPage(page);
}
