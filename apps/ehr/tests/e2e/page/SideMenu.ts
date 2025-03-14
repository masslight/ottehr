import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './InHouseMedicationsPage';
import { expectHospitalizationPage, HospitalizationPage } from './HospitalizationPage';
import { expectProgressNotePage, InPersonProgressNotePage } from './InPersonProgressNotePage';
import { InPersonAssessmentPage, expectAssessmentPage } from './InPersonAssessmentPage';

export class SideMenu {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickInHouseMedications(): Promise<InHouseMedicationsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('in-house-medication/mar')).click();
    return expectInHouseMedicationsPage(this.#page);
  }

  async clickHospitalization(): Promise<HospitalizationPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('hospitalization')).click();
    return expectHospitalizationPage(this.#page);
  }

  async clickProgressNote(): Promise<InPersonProgressNotePage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('progress-note')).click();
    return expectProgressNotePage(this.#page);
  }

  async clickAssessment(): Promise<InPersonAssessmentPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('assessment')).click();
    return expectAssessmentPage(this.#page);
  }

  async clickCompleteIntakeButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.sideMenu.completeIntakeButton).click();
  }
}
