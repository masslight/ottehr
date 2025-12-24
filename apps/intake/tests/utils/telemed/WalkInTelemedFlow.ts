import { expect } from '@playwright/test';
import { E2E_TELEMED_LOCATION_NAME } from 'tests/specs/0_paperworkSetup/setup.spec';
import { shouldShowServiceCategorySelectionPage, uuidRegex } from 'utils';
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

    await this.page.waitForURL(/\/paperwork\//);
    const urlRegex = new RegExp(`paperwork\\/(${uuidRegex.source.slice(1, -1)})`);
    const appointmentId = this.page.url().match(urlRegex)?.[1];
    if (!appointmentId) {
      throw new Error('regex is broken or page could not load url');
    }
    return {
      patientBasicInfo,
      appointmentId,
      slotAndLocation,
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

  async additionalStepsForPrebook(): Promise<void> {}

  async selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>> {
    // Optional step: service category selection for Virtual Visit Check-In (walk-in)
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'virtual', visitType: 'walk-in' })) {
      await this.fillingInfo.selectFirstServiceCategory();
    }

    await this.page.getByPlaceholder('Search or select').click();
    const locationOption = this.page.locator('[role="option"]').getByText(E2E_TELEMED_LOCATION_NAME, { exact: true });
    const location = await locationOption.textContent();
    console.log('Video call location: ', location);
    await locationOption.click();
    await this.continue();

    return { location: location?.split('Working hours')[0] ?? null };
  }
}
