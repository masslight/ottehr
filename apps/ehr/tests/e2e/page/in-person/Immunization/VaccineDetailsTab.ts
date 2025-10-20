import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AdministeredDialogue, expectAdministrationConfirmationDialogue } from './AdministrationConfirmationDialog';
import { expectMarTab, MarTab } from './MarTab';
import { OrderDetailsSection } from './OrderDetailsSection';

export class VaccineDetailsTab {
  #page: Page;
  #orderDetailsSection: OrderDetailsSection;

  constructor(page: Page) {
    this.#page = page;
    this.#orderDetailsSection = new OrderDetailsSection(this.#page);
  }

  get orderDetailsSection(): OrderDetailsSection {
    return this.#orderDetailsSection;
  }

  async enterLotNumber(lotNumber: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vaccineDetailsPage.lotNumber)
      .locator('input')
      .locator('visible=true')
      .fill(lotNumber);
  }

  async enterExpiredDate(expiredDate: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.vaccineDetailsPage.expiredDate);
    await locator.click();
    await locator.pressSequentially(expiredDate);
  }

  async enterMvxCode(mvxCode: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vaccineDetailsPage.mvxCode)
      .locator('input')
      .locator('visible=true')
      .fill(mvxCode);
  }

  async enterCvxCode(cvxCode: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vaccineDetailsPage.cvxCode)
      .locator('input')
      .locator('visible=true')
      .fill(cvxCode);
  }

  async selectCptCode(cptCode: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.cptCode).locator('input').fill(cptCode);
    await this.#page.locator('li').getByText(cptCode, { exact: false }).click();
  }

  async enterNdcCode(ndcCode: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vaccineDetailsPage.ndcCode)
      .locator('input')
      .locator('visible=true')
      .fill(ndcCode);
  }

  async clearAdministeredDate(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.administeredDate).clear();
  }

  async enterAdministeredDate(administeredDate: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.vaccineDetailsPage.administeredDate);
    await locator.click();
    await locator.pressSequentially(administeredDate);
  }

  async clearAdministeredTime(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.administeredTime).clear();
  }

  async enterAdministeredTime(administeredTime: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.vaccineDetailsPage.administeredTime);
    await locator.click();
    await locator.pressSequentially(administeredTime);
  }

  async setVisCheckboxChecked(checked: boolean): Promise<void> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.visCheckbox).locator('input').setChecked(checked);
  }

  async enterVisGivenDate(visGivenDate: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.vaccineDetailsPage.visGivenDate);
    await locator.click();
    await locator.pressSequentially(visGivenDate);
  }

  async selectRelationship(relationship: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.relationship).click();
    await this.#page.getByText(relationship, { exact: true }).click();
  }

  async enterFullName(fullName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vaccineDetailsPage.fullName)
      .locator('input')
      .locator('visible=true')
      .fill(fullName);
  }
  async enterMobile(mobile: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.vaccineDetailsPage.mobile)
      .locator('input')
      .locator('visible=true')
      .fill(mobile);
  }

  async clickAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.administeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }

  async clickNotAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.notAdministeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }

  async clickPartlyAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#page.getByTestId(dataTestIds.vaccineDetailsPage.partlyAdministeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }

  async clickMarTab(): Promise<MarTab> {
    await this.#page.getByTestId(dataTestIds.immunizationPage.marTab).click();
    return expectMarTab(this.#page);
  }
}

export async function expectVaccineDetailsTab(page: Page): Promise<VaccineDetailsTab> {
  await page.waitForURL(new RegExp(`/in-person/.*/immunization/vaccine-details`));
  await expect(page.getByTestId(dataTestIds.immunizationPage.vaccineDetailsTab)).toBeVisible();
  return new VaccineDetailsTab(page);
}
