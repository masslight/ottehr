import { BrowserContext, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';
import { AllStates } from 'utils';

export class Paperwork {
  page: Page;
  locator: Locators;
  fillingInfo: FillingInfo;
  basePage: BasePage;
  context: BrowserContext;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.basePage = new BasePage(page);
    this.context = page.context();
  }

  getRandomState(): string {
    const randomIndex = Math.floor(Math.random() * AllStates.length);
    return AllStates[randomIndex].value;
  }
  formatPhoneNumber(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.replace(/^1?(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') || phoneNumber;
  }
  async clickProceedToPaperwork(): Promise<void> {
    await this.locator.proceedToPaperwork.click();
  }
  async checkContactInformationPageOpens(): Promise<void> {
    await this.clickProceedToPaperwork();
    await expect(this.locator.contactInformationHeading).toBeVisible();
  }
  async fillContactInformationRequiredFields(): Promise<void> {
    await this.fillStreetAddress();
    await this.fillPatientCity();
    await this.fillPatientState();
    await this.fillPatientZip();
  }
  async fillContactInformationAllFields(): Promise<void> {
    await this.fillContactInformationRequiredFields();
    await this.fillStreetAddressLine2();
    await this.fillMobileOptIn();
  }
  async fillStreetAddress(): Promise<void> {
    await this.locator.streetAddress.click();
    await this.locator.streetAddress.fill('Test address');
  }
  async fillStreetAddressLine2(): Promise<void> {
    await this.locator.streetAddressLine2.click();
    await this.locator.streetAddressLine2.fill('Test Address Line 2');
  }
  async fillPatientCity(): Promise<void> {
    await this.locator.patientCity.click();
    await this.locator.patientCity.fill('Test City');
  }
  async fillPatientState(): Promise<void> {
    const randomState = this.getRandomState();
    await this.locator.patientState.click();
    await this.locator.patientState.fill(randomState);
    await this.page.getByRole('option', { name: randomState }).click();
  }
  async fillPatientZip(): Promise<void> {
    await this.locator.patientZip.click();
    await this.locator.patientZip.fill('12345');
  }
  async fillMobileOptIn(): Promise<void> {
    await this.locator.mobileOptIn.check();
  }
  async checkEmailIsPrefilled(email: string | RegExp): Promise<void> {
    await expect(this.locator.patientEmail).toHaveValue(email);
  }
  async checkMobileIsPrefilled(mobile: string): Promise<void> {
    const formattedPhoneNumber = this.formatPhoneNumber(mobile);
    await expect(this.locator.patientNumber).toHaveValue(formattedPhoneNumber);
  }
  async checkPatientNameIsDisplayed(firstName: string, lastName: string): Promise<void> {
    await expect(this.page.getByText(`${firstName} ${lastName}`)).toBeVisible();
  }
  async checkPatientDetailsPageOpens(): Promise<void> {
    await this.basePage.clickContinue();
    await expect(this.locator.patientDetailsHeading).toBeVisible();
  }
}
