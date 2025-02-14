import { expect, Locator, Page } from '@playwright/test';
import { Locators } from './locators';

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
    await this.locator.continueButton.click();
  }
  async selectState(stateName?: string): Promise<void> {
    await this.page.getByPlaceholder('Search or select').click();
    if (stateName) {
      await this.page.getByRole('option', { name: stateName }).click();
    } else {
      await this.page.getByRole('option').first().click();
    }
    await this.clickContinue();
  }
}
