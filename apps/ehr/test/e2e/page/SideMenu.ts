import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { ErxPage, expectErxPage } from '../specs/createMedicationOrder.spec';


export class SideMenu {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickErx(): Promise<ErxPage> {
    await this.#page.getByTestId(dataTestIds.sideMenu.sideMenuItem('eRX')).click();
    return expectErxPage(this.#page);
  }
  

 
}