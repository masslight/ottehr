import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class VisitsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }
  async verifyVisitPresent(firstName: string, lastName: string, time?: string): Promise<void> {
    const patientName = `${lastName}, ${firstName}`;

    // Find a row that contains the correct patient name
    let visitLocator = this.#page.locator('#appointments-table-row').filter({ hasText: patientName });

    // If time is provided, further filter by time
    if (time) {
      visitLocator = visitLocator.filter({ hasText: time });
    }

    // Expect at least one matching visit
    await expect(visitLocator).toHaveCount(1);
  }

  async clickPrebookedTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.prebookedTab).click();
    await this.#page.waitForTimeout(15000);
  }
  async clickInOfficeTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.inOfficeTab).click();
    await this.#page.waitForTimeout(15000);
  }
  async selectLocation(locationName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.locationSelect).click();
    await this.#page.getByText(new RegExp(locationName, 'i')).click();
  }
  async selectGroup(groupName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.groupSelect).click();
    await this.#page.getByText(new RegExp(groupName, 'i')).click();
  }
}

export async function expectVisitsPage(page: Page): Promise<VisitsPage> {
  await page.waitForURL(`/visits`);
  return new VisitsPage(page);
}
