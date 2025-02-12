import { expect, Page, Locator } from '@playwright/test';
import { Locators } from './locators';
import { AllStates, AllStatesToNames } from 'utils';

export class CommonLocatorsHelper {
  page: Page;
  locator: Locators;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
  }

  async checkLinkOpensPdf(linkLocator: Locator): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download');
    await linkLocator.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  }

  async checkPatientNameIsCorrect({ firstName, lastName }: { firstName: string; lastName: string }): Promise<void> {
    await expect(this.page.getByText(`${firstName} ${lastName}`)).toBeVisible();
  }

  async checkSlotIsCorrect(selectedSlot?: string): Promise<void> {
    if (!selectedSlot) {
      throw new Error('Selected slot must not be empty or undefined');
    }
    await expect(this.page.getByText(`${selectedSlot}`)).toBeVisible();
  }

  async checkLocationValueIsCorrect(location: string | null): Promise<void> {
    if (!location) {
      throw new Error('Location must not be empty or undefined');
    }
    await expect(this.page.getByText(`${location}`)).toBeVisible();
  }

  async clickContinue(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }
  async selectState(stateName = AllStatesToNames[AllStates[0].value]): Promise<void> {
    await this.page.getByPlaceholder('Search or select').click();
    await this.page.getByRole('option', { name: stateName }).click();
    await this.clickContinue();
  }
}
