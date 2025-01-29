import { BrowserContext, expect, Locator, Page } from '@playwright/test';
import { Locators } from '../locators';
import { FillingInfo } from './FillingInfo';

export class PrebookInPersonFlow {
  page: Page;
  locator: Locators;
  fillingInfo: FillingInfo;
  context: BrowserContext;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.context = page.context();
  }

  async goToReviewPageInPersonVisit(): Promise<{
    firstName: string;
    lastName: string;
    email: string;
    selectedSlot: { buttonName: string | null; selectedSlot: string | undefined };
    location: string | null;
  }> {
    await this.page.goto(`/`);
    await this.locator.scheduleInPersonVisitButton.click();

    await expect(this.locator.firstAvailableTime).toBeVisible();
    const title = await this.locator.pageTitle.textContent();
    let location = null;
    if (title) {
      location = title.replace('Book a visit at ', '').trim();
    }

    const selectedSlot = await this.fillingInfo.selectRandomSlot();
    await this.locator.selectDifferentFamilyMember();
    await this.locator.clickContinueButton();
    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    const firstName = bookingData.firstName;
    const lastName = bookingData.lastName;
    const email = bookingData.email;
    await this.fillingInfo.fillDOBgreater18();
    await this.locator.clickContinueButton();
    return { firstName, lastName, email, selectedSlot, location };
  }

  async checkValueIsNotEmpty(value: Locator): Promise<void> {
    const textContent = await value.textContent();
    await expect(textContent).not.toBeNull();
    await expect(textContent?.trim()).not.toBe('');
    await expect(textContent?.trim().toLowerCase()).not.toBe('Unknown');
  }
}
