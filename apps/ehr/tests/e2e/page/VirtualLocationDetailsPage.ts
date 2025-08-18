import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class VirtualLocationDetailsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickCancelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editVirtualLocation.cancelButton).click();
  }

  async clickSaveChangesButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editVirtualLocation.saveChangesButton).click();
    await this.#page.waitForSelector('text=Virtual location was updated successfully');
  }

  async verifyLocationNameTitle(locationNameTitle: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editVirtualLocation.locationNameTitle)).toHaveText(
      new RegExp(locationNameTitle + '.*')
    );
  }

  async verifyLocationNameField(locationNameText: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.editVirtualLocation.locationNameField).locator('input')
    ).toHaveValue(new RegExp(locationNameText + '.*'));
  }

  async setToggleOff(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.editVirtualLocation.operateInLocationToggle)
      .locator('input')
      .setChecked(false);
  }

  async verifyToggleOff(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.editVirtualLocation.operateInLocationToggle).locator('input')
    ).toBeChecked({
      checked: false,
    });
  }

  async setToggleOn(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.editVirtualLocation.operateInLocationToggle)
      .locator('input')
      .setChecked(true);
  }

  async verifyToggleOn(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.editVirtualLocation.operateInLocationToggle).locator('input')
    ).toBeChecked({
      checked: true,
    });
  }

  async isToggleOn(): Promise<boolean> {
    return this.#page.getByTestId(dataTestIds.editVirtualLocation.operateInLocationToggle).locator('input').isChecked();
  }

  async reloadStateDetailsPage(): Promise<void> {
    await this.#page.reload();
  }
}

export async function expectStateDetailsPage(
  locationId: string,
  locatioName: string,
  page: Page
): Promise<VirtualLocationDetailsPage> {
  await page.waitForURL(`/telemed-admin/virtual-locations/` + locationId);
  await expect(page.locator('h3').getByText(locatioName)).toBeVisible();
  return new VirtualLocationDetailsPage(page);
}
