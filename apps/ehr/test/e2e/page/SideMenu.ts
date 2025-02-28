import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './InHouseMedicationsPage';
import { expectHospitalizationPage, HospitalizationPage } from './HospitalizationPage';
import { expectProgressNotePage, ProgressNotePage } from './ProgressNotePage';
import { AssessmentPage, expectAssessmentPage } from './AssessmentPage';

export class SideMenu {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickInHouseMedications(): Promise<InHouseMedicationsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('In-house Medications')).click();
    return expectInHouseMedicationsPage(this.#page);
  }

  async clickHospitalization(): Promise<HospitalizationPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('hospitalization')).click();
    return expectHospitalizationPage(this.#page);
  }

  async clickProgressNote(): Promise<ProgressNotePage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('progress-note')).click();
    return expectProgressNotePage(this.#page);
  }

  async clickAssessment(): Promise<AssessmentPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('assessment')).click();
    return expectAssessmentPage(this.#page);
  }

  async clickCompleteIntakeButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.sideMenu.completeIntakeButton).click();
  }
}
