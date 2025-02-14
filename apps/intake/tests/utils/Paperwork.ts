import { BrowserContext, Page, expect } from '@playwright/test';
import { AllStates, PatientEthnicity, PatientRace } from 'utils';
import { CommonLocatorsHelper } from './CommonLocatorsHelper';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';

export class Paperwork {
  page: Page;
  locator: Locators;
  fillingInfo: FillingInfo;
  CommonLocatorsHelper: CommonLocatorsHelper;
  context: BrowserContext;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.CommonLocatorsHelper = new CommonLocatorsHelper(page);
    this.context = page.context();
  }
  private language = ['English', 'Spanish'];
  private relationshipResponsiblePartyNotSelf = ['Legal Guardian', 'Parent', 'Other', 'Spouse'];
  private relationshipResponsiblePartySelf = 'Self';
  private relationshipConsentForms = ['Legal Guardian', 'Parent', 'Other', 'Spouse', 'Self'];
  private birthSex = ['Male', 'Female', 'Intersex'];
  getRandomState(): string {
    const randomIndex = Math.floor(Math.random() * AllStates.length);
    return AllStates[randomIndex].value;
  }
  getRandomEthnicity(): string {
    const values = Object.values(PatientEthnicity);
    return values[Math.floor(Math.random() * values.length)];
  }
  getRandomRace(): string {
    const values = Object.values(PatientRace);
    return values[Math.floor(Math.random() * values.length)];
  }
  getRandomElement(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  getRandomString(): string {
    return Math.random().toString().slice(2, 7);
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
    await expect(this.locator.flowHeading).toBeVisible();
    await expect(this.locator.flowHeading).toHaveText('Contact information');
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
    await this.locator.streetAddress.fill(`Address ${this.getRandomString()}`);
  }
  async fillStreetAddressLine2(): Promise<void> {
    await this.locator.streetAddressLine2.fill(`Address Line 2 ${this.getRandomString()}`);
  }
  async fillPatientCity(): Promise<void> {
    await this.locator.patientCity.fill(`City${this.getRandomString()}`);
  }
  async fillPatientState(): Promise<void> {
    const randomState = this.getRandomState();
    await this.locator.patientState.click();
    await this.locator.patientState.fill(randomState);
    await this.page.getByRole('option', { name: randomState }).click();
  }
  async fillPatientZip(): Promise<void> {
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
    await this.CommonLocatorsHelper.clickContinue();
    await expect(this.locator.flowHeading).toBeVisible();
    await expect(this.locator.flowHeading).toHaveText('Patient details');
  }
  async fillEthnicity(): Promise<void> {
    await this.validateAllOptions(this.locator.patientEthnicity, Object.values(PatientEthnicity), 'ethnicity');
    const randomEthnicity = this.getRandomEthnicity();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
  }
  async fillRace(): Promise<void> {
    await this.validateAllOptions(this.locator.patientRace, Object.values(PatientRace), 'race');
    const randomRace = this.getRandomRace();
    await this.page.getByRole('option', { name: randomRace }).click();
  }
  async fillPreferredLanguage(): Promise<void> {
    await this.validateAllOptions(this.locator.patientPreferredLanguage, this.language, 'language');
    const randomLanguage = this.getRandomElement(this.language);
    await this.page.getByRole('option', { name: randomLanguage }).click();
  }
  async fillPatientDetailsRequiredFields(): Promise<void> {
    await this.fillEthnicity();
    await this.fillRace();
    await this.fillPreferredLanguage();
  }
  async skipPrimaryCarePhysician(): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
  }
  async skipPhotoID(): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
  }
  async selectSelfPayPayment(): Promise<void> {
    await this.locator.selfPayOption.check();
  }
  async fillResponsiblePartyDataSelf(): Promise<void> {
    await this.fillResponsiblePartySelfRelationship();
  }
  async fillResponsiblePartyDataNotSelf(): Promise<void> {
    await this.fillResponsiblePartyNotSelfRelationship();
    await this.fillResponsiblePartyPatientName();
    await this.fillResponsiblePartyBirthSex();
    await this.fillResponsiblePartyDOB();
  }
  async fillResponsiblePartyPatientName(): Promise<void> {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    await this.locator.responsiblePartyFirstName.click();
    await this.locator.responsiblePartyFirstName.fill(firstName);
    await this.locator.responsiblePartyLastName.click();
    await this.locator.responsiblePartyLastName.fill(lastName);
  }
  async fillResponsiblePartyBirthSex(): Promise<void> {
    await this.validateAllOptions(this.locator.responsiblePartyBirthSex, this.birthSex, 'birth sex');
    const birthSex = this.getRandomElement(this.birthSex);
    await this.page.getByRole('option', { name: birthSex }).click();
  }
  async fillResponsiblePartyDOB(): Promise<void> {
    // TO DO
  }
  async fillResponsiblePartySelfRelationship(): Promise<void> {
    await this.validateAllOptions(
      this.locator.responsiblePartyRelationship,
      [this.relationshipResponsiblePartySelf],
      'responsible party self'
    );
    await this.page.getByRole('option', { name: this.relationshipResponsiblePartySelf }).click();
  }
  async fillResponsiblePartyNotSelfRelationship(): Promise<void> {
    await this.validateAllOptions(
      this.locator.responsiblePartyRelationship,
      this.relationshipResponsiblePartyNotSelf,
      'responsible party not self'
    );
    const relationship = this.getRandomElement(this.relationshipResponsiblePartyNotSelf);
    await this.page.getByRole('option', { name: relationship }).click();
  }
  async fillConsentForms(): Promise<void> {
    await this.validateAllOptions(
      this.locator.consentSignerRelationship,
      this.relationshipConsentForms,
      'consent signer'
    );
    const relationshipConsentForms = this.getRandomElement(this.relationshipConsentForms);
    await this.locator.hipaaAcknowledgement.check();
    await this.locator.consentToTreat.check();
    await this.locator.signature.click();
    await this.locator.signature.fill('Test signature');
    await this.locator.consentFullName.click();
    await this.locator.consentFullName.fill('Test consent full name');
    await this.locator.consentSignerRelationship.click();
    await this.page.getByRole('option', { name: relationshipConsentForms }).click();
  }
  async validateAllOptions(locator: any, optionsList: string[], type: string): Promise<void> {
    await locator.click();
    const options = await this.page.locator('[role="option"]').allInnerTexts();
    for (const option of optionsList) {
      if (!options.includes(option)) {
        throw new Error(`Test failed: Missing ${type} option: '${option}'`);
      }
    }
  }
}
