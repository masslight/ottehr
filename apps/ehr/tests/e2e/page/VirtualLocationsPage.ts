import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { PageWithTablePagination } from './PageWithTablePagination';

export class VirtualLocationsPage extends PageWithTablePagination {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  async verifyLocationPresent(locationId: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.virtualLocationsPage.locationRow(locationId))).toBeVisible();
  }

  async verifyLocationNameField(locationName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.editVirtualLocation.locationNameField).locator('input')
    ).toHaveValue(new RegExp(locationName + '.*'));
  }

  async searchStates(text: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.virtualLocationsPage.locationsSearch).locator('input').fill(text);
  }

  async clickLocation(locationId: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.virtualLocationsPage.locationRow(locationId)).locator('a').click();
  }

  async getFirstLocation(): Promise<{ id: string; name: string }> {
    const locationRow = await this.#page.getByTestId(/location-row-/).first();
    const testId = (await locationRow.getAttribute('data-testid')) || '';
    const id = testId.replace('location-row-', '');
    const name = await locationRow.getByTestId(dataTestIds.virtualLocationsPage.locationValue).innerText();
    return { id, name };
  }

  async verifyActive(state: string, operate: boolean): Promise<void> {
    const rowLocator = this.#page.getByTestId(dataTestIds.virtualLocationsPage.locationRow(state));
    const rowOperate = await rowLocator
      .getByTestId(dataTestIds.virtualLocationsPage.operateInLocationValue)
      .innerText();
    expect(rowOperate).toBe(operate ? 'YES' : 'NO');
  }
}

export async function expectVirtualLocationsPage(page: Page): Promise<VirtualLocationsPage> {
  await page.waitForURL(`/telemed-admin/virtual-locations`);
  await expect(page.locator('th').getByText('Location')).toBeVisible();
  return new VirtualLocationsPage(page);
}

export async function openVirtualLocationsPage(page: Page): Promise<VirtualLocationsPage> {
  await page.goto('/telemed-admin/virtual-locations');
  return expectVirtualLocationsPage(page);
}
