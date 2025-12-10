import test, { expect } from '@playwright/test';
import { shouldShowServiceCategorySelectionPage } from 'utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { BaseTelemedFlow, PatientBasicInfo, SlotAndLocation, StartVisitResponse } from './BaseTelemedFlow';

export class TelemedVisitFlow extends BaseTelemedFlow {
  async clickVisitButton(): Promise<void> {
    const scheduleButton = this.page.getByTestId(dataTestIds.startVirtualVisitButton);
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
  }
  async completeBooking(): Promise<void> {
    await this.locator.goToWaitingRoomButton.click();
  }
  async selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>> {
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'telemed', visitType: 'prebook' })) {
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
  async startVisitFullFlow(checkFlow = false): Promise<StartVisitResponse & { stateValue: string }> {
    await this.selectVisitAndContinue();
    const slotAndLocation = await this.selectTimeLocationAndContinue();
    await this.selectDifferentFamilyMemberAndContinue();
    const patientBasicInfo = await this.fillNewPatientDataAndContinue();
    // await this.page.waitForURL(/\/paperwork/);
    const bookingURL = this.page.url();
    console.log('Booking URL: ', bookingURL);
    const match = bookingURL.match(/paperwork\/([0-9a-fA-F-]+)/);
    const bookingUUID = match ? match[1] : null;
    await this.locator.confirmWalkInButton.click();

    if (checkFlow) {
      // skip extra steps if not specifically requested to speed up flow
      await this.ValidatePatientInfo(patientBasicInfo);
    }

    const { stateValue } = await this.paperworkGeneral.fillContactInformationRequiredFields();
    await this.continue();
    await this.paperworkGeneral.fillPatientDetailsTelemedAllFields();
    await this.continue();
    // Primary Care Physician screen here
    await this.continue();
    // Preferred pharmacy screen here
    await this.continue();
    await this.paperwork.fillAndCheckEmptyCurrentMedications();
    await this.continue();
    await this.paperwork.fillAndCheckEmptyCurrentAllergies();
    await this.continue();
    await this.paperwork.fillAndCheckEmptyMedicalHistory();
    await this.continue();
    await this.paperwork.fillAndCheckEmptySurgicalHistory();
    await this.continue();
    // Additional questions screen here
    await this.continue();
    await this.paperwork.fillAndCheckSelfPay();
    await this.paperwork.fillAndAddCreditCard();
    await this.continue();
    await this.paperworkGeneral.fillResponsiblePartyDataSelf();
    await this.continue();
    // Photo ID screen here
    await this.continue();
    // Patient conditions screen here
    await this.continue();
    await this.paperwork.fillAndCheckSchoolWorkNoteAsNone();
    await this.continue();
    await this.paperwork.fillAndCheckConsentForms();
    await this.continue();
    await this.paperwork.fillAndCheckNoInviteParticipant();
    await this.continue();
    await this.completeBooking();
    await expect(this.page.getByText('Please wait, call will start automatically.')).toBeVisible({ timeout: 30000 });
    await this.page.waitForTimeout(1_000);
    return {
      slotAndLocation,
      patientBasicInfo,
      bookingURL,
      bookingUUID,
      stateValue,
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
