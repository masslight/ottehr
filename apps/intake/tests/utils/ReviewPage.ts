import { BrowserContext, Locator, Page, expect } from '@playwright/test';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';

export class ReviewPage {
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

  async checkTitleIsVisible(): Promise<void> {
    await expect(this.locator.titleReviewScreen).toBeVisible();
  }
  async checkDescIsVisible(): Promise<void> {
    await expect(this.locator.descReviewScreen).toBeVisible();
  }
  async checkPatientTitleIsVisible(): Promise<void> {
    await expect(this.locator.titlePatient).toBeVisible();
  }
  async checkLocationTitleIsVisible(): Promise<void> {
    await expect(this.locator.titleLocation).toBeVisible();
  }
  async checkVisitDetailsTitleIsVisible(): Promise<void> {
    await expect(this.locator.titleVisitDetails).toBeVisible();
  }
  async checkLocationValue(): Promise<void> {
    await this.checkValueIsNotEmpty(this.locator.locationName);
    await expect(this.locator.locationName).toBeVisible();
  }
  async checkPrebookSlotValue(): Promise<void> {
    await this.checkValueIsNotEmpty(this.locator.prebookSlotReviewScreen);
    await expect(this.locator.prebookSlotReviewScreen).toBeVisible();
  }
  async checkValueIsNotEmpty(value: Locator): Promise<void> {
    const textContent = await value.textContent();
    await expect(textContent).not.toBeNull();
    await expect(textContent?.trim()).not.toBe('');
    await expect(textContent?.trim().toLowerCase()).not.toBe('Unknown');
  }
  async checkPatientNameIsCorrect(): Promise<void> {
    const patientName = await this.goToReviewPageInPersonVisit();
    const firstName = patientName.firstName;
    const lastName = patientName.lastName;
    await expect(this.page.getByText(`${firstName} ${lastName}`)).toBeVisible();
  }
  async checkSlotIsCorrect(): Promise<void> {
    const selectedSlot = await this.goToReviewPageInPersonVisit();
    await expect(this.page.getByText(`${selectedSlot.selectedSlot.selectedSlot}`)).toBeVisible();
  }
  async goToReviewPageInPersonVisit(): Promise<any> {
    await this.page.goto(`/`);
    await this.locator.scheduleInPersonVisitButton.click();
    const selectedSlot = await this.fillingInfo.selectRandomSlot();
    // added workaround to pass the test
    // issue is described here https://github.com/masslight/ottehr-private/issues/168#issuecomment-2574837200
    // need to uncomment when issue is fixed
    await this.page.reload();
    //
    await this.locator.selectDifferentFamilyMember();
    await this.locator.clickContinueButton();
    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    const firstName = bookingData.firstName;
    const lastName = bookingData.lastName;
    const email = bookingData.email;
    await this.fillingInfo.fillDOBgreater18();
    await this.locator.clickContinueButton();
    return { firstName, lastName, email, selectedSlot };
  }
  async extractLocationName(): Promise<string | null> {
    await this.page.goto(`/`);
    await this.locator.scheduleInPersonVisitButton.click();
    await expect(this.locator.firstAvailableTime).toBeVisible();
    const title = await this.locator.pageTitle.textContent();
    if (title) {
      const location = title.replace('Book a visit at ', '').trim();
      return location;
    }
    return null;
  }
  async checkLocationValueIsCorrect(): Promise<void> {
    const locationValue = await this.extractLocationName();
    await this.goToReviewPageInPersonVisit();
    await expect(this.page.getByText(`${locationValue}`)).toBeVisible();
  }
  async checkPrivacyPolicyLink(): Promise<void> {
    const pagePromise = this.context.waitForEvent('page');
    await this.locator.privacyPolicyReviewScreen.click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://www.ottehr.com/privacy-policy');
  }
  async checkTermsAndConditionsLink(): Promise<void> {
    const pagePromise = this.context.waitForEvent('page');
    await this.locator.termsAndConditions.click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://www.ottehr.com/terms-and-conditions');
  }
  async editTimeSlot(): Promise<void> {
    //  issue https://github.com/masslight/ottehr-private/issues/321
  }
}
