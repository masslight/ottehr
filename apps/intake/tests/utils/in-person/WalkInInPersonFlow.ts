import { uuidRegex } from 'utils/lib/validation/regex';
import { CancelPage } from '../CancelPage';
import { InPersonPaperworkReturn } from '../Paperwork';
import {
  BaseInPersonFlow,
  FilledPaperworkInput,
  PatientBasicInfo,
  SlotAndLocation,
  StartVisitResponse,
} from './BaseInPersonFlow';

export class WalkInInPersonFlow extends BaseInPersonFlow {
  // flow steps:
  // - click button
  // - start visit by choosing patient
  // - fill paperwork
  // - complete booking
  // - cancel appointment

  async clickVisitButton(): Promise<void> {
    await this.locator.startInPersonVisitButton.click();
  }

  async startVisitWithoutPaperwork(patient?: PatientBasicInfo): Promise<StartVisitResponse> {
    await this.selectVisitAndContinue();

    let patientBasicInfo: PatientBasicInfo;
    if (patient) {
      await this.findAndSelectExistingPatient(patient);
      patientBasicInfo = patient;
    } else {
      await this.locator.selectDifferentFamilyMember();
      patientBasicInfo = await this.fillNewPatientDataAndContinue();
    }
    await this.locator.confirmWalkInButton.click();

    await this.page.waitForURL(/\/visit\//);
    const urlRegex = new RegExp(`visit\\/(${uuidRegex.source.slice(1, -1)})`);
    const appointmentId = this.page.url().match(urlRegex)?.[1];
    if (!appointmentId) {
      throw new Error('regex is broken or page could not load url');
    }
    return {
      patientBasicInfo,
      appointmentId,
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
    return {
      slot: undefined,
      location: null,
    };
  }
}
