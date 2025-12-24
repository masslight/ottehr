import { BrowserContext, expect, Page, test } from '@playwright/test';
import { BaseFlow, PatientBasicInfo } from '../BaseFlow';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';
import { Locators } from '../locators';
import { Paperwork, TelemedPaperworkReturn } from '../Paperwork';
import { FillingInfo } from './FillingInfo';
import { PaperworkTelemed } from './Paperwork';

export interface SlotAndLocation {
  slot: { time: string; fullSlot: string };
  location: string | null;
}

export interface StartVisitResponse {
  patientBasicInfo: PatientBasicInfo;
  appointmentId: string;
  slotAndLocation: Partial<SlotAndLocation>;
}

export interface FilledPaperworkInput {
  payment: 'card' | 'insurance';
  responsibleParty: 'self' | 'not-self';
  requiredOnly?: boolean;
  patientBasicInfo?: PatientBasicInfo;
}

export abstract class BaseTelemedFlow extends BaseFlow {
  protected locator: Locators;
  protected fillingInfo: FillingInfo;
  protected context: BrowserContext;
  protected commonLocatorsHelper: CommonLocatorsHelper;
  protected paperwork: PaperworkTelemed;
  protected paperworkGeneral: Paperwork;

  constructor(page: Page) {
    const fillingInfo = new FillingInfo(page);
    super(page, fillingInfo);
    this.fillingInfo = fillingInfo;
    this.locator = new Locators(page);
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

  abstract additionalStepsForPrebook(): Promise<void>;
  abstract selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>>;

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
      thisEmailBelongsTo: bookingData.thisEmailBelongsTo,
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

  async ValidatePatientInfo(patientBasicInfo: PatientBasicInfo): Promise<void> {
    await test.step('check patient details and non-linear flow', async () => {
      await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
      await expect(this.locator.flowHeading).toHaveText('Contact information');
      const startOfPaperwork = this.page.url();

      // todo: it should not depend on pre-created resources. sometimes another appointment gets higher priority and
      // shows a "Return to call" button, hiding the "Continue Virtual Visit Request" button
      /* await test.step('go back to home page, check "Continue Virtual Visit Request" and "Cancel this request" buttons are visible', async () => {
        await this.page.waitForTimeout(10_000);
        await this.page.goto('/home');

        await expect(this.page.getByRole('button', { name: 'Continue Virtual Visit Request' })).toBeVisible({
          timeout: 10_000,
        });

        const cancelButton = this.page.getByRole('button', { name: 'Cancel this request' });
        await expect(cancelButton).toBeVisible();
        await cancelButton.click();
        await expect(this.page.getByRole('dialog')).toBeVisible();
        await expect(this.page.getByText('Why are you canceling?')).toBeVisible();
      });

      await test.step('click "Continue Virtual Visit Request" button and check it goes to paperwork page', async () => {
        await this.page.getByRole('button', { name: 'Continue Virtual Visit Request' }).click();
        await this.page.waitForURL(startOfPaperwork);
      }); */

      // ^ since this flow is broken, run the flow instead
      await test.step('run the flow again', async () => {
        await this.page.waitForTimeout(1_000);
        await this.selectVisitAndContinue();
        await this.additionalStepsForPrebook();
        await this.selectTimeLocationAndContinue();
      });

      await test.step('select existing patient', async () => {
        await this.findAndSelectExistingPatient(patientBasicInfo);
      });

      const dob = await test.step('check selecting an incorrect dob', async () => {
        await expect(this.page.getByText(`Confirm ${patientBasicInfo?.firstName}'s date of birth`)).toBeVisible();
        const { dob } = patientBasicInfo;
        await this.fillingInfo.fillWrongDOB(dob.m, dob.d, dob.y);
        await this.continue();

        const errorText = await this.page
          .getByText('Unfortunately, this patient record is not confirmed.') // modal, in that case try again option should be selected
          .or(this.page.getByText('Date may not be in the future')) // validation error directly on the form
          .textContent();

        // close if it is modal
        if (errorText?.includes('Unfortunately, this patient record is not confirmed')) {
          await this.page.getByRole('button', { name: 'Try again' }).click();
        }
        return dob;
      });

      await test.step('select the correct dob', async () => {
        await this.fillingInfo.fillCorrectDOB(dob.m, dob.d, dob.y);
        await this.continue();

        await expect(this.page.getByText('About the patient')).toBeVisible({ timeout: 20000 });

        const patientName = this.page.getByText(`${patientBasicInfo?.firstName} ${patientBasicInfo?.lastName}`);
        await expect(patientName).toBeVisible();
        await expect(
          this.page.getByText(
            `Birthday: ${this.fillingInfo.getStringDateByDateUnits(dob.m, dob.d, dob.y, 'MMMM dd, yyyy')}`
          )
        ).toBeVisible();
      });

      await test.step('go back to paperwork page', async () => {
        await this.page.waitForTimeout(1_000);
        await this.page.goto(startOfPaperwork);
      });
    });
  }
}
