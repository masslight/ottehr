import { BrowserContext, expect, Locator, Page } from '@playwright/test';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';
import { Locators } from '../locators';
import { FillingInfo } from './FillingInfo';

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
    birthSex: string;
    email: string;
    dobMonth: string;
    dobYear: string;
    dobDay: string;
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
  private async fillPatientDetailsAndContinue(): Promise<{
    firstName: string;
    lastName: string;
    email: string;
    birthSex: string;
    dobMonth: string;
    dobYear: string;
    dobDay: string;
  }> {
    await this.locator.selectDifferentFamilyMember();
    await this.locator.clickContinueButton();

    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    const dob = await this.fillingInfo.fillDOBgreater18();
    await this.locator.clickContinueButton();

    return {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      birthSex: bookingData.BirthSex,
      dobMonth: dob.randomMonth,
      dobYear: dob.randomYear,
      dobDay: dob.randomDay,
    };
  }

  // Abstract method to be implemented in subclasses
  abstract additionalStepsForPrebook(): Promise<
    Partial<{ selectedSlot: { buttonName: string | null; selectedSlot: string | undefined }; location: string | null }>
  >;
  protected abstract clickVisitButton(): Promise<void>;
  protected abstract completeBooking(): Promise<void>;

  async startVisit(): Promise<{
    bookingURL: string;
    bookingUUID: string | null;
    firstName: string;
    lastName: string;
    email: string;
    birthSex: string;
    dobMonth: string;
    dobYear: string;
    dobDay: string;
    location?: string | null;
    selectedSlot?: string | null;
  }> {
    const bookingData = await this.goToReviewPage();
    await this.completeBooking();
    await this.page.waitForURL(/\/visit\//);
    const bookingURL = this.page.url();
    const match = bookingURL.match(/visit\/([0-9a-fA-F-]+)/);
    const bookingUUID = match ? match[1] : null;
    return {
      bookingURL,
      bookingUUID,
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      birthSex: bookingData.birthSex,
      dobMonth: bookingData.dobMonth,
      dobYear: bookingData.dobYear,
      dobDay: bookingData.dobDay,
      location: bookingData.location,
      selectedSlot: bookingData.selectedSlot?.selectedSlot,
    };
  }
  async checkValueIsNotEmpty(value: Locator): Promise<void> {
    const textContent = await value.textContent();
    await expect(textContent).not.toBeNull();
    await expect(textContent?.trim()).not.toBe('');
    await expect(textContent?.trim().toLowerCase()).not.toBe('unknown');
  }
}
