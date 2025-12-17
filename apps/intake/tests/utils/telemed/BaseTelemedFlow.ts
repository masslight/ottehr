import { BrowserContext, Page } from '@playwright/test';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';
import { Locators } from '../locators';
import { Paperwork, TelemedPaperworkReturn } from '../Paperwork';
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

export interface FilledPaperworkInput {
  payment: 'card' | 'insurance';
  responsibleParty: 'self' | 'not-self';
  requiredOnly?: boolean;
  patientBasicInfo?: PatientBasicInfo;
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

  // flow steps:
  // - click button
  // - start visit by choosing patient
  // - fill paperwork
  // - complete booking
  // - cancel appointment

  abstract clickVisitButton(): Promise<void>;

  abstract startVisitWithoutPaperwork(patient?: PatientBasicInfo): Promise<StartVisitResponse>;

  abstract fillPaperwork({
    payment,
    responsibleParty,
    requiredOnly,
    patientBasicInfo,
  }: FilledPaperworkInput): Promise<TelemedPaperworkReturn<typeof payment, typeof responsibleParty, boolean>>;

  abstract completeBooking(): Promise<void>;

  abstract cancelAppointment(): Promise<void>;

  // ---------------------------------------------------------------------------

  abstract selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>>;

  async selectVisitAndContinue(): Promise<void> {
    await this.page.goto(`/home`);
    await this.clickVisitButton();
  }

  async fillNewPatientDataAndContinue(): Promise<PatientBasicInfo> {
    const bookingData = await this.fillingInfo.fillNewPatientInfo();
    const patientDob = await this.fillingInfo.fillDOBgreater18();
    await this.locator.clickContinueButton();
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
