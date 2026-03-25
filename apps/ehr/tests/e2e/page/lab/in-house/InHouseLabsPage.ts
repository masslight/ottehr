import { Page } from '@playwright/test';
import { configInHouseLabDeleteButtonTestId } from 'src/features/in-house-labs/utils/test-ids';
import { dataTestIds } from '../../../../../src/constants/data-test-ids';
import { InPersonHeader } from '../../InPersonHeader';
import { SideMenu } from '../../SideMenu';
import { expectOrderInHouseLabPage } from './helpers';
import { OrderInHouseLabPage } from './OrderInHouseLabPage';

export class InHouseLabsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async clickOrderButton(): Promise<OrderInHouseLabPage> {
    await this.#page.getByTestId(dataTestIds.inHouseLabsPage.orderButton).click();
    return expectOrderInHouseLabPage(this.#page);
  }

  async countTableRows(): Promise<number> {
    const loading = this.#page.getByTestId(dataTestIds.inHouseLabsPage.loading);

    // Wait for loading text to disappear (if it ever shows up)
    await loading.waitFor({ state: 'hidden' }).catch(() => {});

    const rows = this.#page.locator(`[data-testid^="${dataTestIds.inHouseLabsPage.tableRowPrefix}"]`);
    return rows.count();
  }

  async deleteTest(testServiceRequestId: string): Promise<void> {
    // count rows in table
    const rowsBefore = await this.countTableRows();

    // click the delete button in the table row
    const deleteBtnTestId = configInHouseLabDeleteButtonTestId(testServiceRequestId);
    await this.#page.getByTestId(deleteBtnTestId).click();

    // click the delete button in the confirmation dialog
    await this.#page.getByTestId(dataTestIds.commonLabOrder.deleteDialogButton).click();

    // confirm the test has been deleted
    const rowsAfter = await this.countTableRows();
    if (rowsBefore !== rowsAfter + 1) {
      throw new Error(`Row count mismatch: before=${rowsBefore}, after=${rowsAfter}`);
    }
  }
}
