import { BrowserContext, expect, Page } from '@playwright/test';
import { DateTime } from 'luxon';
import { chooseJson, GetSlotDetailsResponse } from 'utils';
import { BaseFlow, PatientBasicInfo } from '../BaseFlow';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';
import { InPersonPaperworkReturn, Paperwork } from '../Paperwork';
import { FillingInfo } from './FillingInfo';

export interface SlotAndLocation {
  selectedSlot: string | undefined;
  location: string | null;
  locationTitle?: string | null;
}

export interface StartVisitResponse {
  patientBasicInfo: PatientBasicInfo;
  bookingUUID: string | null;
  // only used in prebook flows
  slotAndLocation?: SlotAndLocation;
  slotDetails: GetSlotDetailsResponse | null;
}

export interface FilledPaperworkInput {
  payment: 'card' | 'insurance';
  responsibleParty: 'self' | 'not-self';
  requiredOnly?: boolean;
  patientBasicInfo?: PatientBasicInfo;
}

export abstract class BaseInPersonFlow extends BaseFlow {
  protected fillingInfo: FillingInfo;
  protected context: BrowserContext;
  protected commonLocatorsHelper: CommonLocatorsHelper;
  protected paperworkGeneral: Paperwork;
  slotDetails: GetSlotDetailsResponse | null = null;

  constructor(page: Page) {
    const fillingInfo = new FillingInfo(page);
    super(page, fillingInfo);
    this.fillingInfo = fillingInfo;
    this.commonLocatorsHelper = new CommonLocatorsHelper(page);
    this.context = page.context();
    this.paperworkGeneral = new Paperwork(page);

    this.page.on('response', async (response) => {
      if (response.url().includes('/get-slot-details/')) {
        const details = chooseJson(await response.json()) as GetSlotDetailsResponse;
        this.slotDetails = details;
      }
    });
  }

  // flow steps:
  // - click button
  // - start visit by choosing patient
  // - fill paperwork
  // - complete booking
  // - cancel appointment

  abstract clickVisitButton(): Promise<void>;

  abstract startVisitWithoutPaperwork(
    patient?: PatientBasicInfo
  ): Promise<StartVisitResponse & Partial<SlotAndLocation>>;

  abstract fillPaperwork({
    payment,
    responsibleParty,
    requiredOnly,
    patientBasicInfo,
  }: FilledPaperworkInput): Promise<InPersonPaperworkReturn<typeof payment, typeof responsibleParty, boolean>>;

  abstract completeBooking(): Promise<void>;

  abstract cancelAppointment(): Promise<void>;

  // ---------------------------------------------------------------------------

  async selectVisitAndContinue(): Promise<void> {
    await this.page.goto(`/home`);
    await this.clickVisitButton();
  }

  async fillNewPatientDataAndContinue(): Promise<PatientBasicInfo> {
    const bookingData =
      process.env.SMOKE_TEST === 'true'
        ? await this.fillingInfo.fillNewPatientInfoSmoke()
        : await this.fillingInfo.fillNewPatientInfo();
    const patientDob = await this.fillingInfo.fillDOBgreater18();
    await this.locator.clickContinueButton();
    return {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      birthSex: bookingData.birthSex,
      reasonForVisit: bookingData.reasonForVisit,
      dob: {
        d: patientDob.randomDay,
        m: patientDob.randomMonth,
        y: patientDob.randomYear,
      },
      isNewPatient: true,
    };
  }

  async findAndSelectExistingPatient(patient: PatientBasicInfo): Promise<void> {
    // find and select existing patient
    const dobString = DateTime.fromFormat(
      patient.dob.y + '-' + patient.dob.m + '-' + patient.dob.d || '',
      'yyyy-MMM-d'
    ).toFormat('MMMM dd, yyyy');

    // Find all patient headings with matching name
    const patientHeadings = this.page.getByRole('heading', {
      name: new RegExp(`.*${patient.firstName} ${patient.lastName}.*`, 'i'),
    });

    // Find the one with matching DOB
    const count = await patientHeadings.count();
    let patientName = null;
    for (let i = 0; i < count; i++) {
      const heading = patientHeadings.nth(i);
      const dobLabel = heading.locator('xpath=ancestor::label').getByText(dobString);
      if (await dobLabel.isVisible().catch(() => false)) {
        patientName = heading;
        break;
      }
    }

    if (!patientName) {
      throw new Error(`Patient with name ${patient.firstName} ${patient.lastName} and DOB ${dobString} not found`);
    }
    await patientName.scrollIntoViewIfNeeded();
    await patientName.click({ timeout: 40_000, noWaitAfter: true, force: true });
    await this.locator.clickContinueButton();

    // confirm dob
    await this.fillingInfo.fillCorrectDOB(patient.dob.m, patient.dob.d, patient.dob.y);
    await this.locator.clickContinueButton();

    // select reason for visit
    await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
    await expect(this.locator.flowHeading).toHaveText('About the patient');
    await this.fillingInfo.fillVisitReason();
    await this.locator.continueButton.click();
  }

  async continue(): Promise<void> {
    await this.locator.clickContinueButton();
  }
}
