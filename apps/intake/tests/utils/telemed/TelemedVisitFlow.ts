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
    const slotAndLocation = await this.selectTimeLocationAndContinue();
    await this.selectDifferentFamilyMemberAndContinue();
    const patientBasicInfo = await this.fillNewPatientDataAndContinue();
    // await this.page.waitForURL(/\/paperwork/);
    const bookingURL = this.page.url();
    console.log('Booking URL: ', bookingURL);
    const match = bookingURL.match(/paperwork\/([0-9a-fA-F-]+)/);
    const bookingUUID = match ? match[1] : null;
    await this.locator.confirmWalkInButton.click();
    await this.paperworkGeneral.fillContactInformationRequiredFields();
    await this.continue();
    await this.paperworkGeneral.fillPatientDetailsTelemedAllFields();
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
    await this.paperworkGeneral.fillResponsiblePartyDataSelf();
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
      bookingURL,
      bookingUUID,
    };
  }
}
