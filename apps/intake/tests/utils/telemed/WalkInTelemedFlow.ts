import test, { expect } from '@playwright/test';
import { shouldShowServiceCategorySelectionPage } from 'utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { CancelPage } from '../CancelPage';
import { TelemedPaperworkReturn } from '../Paperwork';
import {
  BaseTelemedFlow,
  FilledPaperworkInput,
  PatientBasicInfo,
  SlotAndLocation,
  StartVisitResponse,
} from './BaseTelemedFlow';

export class WalkInTelemedFlow extends BaseTelemedFlow {
  // flow steps:
  // - click button
  // - start visit by choosing patient
  // - fill paperwork
  // - complete booking
  // - cancel appointment

  async clickVisitButton(): Promise<void> {
    const scheduleButton = this.page.getByTestId(dataTestIds.startVirtualVisitButton);
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
  }

  async startVisitWithoutPaperwork(patient?: PatientBasicInfo): Promise<StartVisitResponse> {
    await this.selectVisitAndContinue();
    const slotAndLocation = await this.selectTimeLocationAndContinue();

    let patientBasicInfo: PatientBasicInfo;
    if (patient) {
      await this.findAndSelectExistingPatient(patient);
      patientBasicInfo = patient;
    } else {
      await this.locator.selectDifferentFamilyMember();
      patientBasicInfo = await this.fillNewPatientDataAndContinue();
    }
    await this.locator.confirmWalkInButton.click();

    await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
    await expect(this.locator.flowHeading).toHaveText('Contact information');

    const bookingURL = this.page.url();
    console.log('Booking URL: ', bookingURL);
    const match = bookingURL.match(/paperwork\/([0-9a-fA-F-]+)/);
    const bookingUUID = match ? match[1] : null;

    return {
      patientBasicInfo,
      slotAndLocation,
      bookingURL,
      bookingUUID,
    };
  }

  /**
   * If you pass in patientBasicInfo, it will validate a few extra steps by checking non-linear flow
   */
  async fillPaperwork({
    patientBasicInfo,
    payment,
    responsibleParty,
    requiredOnly,
  }: FilledPaperworkInput): Promise<TelemedPaperworkReturn<typeof payment, typeof responsibleParty, boolean>> {
    if (patientBasicInfo) {
      await this.ValidatePatientInfo(patientBasicInfo);
    }

    return await this.paperworkGeneral.fillPaperworkTelemed({
      payment,
      responsibleParty,
      requiredOnly: requiredOnly || false,
    });
  }

  async completeBooking(): Promise<void> {
    await this.locator.goToWaitingRoomButton.click();
    await expect(this.page.getByText('Please wait, call will start automatically.')).toBeVisible({ timeout: 30000 });
  }

  async cancelAppointment(): Promise<void> {
    const cancelPage = new CancelPage(this.page);
    await cancelPage.clickCancelButton();
    await cancelPage.selectCancellationReason('virtual');
  }

  // ---------------------------------------------------------------------------

  async selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>> {
    // Optional step: service category selection for Virtual Visit Check-In (walk-in)
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'virtual', visitType: 'walk-in' })) {
      await this.fillingInfo.selectFirstServiceCategory();
    }

    await this.page.getByPlaceholder('Search or select').click();
    const locationOption = this.page
      .locator('[role="option"]')
      .filter({ hasNot: this.page.locator('[aria-disabled="true"], [disabled]') }) // Exclude disabled options
      .first();
    const location = await locationOption.textContent();
    console.log('Video call location: ', location);
    await locationOption.click();
    await this.continue();

    return { locationTitle: location?.split('Working hours')[0] };
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

      // ^ since this flow is broken, run the walk-in flow instead
      await test.step('run the walk-in flow again', async () => {
        await this.page.waitForTimeout(1_000);
        await this.selectVisitAndContinue();
        await this.selectTimeLocationAndContinue();
      });

      await test.step('select existing patient', async () => {
        const patientName = this.page.getByText(`${patientBasicInfo?.firstName} ${patientBasicInfo?.lastName}`);
        await expect(patientName).toBeVisible();
        await patientName.scrollIntoViewIfNeeded();
        await patientName.click();
        await this.continue();
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
