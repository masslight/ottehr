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
    await this.#page.waitForTimeout(5000);
  }

  async verifyStateNameTitle(stateNameTitle: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.stateNameTitle)).toHaveText(stateNameTitle);
  }

  async verifyStateNameField(stateNameField: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.stateNameField).locator('input')).toHaveValue(
      stateNameField
    );
  }

  async setToggleOff(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input').setChecked(false);
    await this.#page.waitForTimeout(5000);
  }

  async verifyToggleOff(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input')).toBeChecked({
      checked: false,
    });
  }

  async setToggleOn(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editState.operateInStateToggle).locator('input').setChecked(true);
    await this.#page.waitForTimeout(5000);
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
