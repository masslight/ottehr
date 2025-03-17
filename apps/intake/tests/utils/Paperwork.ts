import { BrowserContext, Page, expect, Locator } from '@playwright/test';
import { AllStates, PatientEthnicity, PatientRace } from 'utils';
import { CommonLocatorsHelper } from './CommonLocatorsHelper';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';

interface InsuranceRequiredData {
  firstName: string;
  lastName: string;
  relationship: string;
  birthSex: string;
  insuranceMember: string;
  policyHolderAddress: string;
  policyHolderCity: string;
  policyHolderState: string;
  policyHolderZip: string;
  paperworkDOB: string;
  insuranceCarrier: string;
}
interface InsuranceOptionalData {
  policyHolderMiddleName: string;
  policyHolderAddressLine2: string;
}
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
  private relationshipsInsurance = ['Self', 'Child', 'Parent', 'Spouse', 'Common Law Spouse', 'Injured Party', 'Other'];

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
    await expect(this.locator.flowHeading).toBeVisible({ timeout: 5000 });
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
  async checkRequiredFields(requiredFields: string, pageTitle: string, multiple: boolean): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
    if (multiple) {
      await expect(
        this.page.getByText(`Please fix the errors in the following fields to proceed: ${requiredFields}`)
      ).toBeVisible();
    } else {
      await expect(this.page.getByText(`Please fix the error in the ${requiredFields} field to proceed`)).toBeVisible();
    }
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
    await this.locator.clickContinueButton(false);
    await expect(this.locator.numberErrorText).toBeVisible();
    await number.fill('1234567890');
    await this.page.keyboard.press('Tab');
    await expect(this.locator.numberErrorText).not.toBeVisible();
  }
  async checkZipValidations(zipField: Locator): Promise<void> {
    await zipField.fill('123');
    await this.locator.clickContinueButton(false);
    await expect(this.locator.zipErrorText).toBeVisible();
    await zipField.fill('12345');
    await this.page.keyboard.press('Tab');
    await expect(this.locator.zipErrorText).not.toBeVisible();
  }
  async skipPhotoID(): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
  }
  async selectSelfPayPayment(): Promise<void> {
    await this.locator.selfPayOption.check();
  }
  async selectInsurancePayment(): Promise<void> {
    await this.locator.insuranceOption.check();
  }

  async checkPolicyAddressIsTheSameCheckbox(isSecondary: boolean): Promise<void> {
    const locators = isSecondary
      ? {
          policyHolderAddress: this.locator.secondaryPolicyHolderAddress,
          policyHolderAddressLine2: this.locator.secondaryPolicyHolderAddressLine2,
          policyHolderCity: this.locator.secondaryPolicyHolderCity,
          policyHolderState: this.locator.secondaryPolicyHolderState,
          policyHolderZip: this.locator.secondaryPolicyHolderZip,
          policyAddressIsTheSameCheckbox: this.locator.secondaryPolicyAddressIsTheSame,
        }
      : {
          policyHolderAddress: this.locator.policyHolderAddress,
          policyHolderAddressLine2: this.locator.policyHolderAddressLine2,
          policyHolderCity: this.locator.policyHolderCity,
          policyHolderState: this.locator.policyHolderState,
          policyHolderZip: this.locator.policyHolderZip,
          policyAddressIsTheSameCheckbox: this.locator.policyAddressIsTheSame,
        };
    await locators.policyAddressIsTheSameCheckbox.check();
    await expect(locators.policyHolderAddress).not.toBeVisible();
    await expect(locators.policyHolderAddressLine2).not.toBeVisible();
    await expect(locators.policyHolderCity).not.toBeVisible();
    await expect(locators.policyHolderState).not.toBeVisible();
    await expect(locators.policyHolderZip).not.toBeVisible();
    await locators.policyAddressIsTheSameCheckbox.uncheck();
    await expect(locators.policyHolderAddress).toBeVisible();
    await expect(locators.policyHolderAddressLine2).toBeVisible();
    await expect(locators.policyHolderCity).toBeVisible();
    await expect(locators.policyHolderState).toBeVisible();
    await expect(locators.policyHolderZip).toBeVisible();
  }

  async fillInsuranceRequiredFields(isSecondary: boolean): Promise<InsuranceRequiredData> {
    const firstName = 'Insurance first name';
    const lastName = 'Insurance last name';
    // Need to uncomment when issue https://github.com/masslight/ottehr/issues/1486 is fixed
    // const relationship = this.getRandomElement(this.relationshipsInsurance);
    const relationship = 'Spouse';
    const birthSex = this.getRandomElement(this.birthSex);
    const insuranceMember = 'Insurance member test';
    const policyHolderAddress = 'Test Address Insurance';
    const policyHolderCity = 'TestCity';
    const policyHolderZip = '10111';
    const policyHolderState = 'CO';
    const locators = isSecondary
      ? {
          insuranceCarrier: this.locator.secondaryInsuranceCarrier,
          insuranceCarrierOption: this.locator.secondaryInsuranceCarrierSecondOption,
          insuranceMemberID: this.locator.secondaryInsuranceMemberID,
          policyHolderFirstName: this.locator.secondaryPolicyHolderFirstName,
          policyHolderLastName: this.locator.secondaryPolicyHolderLastName,
          policyHolderDOB: this.locator.secondaryPolicyHolderDOB,
          policyHolderBirthSex: this.locator.secondaryPolicyHolderBirthSex,
          patientRelationship: this.locator.secondaryPatientRelationship,
          policyHolderAddress: this.locator.secondaryPolicyHolderAddress,
          policyHolderCity: this.locator.secondaryPolicyHolderCity,
          policyHolderState: this.locator.secondaryPolicyHolderState,
          policyHolderZip: this.locator.secondaryPolicyHolderZip,
        }
      : {
          insuranceCarrier: this.locator.insuranceCarrier,
          insuranceCarrierOption: this.locator.insuranceCarrierFirstOption,
          insuranceMemberID: this.locator.insuranceMemberID,
          policyHolderFirstName: this.locator.policyHolderFirstName,
          policyHolderLastName: this.locator.policyHolderLastName,
          policyHolderDOB: this.locator.policyHolderDOB,
          policyHolderBirthSex: this.locator.policyHolderBirthSex,
          patientRelationship: this.locator.patientRelationship,
          policyHolderAddress: this.locator.policyHolderAddress,
          policyHolderCity: this.locator.policyHolderCity,
          policyHolderState: this.locator.policyHolderState,
          policyHolderZip: this.locator.policyHolderZip,
        };
    const { paperworkDOB } = await this.fillPaperworkDOB(locators.policyHolderDOB);
    await locators.insuranceCarrier.click();
    await locators.insuranceCarrierOption.click();
    const insuranceCarrier = (await locators.insuranceCarrier.getAttribute('value')) || '';
    await locators.insuranceMemberID.fill(insuranceMember);
    await locators.policyHolderFirstName.fill(firstName);
    await locators.policyHolderLastName.fill(lastName);
    await locators.policyHolderBirthSex.click();
    await this.page.getByRole('option', { name: birthSex, exact: true }).click();
    await locators.patientRelationship.click();
    await this.page.getByRole('option', { name: relationship, exact: true }).click();
    await locators.policyHolderAddress.fill(policyHolderAddress);
    await locators.policyHolderCity.fill(policyHolderCity);
    await locators.policyHolderState.click();
    await this.page.getByRole('option', { name: policyHolderState }).click();
    await locators.policyHolderZip.fill(policyHolderZip);

    return {
      firstName,
      lastName,
      relationship,
      birthSex,
      insuranceMember,
      policyHolderAddress,
      policyHolderCity,
      policyHolderState,
      policyHolderZip,
      paperworkDOB,
      insuranceCarrier,
    };
  }
  async fillInsuranceOptionalFields(isSecondary: boolean): Promise<InsuranceOptionalData> {
    const policyHolderMiddleName = 'Insurance middle name';
    const policyHolderAddressLine2 = 'Insurance Address Line 2';
    const locators = isSecondary
      ? {
          policyHolderMiddleName: this.locator.secondaryPolicyHolderMiddleName,
          policyHolderAddressLine2: this.locator.secondaryPolicyHolderAddressLine2,
        }
      : {
          policyHolderMiddleName: this.locator.policyHolderMiddleName,
          policyHolderAddressLine2: this.locator.policyHolderAddressLine2,
        };
    await locators.policyHolderMiddleName.fill(policyHolderMiddleName);
    await locators.policyHolderAddressLine2.fill(policyHolderAddressLine2);
    return { policyHolderMiddleName, policyHolderAddressLine2 };
  }

  async fillInsuranceAllFieldsWithoutCards(): Promise<{
    insuranceRequiredData: InsuranceRequiredData;
    insuranceOptionalData: InsuranceOptionalData;
  }> {
    const insuranceRequiredData = await this.fillInsuranceRequiredFields(false);
    const insuranceOptionalData = await this.fillInsuranceOptionalFields(false);
    return { insuranceRequiredData, insuranceOptionalData };
  }
  async fillSecondaryInsuranceAllFieldsWithoutCards(): Promise<{
    insuranceRequiredData: InsuranceRequiredData;
    insuranceOptionalData: InsuranceOptionalData;
  }> {
    const insuranceRequiredData = await this.fillInsuranceRequiredFields(true);
    const insuranceOptionalData = await this.fillInsuranceOptionalFields(true);
    return { insuranceRequiredData, insuranceOptionalData };
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
    const { paperworkDOB } = await this.fillPaperworkDOB(this.locator.responsiblePartyDOBAnswer);
    return {
      relationship,
      birthSex,
      firstName: name.firstName,
      lastName: name.lastName,
      dob: paperworkDOB,
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
  async fillPaperworkDOB(dobField: Locator): Promise<{ paperworkDOB: string }> {
    await dobField.click();
    await this.locator.calendarArrowDown.click();
    const year = this.page.locator('button', { hasText: '2005' });
    await year.scrollIntoViewIfNeeded();
    await year.click();
    await this.locator.calendarDay.click();
    await this.locator.calendarButtonOK.click();
    const paperworkDOB = (await dobField.getAttribute('value')) || '';
    return { paperworkDOB };
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
  async checkImagesAreSaved(frontImage: Locator, backImage: Locator): Promise<void> {
    const today = await this.CommonLocatorsHelper.getToday();
    await expect(frontImage).toHaveText(`We already have this! It was saved on ${today}. Click to re-upload.`);
    await expect(backImage).toHaveText(`We already have this! It was saved on ${today}. Click to re-upload.`);
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
