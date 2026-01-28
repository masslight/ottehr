import { expect } from '@playwright/test';
import { BRANDING_CONFIG, LOCATION_CONFIG, shouldShowServiceCategorySelectionPage, uuidRegex } from 'utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { PatientBasicInfo } from '../BaseFlow';
import { CancelPage } from '../CancelPage';
import { TelemedPaperworkReturn } from '../Paperwork';
import { AutocompleteHelpers } from '../playwright-helpers';
import { BaseTelemedFlow, FilledPaperworkInput, SlotAndLocation, StartVisitResponse } from './BaseTelemedFlow';

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
    await this.additionalStepsForPrebook();
    const slotAndLocation = await this.selectTimeLocationAndContinue();

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

    await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
    await expect(this.locator.flowHeading).toHaveText(`Thank you for choosing ${BRANDING_CONFIG.projectName}!`);

    const timeBlock = this.page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock);
    await expect(timeBlock).toHaveText(slotAndLocation.slot?.fullSlot ?? '');
    await expect(this.locator.appointmentDescription).toHaveText(RegExp(slotAndLocation.location!));

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
      patientBasicInfo,
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

  async additionalStepsForPrebook(): Promise<void> {
    // Handle service category selection if present
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'virtual', visitType: 'prebook' })) {
      await this.fillingInfo.selectFirstServiceCategory();
    }
  }

  async selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>> {
    // Select location by name from config - pagination in zambda ensures it's in the list
    const locationName = LOCATION_CONFIG.telemedLocations[0].name;
    if (!locationName) {
      throw new Error('No deployed telemed locations found');
    }

    await AutocompleteHelpers.selectOptionByText(
      this.page,
      dataTestIds.scheduleVirtualVisitStatesSelector,
      locationName
    );

    await expect(this.locator.firstAvailableTime).toBeVisible({ timeout: 60000 });
    const title = await this.locator.pageTitle.textContent();
    const location = title ? title.replace('Book a visit at ', '').trim() : null;
    const slot = await this.fillingInfo.selectRandomSlot();
    await this.continue();
    return { slot, location };
  }
}
