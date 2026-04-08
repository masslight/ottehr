import { expect, Locator, Page } from '@playwright/test';
import { configCptCodeTestId, configRunAsRepeatBtnTestId } from 'src/features/in-house-labs/utils/test-ids';
import { dataTestIds } from '../../../../../src/constants/data-test-ids';
import { InPersonHeader } from '../../InPersonHeader';
import { SideMenu } from '../../SideMenu';
import { CollectSamplePage } from './CollectSamplePage';

export class OrderInHouseLabPage {
  #page: Page;
  #collectSamplePage: CollectSamplePage;

  constructor(page: Page) {
    this.#page = page;
    this.#collectSamplePage = new CollectSamplePage(this.#page);
  }

  static async createPageIsOpen(page: Page): Promise<OrderInHouseLabPage> {
    await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders/create'));
    return new OrderInHouseLabPage(page);
  }

  static async detailsPageIsOpen(page: Page): Promise<OrderInHouseLabPage> {
    await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders/.*/order-details'));
    return new OrderInHouseLabPage(page);
  }

  getServiceRequestId(): string {
    const urlPathSegments = new URL(this.#page.url()).pathname.split('/');
    // ['','in-person','<appt-id>','in-house-lab-orders','<service-request-id>','order-details']
    const serviceRequestIdIdx = urlPathSegments.indexOf('in-house-lab-orders') + 1;
    return urlPathSegments[serviceRequestIdIdx];
  }

  get error(): Locator {
    return this.#page.getByTestId(dataTestIds.orderInHouseLabPage.error);
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  get collectSamplePage(): CollectSamplePage {
    return this.#collectSamplePage;
  }
  async verifyOrderInHouseLabButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderInHouseLabButton)).toBeDisabled();
  }
  async verifyOrderAndPrintLabelButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton)).toBeDisabled();
  }
  async verifyOrderInHouseLabButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderInHouseLabButton)).toBeEnabled();
  }
  async verifyOrderAndPrintLabelButtonEnabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton)).toBeEnabled();
  }
  async clickOrderInHouseLabButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderInHouseLabButton).click();
  }
  async clickOrderAndPrintLabelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton).click();
  }

  async selectTest(testName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.testTypeField).click();
    await this.#page.getByTestId(dataTestIds.orderInHouseLabPage.testTypeList).waitFor({ state: 'visible' });

    const testOption = this.#page
      .getByTestId(dataTestIds.orderInHouseLabPage.testTypeList)
      .locator('li', { hasText: testName });

    await testOption.click();
  }

  async verifyCPTCode(CPTCode: string, testName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(configCptCodeTestId(testName)),
      `Expecting to find ${CPTCode} for test ${testName}`
    ).toHaveText(CPTCode);
  }

  async selectALabSet(labSetId: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.commonLabOrder.labSets.launchModal).click();

    const modal = this.#page.getByTestId(dataTestIds.commonLabOrder.labSets.selectionModal);
    await expect(modal).toBeVisible();
    const buttons = this.#page.locator(`[data-testid^="${dataTestIds.commonLabOrder.labSets.selectionModal}-"]`);

    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    const labSetBtn = this.#page.getByTestId(`${dataTestIds.commonLabOrder.labSets.selectionModal}-${labSetId}`);
    await expect(labSetBtn).toBeEnabled();
    await labSetBtn.click();
  }

  async clickRunAsRepeatForTest(testName: string): Promise<void> {
    const repeatBtnTestId = configRunAsRepeatBtnTestId(testName);
    const repeatBtn = await this.#page.getByTestId(repeatBtnTestId);
    await repeatBtn.click();
  }

  async confirmRunAsRepeatForTestIsChecked(testName: string): Promise<void> {
    const repeatCheckbox = this.#page.getByTestId(configRunAsRepeatBtnTestId(testName)).locator('input');

    await expect(repeatCheckbox, `Confirm that the run as repeat checkbox is true for ${testName}`).toBeChecked();
  }
}
