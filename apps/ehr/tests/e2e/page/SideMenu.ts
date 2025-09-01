import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectHospitalizationPage, HospitalizationPage } from './HospitalizationPage';
import { expectInHouseLabsPage, InHouseLabsPage } from './in-person/InHouseLabsPage';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './in-person/InHouseMedicationsPage';
import { expectAssessmentPage, InPersonAssessmentPage } from './in-person/InPersonAssessmentPage';
import { expectInPersonProgressNotePage, InPersonProgressNotePage } from './in-person/InPersonProgressNotePage';

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

  async clickHospitalization(): Promise<HospitalizationPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('hospitalization')).click();
    return expectHospitalizationPage(this.#page);
  }

  async clickProgressNote(): Promise<InPersonProgressNotePage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('progress-note')).click();
    return expectInPersonProgressNotePage(this.#page);
  }

  async clickAssessment(): Promise<InPersonAssessmentPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('assessment')).click();
    return expectAssessmentPage(this.#page);
  }

  async clickCompleteIntakeButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.sideMenu.completeIntakeButton).click();
  }
}
