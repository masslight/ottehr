import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AdministeredDialogue, expectAdministrationConfirmationDialogue } from './AdministrationConfirmationDialog';
import { expectMarTab, MarTab } from './MarTab';
import { OrderSentencesSection } from './OrderSentencesSection';

export class VaccineDetailsTab {
  #page: Page;
  // The vaccine-details tab renders one card per non-cancelled order, sorted most-recent first.
  // Scope all in-card fields and buttons to the first card so the section stays unambiguous when
  // earlier tests have left administered orders behind on a shared appointment.
  #root: Locator;
  #orderDetailsSection: OrderSentencesSection;

  constructor(page: Page) {
    this.#page = page;
    this.#root = page.getByTestId(dataTestIds.immunizationPage.vaccineDetailsCard).first();
    this.#orderDetailsSection = new OrderSentencesSection(this.#root);
  }

  get orderDetailsSection(): OrderSentencesSection {
    return this.#orderDetailsSection;
  }

  async enterLotNumber(lotNumber: string): Promise<void> {
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.lotNumber).fill(lotNumber);
  }

  async enterExpiredDate(expiredDate: string): Promise<void> {
    const locator = this.#root.getByTestId(dataTestIds.vaccineDetailsPage.expiredDate);
    await locator.click();
    await locator.pressSequentially(expiredDate);
  }

  async selectCptCode(cptCode: string): Promise<void> {
    // The CPT codes blank opens the code search in a popover, which stays open for more codes.
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.cptCode).click();
    await this.#page.getByLabel('Search CPT / HCPCS codes').fill(cptCode);
    await this.#page.locator('li').getByText(cptCode, { exact: false }).click();
    await this.#page.keyboard.press('Escape');
  }

  async enterNdcCode(ndcCode: string): Promise<void> {
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.ndcCode).fill(ndcCode);
  }

  async clearAdministeredDate(): Promise<void> {
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.administeredDate).clear();
  }

  async enterAdministeredDate(administeredDate: string): Promise<void> {
    const locator = this.#root.getByTestId(dataTestIds.vaccineDetailsPage.administeredDate);
    await locator.click();
    await locator.pressSequentially(administeredDate);
  }

  async clearAdministeredTime(): Promise<void> {
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.administeredTime).clear();
  }

  async enterAdministeredTime(administeredTime: string): Promise<void> {
    const locator = this.#root.getByTestId(dataTestIds.vaccineDetailsPage.administeredTime);
    await locator.click();
    await locator.pressSequentially(administeredTime);
  }

  /** "VIS given to the patient on [date]": the date is what says the VIS was given. */
  async enterVisGivenDate(visGivenDate: string): Promise<void> {
    const locator = this.#root.getByTestId(dataTestIds.vaccineDetailsPage.visGivenDate);
    await locator.click();
    await locator.pressSequentially(visGivenDate);
  }

  async clickAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.administeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }

  async clickNotAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.notAdministeredButton).click();
    return expectAdministrationConfirmationDialogue(this.#page);
  }

  async clickPartlyAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#root.getByTestId(dataTestIds.vaccineDetailsPage.partlyAdministeredButton).click();
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
