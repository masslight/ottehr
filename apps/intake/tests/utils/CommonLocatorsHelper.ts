import { expect, Locator, Page } from '@playwright/test';
import { DateTime } from 'luxon';
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
    await expect.soft(download.suggestedFilename()).toMatch(/\.pdf$/);
  }

  async checkPatientNameIsCorrect({ firstName, lastName }: { firstName: string; lastName: string }): Promise<void> {
    await expect.soft(this.page.getByText(`${firstName} ${lastName}`)).toBeVisible();
  }

  async checkSlotIsCorrect(selectedSlot?: string): Promise<void> {
    if (!selectedSlot) {
      throw new Error('Selected slot must not be empty or undefined');
    }
    await expect.soft(this.page.getByText(`${selectedSlot}`)).toBeVisible();
  }

  async checkLocationValueIsCorrect(location: string | null): Promise<void> {
    if (!location) {
      throw new Error('Location must not be empty or undefined');
    }
    await expect.soft(this.page.getByText(`${location}`)).toBeVisible();
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
  async getToday(): Promise<string> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear().toString().slice(-2);
    const formattedDate = `${month}/${day}/${year}`;
    return formattedDate;
  }
  getMonthDay(monthStr: string, dayStr: string): { monthNumber: string; dayNumber: string } | null {
    // Using year 2000 as it's a leap year, ensuring February 29th is valid
    const date = DateTime.fromFormat(`${monthStr} ${dayStr} 2000`, 'MMM d yyyy', { locale: 'en' });
    return date.isValid ? { monthNumber: date.toFormat('MM'), dayNumber: date.toFormat('dd') } : null;
  }
  async clearField(locator: Locator): Promise<void> {
    await locator.click({ clickCount: 3 });
    await locator.press('Backspace');
  }
}
