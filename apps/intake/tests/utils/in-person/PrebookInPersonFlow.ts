import { expect } from '@playwright/test';
import { shouldShowServiceCategorySelectionPage } from 'utils';
import { CancelPage } from '../CancelPage';
import { StartVisitResponse } from '../in-person/BaseInPersonFlow';
import { InPersonPaperworkReturn } from '../Paperwork';
import { BaseInPersonFlow, FilledPaperworkInput, PatientBasicInfo } from './BaseInPersonFlow';

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
    if (patient) {
      await this.findAndSelectExistingPatient(patient);
      patientBasicInfo = patient;
    } else {
      await this.locator.selectDifferentFamilyMember();
      patientBasicInfo = await this.fillNewPatientDataAndContinue();
    }
    await this.locator.clickReserveButton();

    await this.page.waitForURL(/\/visit\//);
    const match = this.page.url().match(/visit\/([0-9a-fA-F-]+)/);
    const bookingUUID = match ? match[1] : null;
    return {
      patientBasicInfo,
      bookingUUID,
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

  async additionalStepsForPrebook(): Promise<{
    selectedSlot: string | undefined;
    location: string | null;
  }> {
    // Handle service category selection if present
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'in-person', visitType: 'prebook' })) {
      await this.fillingInfo.selectFirstServiceCategory();
    }

    await expect(this.locator.firstAvailableTime).toBeVisible();
    const title = await this.locator.pageTitle.textContent();
    const location = title ? title.replace('Book a visit at ', '').trim() : null;

    const { selectedSlot } = await this.fillingInfo.selectRandomSlot();
    return { selectedSlot, location };
  }

  // for ReservationScreen.spec.ts
  async goToReviewPage(): Promise<Omit<StartVisitResponse, 'bookingUUID'>> {
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
