import { BrowserContext, Page } from '@playwright/test';
import { Locators } from '../locators';
import { FillingInfo } from './FillingInfo';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';
import { Paperwork } from './Paperwork';

export interface SlotAndLocation {
  selectedSlot: { time: string; fullSlot: string };
  location: string;
}

export interface StartVisitResponse {
  slotAndLocation: Partial<SlotAndLocation>;
  patientBasicInfo: Partial<PatientBasicInfo>;
}

export interface PatientBasicInfo {
  firstName: string;
  lastName: string;
  birthSex: string;
  email: string;
  thisEmailBelongsTo: string;
  reasonForVisit: string;
  dob: { m: string; d: string; y: string; }
}

export abstract class BaseTelemedFlow {
  protected page: Page;
  protected locator: Locators;
  protected fillingInfo: FillingInfo;
  protected context: BrowserContext;
  protected commonLocatorsHelper: CommonLocatorsHelper;
  protected paperwork: Paperwork;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.commonLocatorsHelper = new CommonLocatorsHelper(page);
    this.context = page.context();
  }
  abstract selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>>;
  abstract clickVisitButton(): Promise<void>;
  abstract completeBooking(): Promise<void>;
  abstract startVisitFullFlow(): Promise<StartVisitResponse>;

  async selectVisitAndContinue() {
    await this.page.goto(`/`);
    await this.clickVisitButton();
  }

  async selectDifferentFamilyMemberAndContinue() {
    await this.locator.selectDifferentFamilyMember();
    await this.continue();
  }

  async fillNewPatientDataAndContinue(): Promise<PatientBasicInfo> {
    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    const patientDob = await this.fillingInfo.fillDOBless18();
    await this.continue();
    return {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      thisEmailBelongsTo: bookingData.thisEmailBelongsTo,
      birthSex: bookingData.birthSex,
      reasonForVisit: bookingData.reasonForVisit,
      dob: {
        d: patientDob.randomDay,
        m: patientDob.randomMonth,
        y: patientDob.randomYear
      }
    };
  }

  async continue() {
    await this.locator.clickContinueButton();
  }
}
