import { expect } from '@playwright/test';
import {
  BOOKING_CONFIG,
  DEPLOYED_TELEMED_LOCATIONS,
  PROJECT_NAME,
  shouldShowServiceCategorySelectionPage,
} from 'utils';
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

export class PrebookTelemedFlow extends BaseTelemedFlow {
  // flow steps:
  // - click button
  // - start visit by choosing patient
  // - click proceed to paperwork
  // - fill paperwork
  // - complete booking
  // - cancel appointment

  async clickVisitButton(): Promise<void> {
    const scheduleButton = this.page.getByTestId(dataTestIds.scheduleVirtualVisitButton);
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
  }

  async startVisitWithoutPaperwork(patient?: PatientBasicInfo): Promise<StartVisitResponse> {
    await this.selectVisitAndContinue();
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'in-person', visitType: 'prebook' })) {
      const availableCategories = BOOKING_CONFIG.serviceCategories || [];
      const firstCategory = availableCategories[0]!;

      if (firstCategory) {
        await this.page.getByText(firstCategory.display).click();
      }
    }
    const slotAndLocation = await this.selectTimeLocationAndContinue();

    let patientBasicInfo: PatientBasicInfo;
    if (patient) {
      // find and select existing patient
      const patientName = this.page.getByRole('heading', {
        name: new RegExp(`.*${patient.firstName} ${patient.lastName}.*`, 'i'),
      });
      await expect(patientName).toBeVisible();
      await patientName.scrollIntoViewIfNeeded();
      await patientName.click({ timeout: 40_000, noWaitAfter: true, force: true });
      await this.locator.clickContinueButton();

      // confirm dob
      await this.fillingInfo.fillCorrectDOB(patient.dob.m, patient.dob.d, patient.dob.y);
      await this.locator.clickContinueButton();

      // select reason for visit
      await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
      await expect(this.locator.flowHeading).toHaveText('About the patient');
      await this.fillingInfo.fillTelemedReasonForVisit();
      await this.locator.continueButton.click();

      patientBasicInfo = patient;
    } else {
      await this.locator.selectDifferentFamilyMember();
      patientBasicInfo = await this.fillNewPatientDataAndContinue();
    }
    await this.locator.clickReserveButton();

    await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
    await expect(this.locator.flowHeading).toHaveText(`Thank you for choosing ${PROJECT_NAME}!`);

    const timeBlock = this.page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock);
    await expect(timeBlock).toHaveText(slotAndLocation.selectedSlot?.fullSlot ?? '');
    await expect(this.locator.appointmentDescription).toHaveText(RegExp(slotAndLocation.location!));

    const bookingURL = this.page.url();
    console.log('Booking URL: ', bookingURL);
    const match = bookingURL.match(/visit\/([0-9a-fA-F-]+)/);
    const bookingUUID = match ? match[1] : null;

    return {
      patientBasicInfo,
      slotAndLocation,
      bookingURL,
      bookingUUID,
    };
  }

  async fillPaperwork({
    payment,
    responsibleParty,
    requiredOnly,
  }: FilledPaperworkInput): Promise<TelemedPaperworkReturn<typeof payment, typeof responsibleParty, boolean>> {
    return await this.paperworkGeneral.fillPaperworkTelemed({
      payment,
      responsibleParty,
      requiredOnly: requiredOnly || false,
    });
  }

  // proceed to paperwork

  async completeBooking(): Promise<void> {
    await this.locator.continueButton.click();
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
    const statesSelector = this.page.getByTestId(dataTestIds.scheduleVirtualVisitStatesSelector);
    await expect(statesSelector).toBeVisible();

    await statesSelector.getByRole('button').click();
    const firstAvailableState = DEPLOYED_TELEMED_LOCATIONS[0]?.name;
    if (!firstAvailableState) {
      throw new Error('No deployed telemed locations found');
    }
    const locationOption = this.page.locator('[role="option"]').getByText(firstAvailableState, { exact: true });
    const location = (await locationOption.textContent()) ?? undefined;
    await locationOption.click();
    await expect(this.locator.firstAvailableTime).toBeVisible();
    const title = await this.locator.pageTitle.textContent();
    const locationTitle = title ? title.replace('Book a visit at ', '').trim() : null;
    const selectedSlot = await this.fillingInfo.selectRandomSlot();
    await this.continue();
    return { selectedSlot: { time: selectedSlot.time, fullSlot: selectedSlot.fullSlot }, location, locationTitle };
  }
}
