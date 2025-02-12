import { BrowserContext, expect, Locator, Page } from '@playwright/test';
import { Locators } from '../locators';
import { FillingInfo } from './FillingInfo';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';

export abstract class BaseInPersonFlow {
  protected page: Page;
  protected locator: Locators;
  protected fillingInfo: FillingInfo;
  protected context: BrowserContext;
  protected commonLocatorsHelper: CommonLocatorsHelper;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.commonLocatorsHelper = new CommonLocatorsHelper(page);
    this.context = page.context();
  }

  async goToReviewPage(): Promise<{
    firstName: string;
    lastName: string;
    email: string;
    selectedSlot?: { buttonName: string | null; selectedSlot: string | undefined };
    location?: string | null;
  }> {
    await this.page.goto(`/`);
    await this.clickVisitButton();
    const additionalData = await this.additionalStepsForPrebook();
    const bookingData = await this.fillPatientDetailsAndContinue();
    return {
      ...bookingData, // Includes firstName, lastName, email
      ...additionalData, // Includes selectedSlot & location (for prebook)
    };
  }
  private async fillPatientDetailsAndContinue(): Promise<{ firstName: string; lastName: string; email: string }> {
    await this.locator.selectDifferentFamilyMember();
    await this.locator.clickContinueButton();

    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    await this.fillingInfo.fillDOBgreater18();
    await this.locator.clickContinueButton();

    return {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
    };
  }

  // Abstract method to be implemented in subclasses
  protected abstract additionalStepsForPrebook(): Promise<
    Partial<{ selectedSlot: { buttonName: string | null; selectedSlot: string | undefined }; location: string | null }>
  >;
  protected abstract clickVisitButton(): Promise<void>;
  protected abstract completeBooking(): Promise<void>;

  async startVisit(): Promise<{ bookingURL: string }> {
    await this.goToReviewPage();
    await this.completeBooking();
    await this.page.waitForURL(/\/visit/);
    return { bookingURL: this.page.url() };
  }

  async checkValueIsNotEmpty(value: Locator): Promise<void> {
    const textContent = await value.textContent();
    await expect(textContent).not.toBeNull();
    await expect(textContent?.trim()).not.toBe('');
    await expect(textContent?.trim().toLowerCase()).not.toBe('unknown');
  }
}
