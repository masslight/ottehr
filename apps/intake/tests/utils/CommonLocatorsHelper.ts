import { expect, Page } from '@playwright/test';
import { Locators } from './locators';

export class CommonLocatorsHelper {
  page: Page;
  locator: Locators;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
  }

  async checkPrivacyPolicyLink(): Promise<void> {
    const pagePromise = this.page.context().waitForEvent('page');
    await this.locator.privacyPolicyReviewScreen.click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://www.ottehr.com/privacy-policy');
  }

  async checkTermsAndConditionsLink(): Promise<void> {
    const pagePromise = this.page.context().waitForEvent('page');
    await this.locator.termsAndConditions.click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://www.ottehr.com/terms-and-conditions');
  }

  async checkPatientNameIsCorrect({ firstName, lastName }: { firstName: string; lastName: string }): Promise<void> {
    await expect(this.page.getByText(`${firstName} ${lastName}`)).toBeVisible();
  }

  async checkSlotIsCorrect(selectedSlot?: string): Promise<void> {
    await expect(this.page.getByText(`${selectedSlot}`)).toBeVisible();
  }

  async checkLocationValueIsCorrect(location: string | null): Promise<void> {
    await expect(this.page.getByText(`${location}`)).toBeVisible();
  }
}
