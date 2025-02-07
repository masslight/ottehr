import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class StateDetailsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickCancelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editState.cancelButton).click();
  }

  async clickSaveChangesButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editState.saveChangesButton).click();
    await this.#page.waitForSelector('text=State was updated successfully');
  }

  async verifyStateNameTitle(stateNameTitle: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.stateNameTitle)).toHaveText(
      new RegExp(stateNameTitle + '.*')
    );
  }

  async verifyStateNameField(stateNameText: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.stateNameField).locator('input')).toHaveValue(
      new RegExp(stateNameText + '.*')
    );
  }

  async setToggleOff(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input').setChecked(false);
  }

  async verifyToggleOff(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input')).toBeChecked({
      checked: false,
    });
  }

  async setToggleOn(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input').setChecked(true);
  }

  async verifyToggleOn(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input')).toBeChecked({
      checked: true,
    });
  }

  async isToggleOn(): Promise<boolean> {
    return this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input').isChecked();
  }

  async reloadStateDetailsPage(): Promise<void> {
    await this.#page.reload();
  }
}

export async function expectStateDetailsPage(state: string, page: Page): Promise<StateDetailsPage> {
  await page.waitForURL(`/telemed-admin/states/` + state);
  await expect(page.locator('h3').getByText(state + ' - Telemed')).toBeVisible();
  return new StateDetailsPage(page);
}
