import { Locator, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectHospitalizationPage, HospitalizationPage } from './HospitalizationPage';
import { expectHpiAndTemplatesPage, HpiAndTemplatesPage } from './HpiAndTemplatesPage';
import { AllergiesPage, expectAllergiesPage } from './in-person/AllergiesPage';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './in-person/InHouseMedicationsPage';
import { expectAssessmentPage, InPersonAssessmentPage } from './in-person/InPersonAssessmentPage';
import { expectExamPage, InPersonExamPage } from './in-person/InPersonExamsPage';
import { expectInPersonProgressNotePage, InPersonProgressNotePage } from './in-person/InPersonProgressNotePage';
import { expectMedicationsPage, MedicationsPage } from './in-person/MedicationsPage';
import { expectReviewOfSystemsPage, ReviewOfSystemsPage } from './in-person/ReviewOfSystemsPage';
import { expectScreeningPage, ScreeningPage } from './in-person/ScreeningPage';
import { InHouseLabsPage } from './lab';
import { ExternalLabsPage } from './lab/external/ExternalLabsPage';
import { expectMedicalConditionsPage, MedicalConditionsPage } from './MedicalConditionsPage';
import { expectNursingOrdersPage, NursingOrdersPage } from './NursingOrdersPage';
import { expectPatientInfoPage, PatientInfoPage } from './PatientInfo';
import { expectProceduresPage, ProceduresPage } from './ProceduresPage';
import { expectSurgicalHistoryPage, SurgicalHistoryPage } from './SurgicalHistoryPage';
import { expectVitalsPage, VitalsPage } from './VitalsPage';

export class SideMenu {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  /**
   * Snackbar toasts anchor to the bottom-left corner of the screen, directly on top of
   * the lower side menu items, and notistack pauses their auto-hide countdown while the
   * browser window is blurred — the steady state for parallel headless runs — so a toast
   * can block a menu item indefinitely. If a normal click can't get through, let pointer
   * events pass through toasts and try once more; any other overlay (dialog, backdrop)
   * will still fail the retry.
   */
  async #click(locator: Locator): Promise<void> {
    try {
      await locator.click({ timeout: 15_000 });
    } catch {
      await this.#page.addStyleTag({
        content: '.notistack-SnackbarContainer, .notistack-SnackbarContainer * { pointer-events: none !important; }',
      });
      await locator.click();
    }
  }

  async #clickMenuItem(item: string): Promise<void> {
    await this.#click(this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem(item)));
  }

  async clickInHouseMedications(): Promise<InHouseMedicationsPage> {
    await this.#clickMenuItem('in-house-medication/mar');
    return expectInHouseMedicationsPage(this.#page);
  }
  async clickInHouseLabs(): Promise<InHouseLabsPage> {
    await this.#clickMenuItem('in-house-lab-orders');
    return InHouseLabsPage.isOpen(this.#page);
  }
  async clickAllergies(): Promise<AllergiesPage> {
    await this.#clickMenuItem('allergies');
    return expectAllergiesPage(this.#page);
  }
  async clickMedicalConditions(): Promise<MedicalConditionsPage> {
    await this.#clickMenuItem('medical-conditions');
    return expectMedicalConditionsPage(this.#page);
  }
  async clickSurgicalHistory(): Promise<SurgicalHistoryPage> {
    await this.#clickMenuItem('surgical-history');
    return expectSurgicalHistoryPage(this.#page);
  }
  async clickHospitalization(): Promise<HospitalizationPage> {
    await this.#clickMenuItem('hospitalization');
    return expectHospitalizationPage(this.#page);
  }

  async clickCcAndIntakeNotes(): Promise<PatientInfoPage> {
    await this.#clickMenuItem('cc-and-intake-notes');
    return expectPatientInfoPage(this.#page);
  }

  async clickVitals(): Promise<VitalsPage> {
    await this.#clickMenuItem('vitals');
    return expectVitalsPage(this.#page);
  }

  async clickHpiAndTemplates(): Promise<HpiAndTemplatesPage> {
    await this.#clickMenuItem('history-of-present-illness-and-templates');
    return expectHpiAndTemplatesPage(this.#page);
  }

  async clickReviewAndSign(): Promise<InPersonProgressNotePage> {
    await this.#clickMenuItem('review-and-sign');
    return expectInPersonProgressNotePage(this.#page);
  }

  async clickAssessment(): Promise<InPersonAssessmentPage> {
    await this.#clickMenuItem('assessment');
    return expectAssessmentPage(this.#page);
  }

  async clickExam(): Promise<InPersonExamPage> {
    await this.#clickMenuItem('examination');
    return expectExamPage(this.#page);
  }

  async clickProcedures(): Promise<ProceduresPage> {
    await this.#clickMenuItem('procedures');
    return expectProceduresPage(this.#page);
  }

  async clickNursingOrders(): Promise<NursingOrdersPage> {
    await this.#clickMenuItem('nursing-orders');
    return expectNursingOrdersPage(this.#page);
  }

  async clickReviewOfSystems(): Promise<ReviewOfSystemsPage> {
    await this.#clickMenuItem('review-of-systems');
    return expectReviewOfSystemsPage(this.#page);
  }

  async clickScreening(): Promise<ScreeningPage> {
    await this.#clickMenuItem('screening-questions');
    return expectScreeningPage(this.#page);
  }

  async clickMedications(): Promise<MedicationsPage> {
    await this.#clickMenuItem('medications');
    return expectMedicationsPage(this.#page);
  }

  async clickCompleteIntakeButton(): Promise<void> {
    await this.#click(this.#page.getByTestId(dataTestIds.sideMenu.completeIntakeButton));
  }

  async clickExternalLabs(): Promise<ExternalLabsPage> {
    await this.#clickMenuItem('external-lab-orders');
    return ExternalLabsPage.isOpen(this.#page);
  }
}
