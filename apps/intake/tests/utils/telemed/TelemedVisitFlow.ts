import { expect } from '@playwright/test';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { BaseTelemedFlow, SlotAndLocation, StartVisitResponse } from './BaseTelemedFlow';

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
    await this.page.getByPlaceholder('Search or select').click();
    const locationOption = this.page
      .locator('[role="option"]')
      .filter({ hasNot: this.page.locator('[aria-disabled="true"], [disabled]') }) // Exclude disabled options
      .first();
    const location = await locationOption.textContent();
    console.log('Video call location: ', location);
    await locationOption.click();
    await this.continue();

    return { location: '' };
  }
  async startVisitFullFlow(): Promise<StartVisitResponse> {
    await this.selectVisitAndContinue();
    await this.selectDifferentFamilyMemberAndContinue();
    const slotAndLocation = await this.selectTimeLocationAndContinue();
    const patientBasicInfo = await this.fillNewPatientDataAndContinue();
    await this.fillingInfo.fillContactInformation();
    await this.continue();
    await this.fillingInfo.fillPatientDetails();
    await this.continue();
    // Primary Care Physician screen here
    await this.continue();
    await this.paperwork.fillAndCheckEmptyCurrentMedications();
    await this.continue();
    await this.paperwork.fillAndCheckEmptyCurrentAllergies();
    await this.continue();
    await this.paperwork.fillAndCheckEmptyMedicalHistory();
    await this.continue();
    await this.paperwork.fillAndCheckEmptySurgicalHistory();
    await this.continue();
    // additional questions
    await this.continue();
    await this.paperwork.fillAndCheckSelfPay();
    await this.paperwork.fillAndCheckResponsiblePartyInfoAsSelf({
      firstName: patientBasicInfo.firstName,
      lastName: patientBasicInfo.lastName,
      email: patientBasicInfo.email,
      birthSex: patientBasicInfo.birthSex,
      thisEmailBelongsTo: patientBasicInfo.thisEmailBelongsTo,
      reasonForVisit: patientBasicInfo.reasonForVisit,
    });
    await this.continue();
    await this.continue(); // skip optional photo ID
    await this.continue(); // skip optional patient conditions
    await this.paperwork.fillAndCheckSchoolWorkNoteAsNone();
    await this.continue();
    await this.paperwork.fillAndCheckConsentForms();
    await this.continue();
    await this.paperwork.fillAndCheckNoInviteParticipant();
    await this.continue();
    await this.completeBooking();
    await expect(this.page.getByText('Please wait, call will start automatically.')).toBeVisible({ timeout: 30000 });
    return {
      slotAndLocation,
      patientBasicInfo,
      // todo: fix this, it was not added to the returned value in the previous version cause types were not right
      bookingURL: '',
      bookingUUID: null,
    };
  }
}
