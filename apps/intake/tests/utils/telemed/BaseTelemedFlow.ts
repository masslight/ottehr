import { BrowserContext, Page } from '@playwright/test';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';
import { Locators } from '../locators';
import { Paperwork } from '../Paperwork';
import { FillingInfo } from './FillingInfo';
import { PaperworkTelemed } from './Paperwork';

export interface SlotAndLocation {
  selectedSlot: { time: string; fullSlot: string };
  location: string;
  locationTitle?: string | null;
}

export interface StartVisitResponse {
  slotAndLocation: Partial<SlotAndLocation>;
  patientBasicInfo: PatientBasicInfo;
  bookingURL: string;
  bookingUUID: string | null;
}

export interface PatientBasicInfo {
  firstName: string;
  lastName: string;
  birthSex: string;
  email: string;
  thisEmailBelongsTo: string;
  reasonForVisit: string;
  dob: { m: string; d: string; y: string };
}

export abstract class BaseTelemedFlow {
  protected page: Page;
  protected locator: Locators;
  protected fillingInfo: FillingInfo;
  protected context: BrowserContext;
  protected commonLocatorsHelper: CommonLocatorsHelper;
  protected paperwork: PaperworkTelemed;
  protected paperworkGeneral: Paperwork;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.commonLocatorsHelper = new CommonLocatorsHelper(page);
    this.context = page.context();
    this.paperwork = new PaperworkTelemed(page);
    this.paperworkGeneral = new Paperwork(page);
  }
  abstract selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>>;
  abstract clickVisitButton(): Promise<void>;
  abstract completeBooking(): Promise<void>;
  abstract startVisitFullFlow(): Promise<StartVisitResponse>;

  async selectVisitAndContinue(): Promise<void> {
    await this.page.goto(`/home`);
    await this.clickVisitButton();
  }

  async selectDifferentFamilyMemberAndContinue(): Promise<void> {
    await this.locator.selectDifferentFamilyMember();
    await this.continue();
  }

  async fillNewPatientDataAndContinue(): Promise<PatientBasicInfo> {
    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    const patientDob = await this.fillingInfo.fillDOBgreater18();
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
        y: patientDob.randomYear,
      },
    };
  }

  async continue(): Promise<void> {
    await this.locator.clickContinueButton();
  }
}
