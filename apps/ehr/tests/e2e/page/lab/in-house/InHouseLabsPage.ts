import { expect, Page } from '@playwright/test';
import { configInHouseLabDeleteButtonTestId } from 'src/features/in-house-labs/utils/test-ids';
import { dataTestIds } from '../../../../../src/constants/data-test-ids';
import { InPersonHeader } from '../../InPersonHeader';
import { SideMenu } from '../../SideMenu';
import { OrderInHouseLabPage } from './OrderInHouseLabPage';

export class InHouseLabsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  static async isOpen(page: Page): Promise<InHouseLabsPage> {
    await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders'));
    await expect(page.getByTestId(dataTestIds.inHouseLabsPage.title)).toBeVisible();
    return new InHouseLabsPage(page);
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async clickOrderButton(): Promise<OrderInHouseLabPage> {
    await this.#page.getByTestId(dataTestIds.inHouseLabsPage.orderButton).click();
    return OrderInHouseLabPage.createPageIsOpen(this.#page);
  }

  async countTableRows(): Promise<number> {
    const loading = this.#page.getByTestId(dataTestIds.inHouseLabsPage.loading);

    // Wait for loading text to disappear (if it ever shows up)
    await loading.waitFor({ state: 'hidden' }).catch(() => {});

    // no labs text will be present if there are no labs
    const noLabsMessage = this.#page.getByTestId(dataTestIds.inHouseLabsPage.noLabsMessage);

    if (await noLabsMessage.isVisible()) {
      return 0;
    }

    // else there will be one or more rows visible
    const rows = this.#page.locator(`[data-testid^="${dataTestIds.inHouseLabsPage.tableRowPrefix}"]`);
    await rows
      .first()
      .waitFor({ state: 'attached' })
      .catch(() => {});

    return rows.count();
  }

  async deleteTest(testServiceRequestId: string): Promise<void> {
    // count rows in table
    const rowsBefore = await this.countTableRows();

    // click the delete button in the table row
    const deleteBtnTestId = configInHouseLabDeleteButtonTestId(testServiceRequestId);
    await this.#page.getByTestId(deleteBtnTestId).click();

    // click the delete button in the confirmation dialog
    await this.#page.getByTestId(dataTestIds.commonLabOrder.deleteDialogButton).waitFor({ state: 'visible' });
    await this.#page.getByTestId(dataTestIds.commonLabOrder.deleteDialogButton).click();

    // wait for the "Delete Lab Order" modal to close before checking row count
    await this.#page.getByTestId(dataTestIds.commonLabOrder.deleteDialog).waitFor({ state: 'hidden' });

    // confirm the test has been deleted
    const rowsAfter = await this.countTableRows();
    await expect(rowsBefore - 1, `rowsBefore: ${rowsBefore}, rowsAfter: ${rowsAfter}`).toBe(rowsAfter);
  }
}
