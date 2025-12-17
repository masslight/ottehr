import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { NursingOrdersPage } from './NursingOrdersPage';

export class NursingOrderDetailsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyOrderNote(expectedNote: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.orderNote)).toContainText(expectedNote);
  }

  async verifyStatus(expectedStatus: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.status)).toContainText(expectedStatus);
  }

  async verifyHistoryVisible(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.historySection)).toBeVisible();
  }

  async toggleHistorySection(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.historyToggleButton).click();
  }

  async verifyHistoryHidden(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.historySection)).not.toBeVisible();
  }

  async verifyCompleteOrderButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.completeOrderButton)).toBeEnabled();
  }

  async verifyCompleteOrderButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.completeOrderButton)).toBeDisabled();
  }

  async clickCompleteOrderButton(): Promise<NursingOrdersPage> {
    await this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.completeOrderButton).click();
    await this.#page.waitForURL(new RegExp('/in-person/.*/nursing-orders$'));
    return new NursingOrdersPage(this.#page);
  }

  async clickBackButton(): Promise<NursingOrdersPage> {
    await this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.backButton).click();
    await this.#page.waitForURL(new RegExp('/in-person/.*/nursing-orders$'));
    return new NursingOrdersPage(this.#page);
  }

  async verifyHistoryEntry(expectedText: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.historySection)).toContainText(
      expectedText
    );
  }

  async getHistoryEntries(): Promise<string[]> {
    const historyItems = this.#page
      .getByTestId(dataTestIds.nursingOrderDetailsPage.historySection)
      .locator('[data-testid*="history-item"]');

    const count = await historyItems.count();
    const entries: string[] = [];

    for (let i = 0; i < count; i++) {
      entries.push(await historyItems.nth(i).innerText());
    }

    return entries;
  }

  async verifyOrderedByVisible(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.orderedBy)).toBeVisible();
  }

  async verifyOrderedDateVisible(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.nursingOrderDetailsPage.orderedDate)).toBeVisible();
  }
}

export async function expectNursingOrderDetailsPage(page: Page): Promise<NursingOrderDetailsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/nursing-orders/.*'));
  await expect(page.getByTestId(dataTestIds.nursingOrderDetailsPage.orderNote)).toBeVisible();
  return new NursingOrderDetailsPage(page);
}

export async function openNursingOrderDetailsPage(
  appointmentId: string,
  serviceRequestId: string,
  page: Page
): Promise<NursingOrderDetailsPage> {
  await page.goto(`/in-person/${appointmentId}/nursing-orders/${serviceRequestId}`);
  return expectNursingOrderDetailsPage(page);
}
