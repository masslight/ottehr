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
  private pronouns = ['He/him', 'She/her', 'They/them', 'My pronouns are not listed'];
  private pointOfDiscovery = [
    'Friend/Family',
    'Been there with another family member',
    'Healthcare Professional',
    'Google/Internet search',
    'Internet ad',
    'Social media community group',
    'Webinar',
    'TV/Radio',
    'Newsletter',
    'School',
    'Drive by/Signage',
  ];
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
    await expect(this.locator.flowHeading).toBeVisible();
    await expect(this.locator.flowHeading).toHaveText('Contact information');
  }
  async fillContactInformationRequiredFields(): Promise<void> {
    await this.fillStreetAddress();
    await this.fillPatientCity();
    await this.fillPatientState();
    await this.fillPatientZip();
    await expect(this.locator.streetAddress).not.toBeEmpty();
    await expect(this.locator.patientCity).not.toBeEmpty();
    await expect(this.locator.patientState).not.toBeEmpty();
    await expect(this.locator.patientZip).not.toBeEmpty();
  }
  async fillContactInformationAllFields(): Promise<void> {
    await this.fillContactInformationRequiredFields();
    await this.fillStreetAddressLine2();
    await this.fillMobileOptIn();
  }
  async fillStreetAddress(): Promise<void> {
    const address = `Address ${this.getRandomString()}`;
    await this.locator.streetAddress.fill(address);
    await expect(this.locator.streetAddress).toHaveValue(address);
  }
  async fillStreetAddressLine2(): Promise<void> {
    const addressLine2 = `Address Line 2 ${this.getRandomString()}`;
    await this.locator.streetAddressLine2.fill(addressLine2);
    await expect(this.locator.streetAddressLine2).toHaveValue(addressLine2);
  }
  async fillPatientCity(): Promise<void> {
    const city = `City${this.getRandomString()}`;
    await this.locator.patientCity.fill(city);
    await expect(this.locator.patientCity).toHaveValue(city);
    await this.locator.streetAddress.fill(`Address ${this.getRandomString()}`);
  }
  async fillPatientState(): Promise<void> {
    const randomState = this.getRandomState();
    await this.locator.patientState.click();
    await this.locator.patientState.fill(randomState);
    await this.page.getByRole('option', { name: randomState }).click();
    await expect(this.locator.patientState).toHaveValue(randomState);
  }
  async fillPatientZip(): Promise<void> {
    const zip = '12345';
    await this.locator.patientZip.fill(zip);
    await expect(this.locator.patientZip).toHaveValue(zip);
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
  async checkCorrectPageOpens(pageTitle: string): Promise<void> {
    await expect(this.locator.flowHeading).toBeVisible();
    await expect(this.locator.flowHeading).toHaveText(pageTitle);
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
  async fillPronoun(): Promise<void> {
    await this.validateAllOptions(this.locator.patientPronouns, this.pronouns, 'pronoun');
    const randomPronoun = this.getRandomElement(this.pronouns);
    await this.page.getByRole('option', { name: randomPronoun }).click();
  }
  async fillNotListedPronouns(): Promise<void> {
    await this.validateAllOptions(this.locator.patientPronouns, this.pronouns, 'pronoun');
    await this.page.getByRole('option', { name: 'My pronouns are not listed' }).click();
    await expect(this.locator.patientMyPronounsLabel).toBeVisible();
    await expect(this.locator.patientMyPronounsInput).toBeVisible();
    await this.locator.patientMyPronounsInput.fill('Not listed pronouns');
  }
  async fillPointOfDiscovery(): Promise<void> {
    await this.validateAllOptions(this.locator.patientPointOfDiscovery, this.pointOfDiscovery, 'point of discovery');
    const randomPoint = this.getRandomElement(this.pointOfDiscovery);
    await this.page.getByRole('option', { name: randomPoint }).click();
  }
  async fillPreferredLanguage(): Promise<void> {
    await this.validateAllOptions(this.locator.patientPreferredLanguage, this.language, 'language');
    const randomLanguage = this.getRandomElement(this.language);
    await this.page.getByRole('option', { name: randomLanguage }).click();
  }
  async checkRequiredFields(requiredFields: string, pageTitle: string): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
    await expect(
      this.page.getByText(`Please fix the errors in the following fields to proceed: ${requiredFields}`)
    ).toBeVisible();
    await this.CommonLocatorsHelper.clickContinue();
    await expect(this.locator.flowHeading).toHaveText(pageTitle);
  }
  async fillPatientDetailsRequiredFields(): Promise<void> {
    await this.fillEthnicity();
    await this.fillRace();
    await this.fillPreferredLanguage();
  }
  async fillPatientDetailsAllFields(): Promise<void> {
    await this.fillEthnicity();
    await this.fillRace();
    await this.fillPronoun();
    await this.fillPointOfDiscovery();
    await this.fillPreferredLanguage();
  }
  async skipPrimaryCarePhysician(): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
  }
  async fillPrimaryCarePhysician(): Promise<{
    firstName: string;
    lastName: string;
    pcpAddress: string;
    pcpName: string;
    formattedPhoneNumber: string;
  }> {
    const firstName = `First name test`;
    const lastName = `Last name test`;
    const pcpAddress = `PCP address test`;
    const pcpName = `PCP name test`;
    const pcpNumber = '1234567890';
    const formattedPhoneNumber = this.formatPhoneNumber(pcpNumber);
    await this.locator.pcpFirstName.fill(firstName);
    await expect(this.locator.pcpFirstName).toHaveValue(firstName);
    await this.locator.pcpLastName.fill(lastName);
    await expect(this.locator.pcpLastName).toHaveValue(lastName);
    await this.locator.pcpAddress.fill(pcpAddress);
    await expect(this.locator.pcpAddress).toHaveValue(pcpAddress);
    await this.locator.pcpPractice.fill(pcpName);
    await expect(this.locator.pcpPractice).toHaveValue(pcpName);
    await this.locator.pcpNumber.fill(pcpNumber);
    await expect(this.locator.pcpNumber).toHaveValue(formattedPhoneNumber);
    return { firstName, lastName, pcpAddress, pcpName, formattedPhoneNumber };
  }
  async checkPhoneValidations(number: any): Promise<void> {
    await number.fill('123');
    await this.locator.clickContinueButton();
    await expect(this.locator.numberErrorText).toBeVisible();
    await number.fill('1234567890');
    await this.page.keyboard.press('Tab');
    await expect(this.locator.numberErrorText).not.toBeVisible();
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
  async fillResponsiblePartyDataNotSelf(): Promise<{
    relationship: string;
    birthSex: string;
    firstName: string;
    lastName: string;
    dob: string;
  }> {
    const { relationship } = await this.fillResponsiblePartyNotSelfRelationship();
    const name = await this.fillResponsiblePartyPatientName();
    const { birthSex } = await this.fillResponsiblePartyBirthSex();
    const { responsiblePartyDOB } = await this.fillResponsiblePartyDOB();
    return {
      relationship,
      birthSex,
      firstName: name.firstName,
      lastName: name.lastName,
      dob: responsiblePartyDOB,
    };
  }
  async fillResponsiblePartyPatientName(): Promise<{ firstName: string; lastName: string }> {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    await this.locator.responsiblePartyFirstName.click();
    await this.locator.responsiblePartyFirstName.fill(firstName);
    await this.locator.responsiblePartyLastName.click();
    await this.locator.responsiblePartyLastName.fill(lastName);
    return { firstName, lastName };
  }
  async fillResponsiblePartyBirthSex(): Promise<{ birthSex: string }> {
    await this.validateAllOptions(this.locator.responsiblePartyBirthSex, this.birthSex, 'birth sex');
    const birthSex = this.getRandomElement(this.birthSex);
    await this.page.getByRole('option', { name: birthSex, exact: true }).click();
    return { birthSex };
  }
  async fillResponsiblePartyDOB(): Promise<{ responsiblePartyDOB: string }> {
    await this.locator.responsiblePartyDOBAnswer.click();
    await this.locator.responsiblePartyCalendarArrowDown.click();
    const year = this.page.getByText('2005');
    await year.scrollIntoViewIfNeeded();
    await year.click();
    await this.locator.responsiblePartyCalendarDay.click();
    await this.locator.responsiblePartyCalendarButtonOK.click();
    const responsiblePartyDOB = (await this.locator.responsiblePartyDOBAnswer.getAttribute('value')) || '';
    return { responsiblePartyDOB };
  }
  async fillResponsiblePartySelfRelationship(): Promise<void> {
    await this.validateAllOptions(
      this.locator.responsiblePartyRelationship,
      [this.relationshipResponsiblePartySelf],
      'responsible party self'
    );
    await this.page.getByRole('option', { name: this.relationshipResponsiblePartySelf }).click();
  }
  async fillResponsiblePartyNotSelfRelationship(): Promise<{ relationship: string }> {
    await this.validateAllOptions(
      this.locator.responsiblePartyRelationship,
      this.relationshipResponsiblePartyNotSelf,
      'responsible party not self'
    );
    const relationship = this.getRandomElement(this.relationshipResponsiblePartyNotSelf);
    await this.page.getByRole('option', { name: relationship }).click();
    return { relationship };
  }
  async checkImagesAreSaved(): Promise<void> {
    const today = await this.CommonLocatorsHelper.getToday();
    await expect(this.locator.photoIdFrontImage).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    await expect(this.locator.photoIdBackImage).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
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
