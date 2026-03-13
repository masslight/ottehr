import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectHospitalizationPage, HospitalizationPage } from './HospitalizationPage';
import { expectHpiAndTemplatesPage, HpiAndTemplatesPage } from './HpiAndTemplatesPage';
import { AllergiesPage, expectAllergiesPage } from './in-person/AllergiesPage';
import { expectInHouseLabsPage, InHouseLabsPage } from './in-person/InHouseLabsPage';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './in-person/InHouseMedicationsPage';
import { expectAssessmentPage, InPersonAssessmentPage } from './in-person/InPersonAssessmentPage';
import { expectExamPage, InPersonExamPage } from './in-person/InPersonExamsPage';
import { expectInPersonProgressNotePage, InPersonProgressNotePage } from './in-person/InPersonProgressNotePage';
import { expectMedicationsPage, MedicationsPage } from './in-person/MedicationsPage';
import { expectScreeningPage, ScreeningPage } from './in-person/ScreeningPage';
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

  async clickInHouseMedications(): Promise<InHouseMedicationsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('in-house-medication/mar')).click();
    return expectInHouseMedicationsPage(this.#page);
  }
  async clickInHouseLabs(): Promise<InHouseLabsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('in-house-lab-orders')).click();
    return expectInHouseLabsPage(this.#page);
  }
  async clickAllergies(): Promise<AllergiesPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('allergies')).click();
    return expectAllergiesPage(this.#page);
  }
  async clickMedicalConditions(): Promise<MedicalConditionsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('medical-conditions')).click();
    return expectMedicalConditionsPage(this.#page);
  }
  async clickSurgicalHistory(): Promise<SurgicalHistoryPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('surgical-history')).click();
    return expectSurgicalHistoryPage(this.#page);
  }
  async clickHospitalization(): Promise<HospitalizationPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('hospitalization')).click();
    return expectHospitalizationPage(this.#page);
  }

  async clickCcAndIntakeNotes(): Promise<PatientInfoPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('cc-and-intake-notes')).click();
    return expectPatientInfoPage(this.#page);
  }

  async clickVitals(): Promise<VitalsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('vitals')).click();
    return expectVitalsPage(this.#page);
  }

  async clickHpiAndTemplates(): Promise<HpiAndTemplatesPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('history-of-present-illness-and-templates')).click();
    return expectHpiAndTemplatesPage(this.#page);
  }

  async clickReviewAndSign(): Promise<InPersonProgressNotePage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('review-and-sign')).click();
    return expectInPersonProgressNotePage(this.#page);
  }

  async clickAssessment(): Promise<InPersonAssessmentPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('assessment')).click();
    return expectAssessmentPage(this.#page);
  }

  async clickExam(): Promise<InPersonExamPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('examination')).click();
    return expectExamPage(this.#page);
  }

  async clickProcedures(): Promise<ProceduresPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('procedures')).click();
    return expectProceduresPage(this.#page);
  }

  async clickNursingOrders(): Promise<NursingOrdersPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('nursing-orders')).click();
    return expectNursingOrdersPage(this.#page);
  }

  async clickScreening(): Promise<ScreeningPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('screening-questions')).click();
    return expectScreeningPage(this.#page);
  }

  async clickMedications(): Promise<MedicationsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('medications')).click();
    return expectMedicationsPage(this.#page);
  }

  async clickCompleteIntakeButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.sideMenu.completeIntakeButton).click();
  }
}
