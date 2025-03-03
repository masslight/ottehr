import { BrowserContext, Page } from '@playwright/test';
import { Locators } from '../locators';
import { FillingInfo } from './FillingInfo';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';

export interface SlotAndLocation { selectedSlot: { buttonName: string | null; selectedSlot: string | undefined }; location: string | null }
export interface StartVisitResponse { bookingURL: string; firstName: string; lastName: string; email: string; slotAndLocation: Partial<SlotAndLocation> }

export abstract class BaseTelemedFlow {
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
  abstract additionalStepsForPrebookAndContinue(): Promise<
    Partial<SlotAndLocation>
  >;
  abstract clickVisitButton(): Promise<void>;
  abstract completeBooking(): Promise<void>;

  async selectVisitAndContinue() {
    await this.page.goto(`/`);
    await this.clickVisitButton();
  }

  async selectDifferentFamilyMemberAndContinue() {
    await this.locator.selectDifferentFamilyMember();
    await this.continue();
  }

  async fillNewPatientDataAndContinue():Promise<{ firstName: string; lastName: string; email: string }> {
    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    await this.fillingInfo.fillDOBless18();
    await this.continue();
  return {
    firstName: bookingData.firstName,
    lastName: bookingData.lastName,
    email: bookingData.email,
  };

}
  // async goToReviewPage(): Promise<{
  //   selectedSlot?: { buttonName: string | null; selectedSlot: string | undefined };
  //   location?: string | null;
  // }> {
  //
  //   const additionalData = await this.additionalStepsForPrebook();
  //   const bookingData = await this.fillPatientDetailsAndContinue();
  //   return {
  //     ...bookingData, // Includes firstName, lastName, email
  //     ...additionalData, // Includes selectedSlot & location (for prebook)
  //   };
  // }

  async continue() {
    await this.locator.clickContinueButton();
  }

  async startVisitFullFlow(): Promise<StartVisitResponse> {
    await this.selectVisitAndContinue();
    const slotAndLocation = await this.additionalStepsForPrebookAndContinue();
    await this.selectDifferentFamilyMemberAndContinue();
    const patientData = await this.fillNewPatientDataAndContinue();
    await this.completeBooking();
    await this.page.waitForURL(/\/visit/);
    return {
      bookingURL: this.page.url(),
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      email: patientData.email,
      slotAndLocation,
    };
  }
}
