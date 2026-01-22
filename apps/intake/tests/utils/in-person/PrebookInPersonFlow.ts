import { expect } from '@playwright/test';
import { dataTestIds } from 'src/helpers/data-test-ids';
import { BOOKING_CONFIG, LOCATION_CONFIG, shouldShowServiceCategorySelectionPage, uuidRegex } from 'utils';
import { PatientBasicInfo } from '../BaseFlow';
import { CancelPage } from '../CancelPage';
import { SlotAndLocation, StartVisitResponse } from '../in-person/BaseInPersonFlow';
import { InPersonPaperworkReturn } from '../Paperwork';
import { BaseInPersonFlow, FilledPaperworkInput } from './BaseInPersonFlow';

export class PrebookInPersonFlow extends BaseInPersonFlow {
  // flow steps:
  // - click button
  // - start visit by choosing patient
  // - fill paperwork
  // - complete booking
  // - cancel appointment

  async clickVisitButton(): Promise<void> {
    await this.locator.scheduleInPersonVisitButton.click();
  }

  async startVisitWithoutPaperwork(patient?: PatientBasicInfo): Promise<StartVisitResponse> {
    await this.selectVisitAndContinue();
    const slotAndLocation = await this.additionalStepsForPrebook();

    let patientBasicInfo: PatientBasicInfo;

    if (process.env.SMOKE_TEST === 'true') {
      try {
        patient = await this.findTestPatient();
      } catch {
        console.warn('Test patient not found, proceeding to create a new patient.');
      }
    }

    if (patient) {
      await this.findAndSelectExistingPatient(patient);
      patientBasicInfo = patient;
    } else {
      await this.locator.selectDifferentFamilyMember();
      patientBasicInfo = await this.fillNewPatientDataAndContinue();
    }
    await this.locator.clickReserveButton();

    await this.page.waitForURL(/\/visit\//);
    const urlRegex = new RegExp(`visit\\/(${uuidRegex.source.slice(1, -1)})`);
    const appointmentId = this.page.url().match(urlRegex)?.[1];
    if (!appointmentId) {
      throw new Error('regex is broken or page could not load url');
    }
    return {
      patientBasicInfo,
      appointmentId,
      slotAndLocation,
      slotDetails: this.slotDetails,
    };
  }

  async fillPaperwork({
    payment,
    responsibleParty,
    requiredOnly,
  }: FilledPaperworkInput): Promise<InPersonPaperworkReturn<typeof payment, typeof responsibleParty, boolean>> {
    return await this.paperworkGeneral.fillPaperworkInPerson({
      payment,
      responsibleParty,
      requiredOnly: requiredOnly || false,
    });
  }

  async completeBooking(): Promise<void> {
    await this.locator.continueButton.click();
  }

  async cancelAppointment(): Promise<void> {
    const cancelPage = new CancelPage(this.page);
    await cancelPage.clickCancelButton();
    await cancelPage.selectCancellationReason('in-person');
  }

  // ---------------------------------------------------------------------------

  async additionalStepsForPrebook(): Promise<SlotAndLocation> {
    // Handle service category selection if present
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'in-person', visitType: 'prebook' })) {
      await this.fillingInfo.selectFirstServiceCategory();
    }

    if (BOOKING_CONFIG.inPersonPrebookRoutingParams.some((param) => param.key === 'bookingOn') === false) {
      // if there is no bookingOn param, the location selector will be presented
      return this.selectTimeLocationAndContinue();
    }

    await expect(this.locator.firstAvailableTime).toBeVisible({ timeout: 60000 });
    const title = await this.locator.pageTitle.textContent();
    const locationTitle = title ? title.replace('Book a visit at ', '').trim() : null;

    const { slot } = await this.fillingInfo.selectRandomSlot();
    expect(slot, { message: 'No slot was selected' }).toBeTruthy();
    return { slot, location: locationTitle };
  }

  async selectTimeLocationAndContinue(): Promise<SlotAndLocation> {
    const statesSelector = this.page.getByTestId(dataTestIds.scheduleVirtualVisitStatesSelector);
    await expect(statesSelector).toBeVisible();

    await statesSelector.getByRole('button').click();
    const firstAvailableState = LOCATION_CONFIG.inPersonLocations[0]?.name;
    if (!firstAvailableState) {
      throw new Error('No deployed in-person locations found');
    }
    const locationOption = this.page.locator('[role="option"]').getByText(firstAvailableState, { exact: true });
    await locationOption.click();
    await expect(this.locator.firstAvailableTime).toBeVisible({ timeout: 60000 });
    const title = await this.locator.pageTitle.textContent();
    const location = title ? title.replace('Book a visit at ', '').trim() : null;
    const { slot } = await this.fillingInfo.selectRandomSlot();
    expect(slot, { message: 'No slot was selected' }).toBeTruthy();
    await this.continue();
    return { slot, location };
  }

  // for ReservationScreen.spec.ts
  async goToReviewPage(): Promise<Omit<StartVisitResponse, 'appointmentId'>> {
    await this.selectVisitAndContinue();
    const slotAndLocation = await this.additionalStepsForPrebook();

    await this.locator.selectDifferentFamilyMember();
    const patientBasicInfo = await this.fillNewPatientDataAndContinue();

    return {
      patientBasicInfo,
      slotAndLocation,
      slotDetails: this.slotDetails,
    };
  }
}
