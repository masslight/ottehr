import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectInHouseMedicationsPage, InHouseMedicationsPage } from './InHouseMedicationsPage';



export class SideMenu {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickInHouseMedications(): Promise<InHouseMedicationsPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('In-house Medications')).click();
    return expectInHouseMedicationsPage(this.#page);
  }
  
  async clickAssessment(): Promise<AssessmentPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('assessment')).click();
    return expectAssessmentPage(this.#page);
  }
 
}