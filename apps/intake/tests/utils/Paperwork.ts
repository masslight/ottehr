import { BrowserContext, expect, Locator, Page } from '@playwright/test';
import { AllStates, PatientEthnicity, PatientRace } from 'utils';
import { CommonLocatorsHelper } from './CommonLocatorsHelper';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';
import { PaperworkTelemed } from './telemed/Paperwork';
import { UploadDocs } from './UploadDocs';

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

interface PatientDetailsData {
  randomEthnicity: string;
  randomRace: string;
  randomPronoun: string;
  randomPoint: string;
  randomLanguage: string;
}
interface PrimaryCarePhysicianData {
  firstName: string;
  lastName: string;
  pcpAddress: string;
  pcpName: string;
  formattedPhoneNumber: string;
}

interface ResponsibleParty {
  relationship: string;
  birthSex: string;
  firstName: string;
  lastName: string;
  dob: string;
  address1: string;
  additionalAddress: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
}

interface TelemedPaperworkData {
  filledValue: string;
  selectedValue: string;
}

interface Flags {
  covid: string;
  test: string;
  travel: string;
}

export const PATIENT_ZIP = '12345';
export const PATIENT_ADDRESS = 'Patient address';
export const PATIENT_ADDRESS_LINE_2 = 'Patient address line 2';
export const PATIENT_CITY = 'PatientCity';
export const RELATIONSHIP_RESPONSIBLE_PARTY_SELF = 'Self';
export const PHONE_NUMBER = '1234567890';
export const EMAIL = 'ibenham+knownothing@masslight.com';
export const CARD_NUMBER = '4242424242424242';
export const CARD_CVV = '123';
export const CARD_EXP_DATE = '11/30';

export class Paperwork {
  page: Page;
  locator: Locators;
  fillingInfo: FillingInfo;
  CommonLocatorsHelper: CommonLocatorsHelper;
  context: BrowserContext;
  uploadPhoto: UploadDocs;
  paperworkTelemed: PaperworkTelemed;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.CommonLocatorsHelper = new CommonLocatorsHelper(page);
    this.uploadPhoto = new UploadDocs(page);
    this.paperworkTelemed = new PaperworkTelemed(page);
    this.context = page.context();
  }
  private language = ['English', 'Spanish'];
  private relationshipResponsiblePartyNotSelf = ['Legal Guardian', 'Parent', 'Other', 'Spouse'];
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
  async fillPaperworkAllFieldsInPerson(
    payment: string,
    responsibleParty: string
  ): Promise<{
    stateValue: string;
    patientDetailsData: PatientDetailsData;
    pcpData: PrimaryCarePhysicianData;
    insuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null;
    secondaryInsuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null;
    responsiblePartyData: ResponsibleParty | null;
  }> {
    const { stateValue } = await this.fillContactInformationAllFields();
    await this.locator.clickContinueButton();
    const patientDetailsData = await this.fillPatientDetailsAllFields();
    await this.locator.clickContinueButton();
    const pcpData = await this.fillPrimaryCarePhysician();
    await this.locator.clickContinueButton();
    let insuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null = null;
    let secondaryInsuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null = null;
    if (payment === 'insurance') {
      await this.selectInsurancePayment();
      insuranceData = await this.fillInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillInsuranceFront();
      await this.uploadPhoto.fillInsuranceBack();
      await this.locator.addSecondaryInsurance.click();
      secondaryInsuranceData = await this.fillSecondaryInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillSecondaryInsuranceFront();
      await this.uploadPhoto.fillSecondaryInsuranceBack();
      await this.locator.clickContinueButton();
    } else {
      await this.selectSelfPayPayment();
      await this.locator.clickContinueButton();
      await this.fillAndAddCreditCard();
    }
    await this.locator.clickContinueButton();
    let responsiblePartyData: ResponsibleParty | null = null;
    if (responsibleParty === 'self') {
      await this.fillResponsiblePartyDataSelf();
    } else {
      responsiblePartyData = await this.fillResponsiblePartyDataNotSelf();
    }
    await this.locator.clickContinueButton();
    await this.checkCorrectPageOpens('Photo ID');
    await this.uploadPhoto.fillPhotoFrontID();
    await this.uploadPhoto.fillPhotoBackID();
    await this.locator.clickContinueButton();
    await this.fillConsentForms();
    await this.locator.clickContinueButton();
    return {
      stateValue,
      patientDetailsData: {
        randomEthnicity: patientDetailsData.randomEthnicity,
        randomRace: patientDetailsData.randomRace,
        randomPronoun: patientDetailsData.randomPronoun,
        randomLanguage: patientDetailsData.randomLanguage,
        randomPoint: patientDetailsData.randomPoint,
      },
      pcpData: {
        firstName: pcpData.firstName,
        lastName: pcpData.lastName,
        pcpAddress: pcpData.pcpAddress,
        pcpName: pcpData.pcpName,
        formattedPhoneNumber: pcpData.formattedPhoneNumber,
      },
      responsiblePartyData,
      insuranceData,
      secondaryInsuranceData,
    };
  }
  async fillPaperworkAllFieldsTelemed(
    payment: string,
    responsibleParty: string
  ): Promise<{
    stateValue: string;
    patientDetailsData: PatientDetailsData;
    pcpData: PrimaryCarePhysicianData;
    medicationData: TelemedPaperworkData;
    allergiesData: TelemedPaperworkData;
    medicalHistoryData: TelemedPaperworkData;
    surgicalHistoryData: TelemedPaperworkData;
    flags: Flags;
    insuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null;
    secondaryInsuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null;
    responsiblePartyData: ResponsibleParty | null;
    uploadedPhotoCondition: Locator;
  }> {
    const { stateValue } = await this.fillContactInformationAllFields();
    await this.locator.clickContinueButton();
    const patientDetailsData = await this.fillPatientDetailsTelemedAllFields();
    await this.locator.clickContinueButton();
    const pcpData = await this.fillPrimaryCarePhysician();
    await this.locator.clickContinueButton();
    const medicationData = await this.paperworkTelemed.fillAndCheckFilledCurrentMedications();
    await this.locator.clickContinueButton();
    const allergiesData = await this.paperworkTelemed.fillAndCheckFilledCurrentAllergies();
    await this.locator.clickContinueButton();
    const medicalHistoryData = await this.paperworkTelemed.fillAndCheckFilledMedicalHistory();
    await this.locator.clickContinueButton();
    const surgicalHistoryData = await this.paperworkTelemed.fillAndCheckFilledSurgicalHistory();
    await this.locator.clickContinueButton();
    const flags = await this.paperworkTelemed.fillAndCheckAdditionalQuestions();
    await this.locator.clickContinueButton();
    let insuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null = null;
    let secondaryInsuranceData: {
      insuranceRequiredData: InsuranceRequiredData;
      insuranceOptionalData: InsuranceOptionalData;
    } | null = null;
    if (payment === 'insurance') {
      await this.selectInsurancePayment();
      insuranceData = await this.fillInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillInsuranceFront();
      await this.uploadPhoto.fillInsuranceBack();
      await this.locator.addSecondaryInsurance.click();
      secondaryInsuranceData = await this.fillSecondaryInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillSecondaryInsuranceFront();
      await this.uploadPhoto.fillSecondaryInsuranceBack();
      await this.locator.clickContinueButton();
    } else {
      await this.selectSelfPayPayment();
      await this.locator.clickContinueButton();
      // Need to uncomment when https://github.com/masslight/ottehr/issues/2043 is fixed
      //  await this.fillAndAddCreditCard();
    }
    await this.locator.clickContinueButton();
    let responsiblePartyData: ResponsibleParty | null = null;
    if (responsibleParty === 'self') {
      await this.fillResponsiblePartyDataSelf();
    } else {
      responsiblePartyData = await this.fillResponsiblePartyDataNotSelf();
    }
    await this.locator.clickContinueButton();
    await this.checkCorrectPageOpens('Photo ID');
    await this.uploadPhoto.fillPhotoFrontID();
    await this.uploadPhoto.fillPhotoBackID();
    await this.locator.clickContinueButton();
    const uploadedPhotoCondition = await this.uploadPhoto.fillPatientConditionPhotoPaperwork();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckSchoolWorkNoteAsNone();
    await this.locator.clickContinueButton();
    await this.fillConsentForms();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckNoInviteParticipant();
    await this.locator.clickContinueButton();
    return {
      stateValue,
      patientDetailsData: {
        randomEthnicity: patientDetailsData.patientDetailsData.randomEthnicity,
        randomRace: patientDetailsData.patientDetailsData.randomRace,
        randomPronoun: patientDetailsData.patientDetailsData.randomPronoun,
        randomLanguage: patientDetailsData.patientDetailsData.randomLanguage,
        randomPoint: patientDetailsData.patientDetailsData.randomPoint,
      },
      pcpData: {
        firstName: pcpData.firstName,
        lastName: pcpData.lastName,
        pcpAddress: pcpData.pcpAddress,
        pcpName: pcpData.pcpName,
        formattedPhoneNumber: pcpData.formattedPhoneNumber,
      },
      medicationData: {
        filledValue: medicationData.filledValue,
        selectedValue: medicationData.selectedValue,
      },
      allergiesData: {
        filledValue: allergiesData.filledValue,
        selectedValue: allergiesData.selectedValue,
      },
      medicalHistoryData: {
        filledValue: medicalHistoryData.filledValue,
        selectedValue: medicalHistoryData.selectedValue,
      },
      surgicalHistoryData: {
        filledValue: surgicalHistoryData.filledValue,
        selectedValue: surgicalHistoryData.selectedValue,
      },
      flags: {
        covid: flags.covid,
        test: flags.test,
        travel: flags.travel,
      },
      responsiblePartyData,
      insuranceData,
      secondaryInsuranceData,
      uploadedPhotoCondition,
    };
  }
  async fillPaperworkOnlyRequiredFieldsTelemed(): Promise<void> {
    await this.fillContactInformationRequiredFields();
    await this.locator.clickContinueButton();
    await this.fillPatientDetailsTelemedAllFields();
    await this.locator.clickContinueButton();
    await this.skipPrimaryCarePhysician();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckEmptyCurrentMedications();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckEmptyCurrentAllergies();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckEmptyMedicalHistory();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckEmptySurgicalHistory();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckAdditionalQuestions();
    await this.locator.clickContinueButton();
    await this.selectSelfPayPayment();
    await this.locator.clickContinueButton();
    await this.fillResponsiblePartyDataSelf();
    await this.locator.clickContinueButton();
    await this.skipPhotoID();
    await this.locator.clickContinueButton();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckSchoolWorkNoteAsNone();
    await this.locator.clickContinueButton();
    await this.fillConsentForms();
    await this.locator.clickContinueButton();
    await this.paperworkTelemed.fillAndCheckNoInviteParticipant();
    await this.locator.clickContinueButton();
  }
  async fillPaperworkOnlyRequiredFieldsInPerson(): Promise<void> {
    await this.fillContactInformationRequiredFields();
    await this.locator.clickContinueButton();
    await this.fillPatientDetailsRequiredFields();
    await this.locator.clickContinueButton();
    await this.skipPrimaryCarePhysician();
    await this.locator.clickContinueButton();
    await this.selectSelfPayPayment();
    await this.locator.clickContinueButton();
    await this.fillAndAddCreditCard();
    await this.locator.clickContinueButton();
    await this.fillResponsiblePartyDataSelf();
    await this.locator.clickContinueButton();
    await this.skipPhotoID();
    await this.locator.clickContinueButton();
    await this.fillConsentForms();
    await this.locator.clickContinueButton();
  }
  async fillContactInformationRequiredFields(): Promise<{ stateValue: string }> {
    const { stateValue } = await this.fillPatientState();
    await this.fillStreetAddress();
    await this.fillPatientCity();
    await this.fillPatientZip();
    await expect(this.locator.streetAddress).not.toBeEmpty();
    await expect(this.locator.patientCity).not.toBeEmpty();
    await expect(this.locator.patientState).not.toBeEmpty();
    await expect(this.locator.patientZip).not.toBeEmpty();
    return { stateValue };
  }
  async fillContactInformationAllFields(): Promise<{ stateValue: string }> {
    const { stateValue } = await this.fillContactInformationRequiredFields();
    await this.fillStreetAddressLine2();
    await this.fillMobileOptIn();
    return { stateValue };
  }
  async fillStreetAddress(): Promise<void> {
    await this.locator.streetAddress.fill(PATIENT_ADDRESS);
    await expect(this.locator.streetAddress).toHaveValue(PATIENT_ADDRESS);
  }
  async fillStreetAddressLine2(): Promise<void> {
    await this.locator.streetAddressLine2.fill(PATIENT_ADDRESS_LINE_2);
    await expect(this.locator.streetAddressLine2).toHaveValue(PATIENT_ADDRESS_LINE_2);
  }
  async fillPatientCity(): Promise<void> {
    await this.locator.patientCity.fill(PATIENT_CITY);
    await expect(this.locator.patientCity).toHaveValue(PATIENT_CITY);
  }
  async fillPatientState(): Promise<{ stateValue: string }> {
    const stateValue = this.getRandomState();
    await this.locator.patientState.click();
    await this.locator.patientState.fill(stateValue);
    await this.page.getByRole('option', { name: stateValue }).click();
    await expect(this.locator.patientState).toHaveValue(stateValue);
    return { stateValue };
  }
  async fillPatientZip(): Promise<void> {
    await this.locator.patientZip.fill(PATIENT_ZIP);
    await expect(this.locator.patientZip).toHaveValue(PATIENT_ZIP);
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
  async fillEthnicity(): Promise<{ randomEthnicity: string }> {
    await this.validateAllOptions(this.locator.patientEthnicity, Object.values(PatientEthnicity), 'ethnicity');
    const randomEthnicity = this.getRandomEthnicity();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
    return { randomEthnicity };
  }
  async fillRace(): Promise<{ randomRace: string }> {
    await this.validateAllOptions(this.locator.patientRace, Object.values(PatientRace), 'race');
    const randomRace = this.getRandomRace();
    await this.page.getByRole('option', { name: randomRace }).click();
    return { randomRace };
  }
  async fillPronoun(): Promise<{ randomPronoun: string }> {
    await this.validateAllOptions(this.locator.patientPronouns, this.pronouns, 'pronoun');
    const randomPronoun = this.getRandomElement(this.pronouns);
    await this.page.getByRole('option', { name: randomPronoun }).click();
    return { randomPronoun };
  }
  async fillNotListedPronouns(): Promise<void> {
    await this.validateAllOptions(this.locator.patientPronouns, this.pronouns, 'pronoun');
    await this.page.getByRole('option', { name: 'My pronouns are not listed' }).click();
    await expect(this.locator.patientMyPronounsLabel).toBeVisible();
    await expect(this.locator.patientMyPronounsInput).toBeVisible();
    await this.locator.patientMyPronounsInput.fill('Not listed pronouns');
  }
  async fillPointOfDiscovery(): Promise<{ randomPoint: string }> {
    await this.validateAllOptions(this.locator.patientPointOfDiscovery, this.pointOfDiscovery, 'point of discovery');
    const randomPoint = this.getRandomElement(this.pointOfDiscovery);
    await this.page.getByRole('option', { name: randomPoint }).click();
    return { randomPoint };
  }
  async fillPreferredLanguage(): Promise<{ randomLanguage: string }> {
    await this.validateAllOptions(this.locator.patientPreferredLanguage, this.language, 'language');
    const randomLanguage = this.getRandomElement(this.language);
    await this.page.getByRole('option', { name: randomLanguage }).click();
    return { randomLanguage };
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
  async fillPatientDetailsAllFields(): Promise<{
    randomEthnicity: string;
    randomRace: string;
    randomPronoun: string;
    randomPoint: string;
    randomLanguage: string;
  }> {
    const { randomEthnicity } = await this.fillEthnicity();
    const { randomRace } = await this.fillRace();
    const { randomPronoun } = await this.fillPronoun();
    const { randomPoint } = await this.fillPointOfDiscovery();
    const { randomLanguage } = await this.fillPreferredLanguage();
    return { randomEthnicity, randomRace, randomPronoun, randomPoint, randomLanguage };
  }
  async fillPatientDetailsTelemedAllFields(): Promise<{ patientDetailsData: PatientDetailsData }> {
    const patientDetailsData = await this.fillPatientDetailsAllFields();
    await this.fillRelayServiceNo();
    return { patientDetailsData };
  }
  async fillRelayServiceNo(): Promise<void> {
    await this.locator.relayServiceNo.check();
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
    const formattedPhoneNumber = this.formatPhoneNumber(PHONE_NUMBER);
    await this.locator.pcpFirstName.fill(firstName);
    await expect(this.locator.pcpFirstName).toHaveValue(firstName);
    await this.locator.pcpLastName.fill(lastName);
    await expect(this.locator.pcpLastName).toHaveValue(lastName);
    await this.locator.pcpAddress.fill(pcpAddress);
    await expect(this.locator.pcpAddress).toHaveValue(pcpAddress);
    await this.locator.pcpPractice.fill(pcpName);
    await expect(this.locator.pcpPractice).toHaveValue(pcpName);
    await this.locator.pcpNumber.fill(PHONE_NUMBER);
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
  async checkEmailValidations(email: any): Promise<void> {
    await email.fill('abcd1');
    await this.locator.clickContinueButton(false);
    await expect(this.locator.emailErrorText).toBeVisible();
    await email.fill('example@test.com');
    await this.page.keyboard.press('Tab');
    await expect(this.locator.emailErrorText).not.toBeVisible();
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
  async fillAndAddCreditCard(): Promise<void> {
    await this.locator.creditCardNumber.fill(CARD_NUMBER);
    await this.locator.creditCardCVC.fill(CARD_CVV);
    await this.locator.creditCardExpiry.fill(CARD_EXP_DATE);
    await this.locator.addCardButton.click();
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
    address1: string;
    additionalAddress: string;
    phone: string;
    city: string;
    state: string;
    zip: string;
    email: string;
  }> {
    const { relationship } = await this.fillResponsiblePartyNotSelfRelationship();
    const name = await this.fillResponsiblePartyPatientName();
    const { birthSex } = await this.fillResponsiblePartyBirthSex();
    const { paperworkDOB } = await this.fillPaperworkDOB(this.locator.responsiblePartyDOBAnswer);
    const { address: address1 } = await this.fillResponsiblePartyAddress();
    const { city } = await this.fillResponsiblePartyCity();
    const { state } = await this.fillResponsiblePartyState();
    const { zip } = await this.fillResponsiblePartyZip();
    const { address: additionalAddress } = await this.fillResponsiblePartyAdditionalAddress();
    const { formattedPhoneNumber: phone } = await this.fillResponsiblePartyPhone();
    const { email } = await this.fillResponsiblePartyEmail();
    return {
      relationship,
      birthSex,
      firstName: name.firstName,
      lastName: name.lastName,
      dob: paperworkDOB,
      address1,
      additionalAddress,
      phone,
      city,
      state,
      zip,
      email,
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
      [RELATIONSHIP_RESPONSIBLE_PARTY_SELF],
      'responsible party self'
    );
    await this.page.getByRole('option', { name: RELATIONSHIP_RESPONSIBLE_PARTY_SELF }).click();
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
  async fillResponsiblePartyPhone(): Promise<{ formattedPhoneNumber: string }> {
    const formattedPhoneNumber = this.formatPhoneNumber(PHONE_NUMBER);
    await this.locator.responsiblePartyNumber.fill(PHONE_NUMBER);
    return { formattedPhoneNumber };
  }
  async fillResponsiblePartyEmail(): Promise<{ email: string }> {
    await this.locator.responsiblePartyEmail.fill(EMAIL);
    return { email: EMAIL };
  }
  async fillResponsiblePartyAddress(): Promise<{ address: string }> {
    const address = `Address ${this.getRandomString()}`;
    await this.locator.responsiblePartyAddress1.fill(address);
    return { address };
  }
  async fillResponsiblePartyAdditionalAddress(): Promise<{ address: string }> {
    const address = `Additional Address ${this.getRandomString()}`;
    await this.locator.responsiblePartyAddress2.fill(address);
    return { address };
  }
  async fillResponsiblePartyCity(): Promise<{ city: string }> {
    const city = `City${this.getRandomString()}`;
    await this.locator.responsiblePartyCity.fill(city);
    return { city };
  }
  async fillResponsiblePartyState(): Promise<{ state: string }> {
    // const nyState = 'NY';
    await this.locator.responsiblePartyState.click();
    // await this.locator.responsiblePartyState.fill(nyState);
    // await this.page.getByRole('option', { name: nyState }).click();
    await this.page.getByRole('option').first().click();
    await expect(this.locator.responsiblePartyState).toHaveValue('AL');
    return { state: 'AL' };
  }
  async fillResponsiblePartyZip(): Promise<{ zip: string }> {
    const zip = '12345';
    await this.locator.responsiblePartyZip.fill(zip);
    return { zip };
  }
  async checkImagesIsSaved(image: Locator): Promise<void> {
    const today = await this.CommonLocatorsHelper.getToday();
    await expect(image).toHaveText(`We already have this! It was saved on ${today}. Click to re-upload.`);
  }
  async fillConsentForms(): Promise<{ signature: string; relationshipConsentForms: string; consentFullName: string }> {
    await this.validateAllOptions(
      this.locator.consentSignerRelationship,
      this.relationshipConsentForms,
      'consent signer'
    );
    const relationshipConsentForms = this.getRandomElement(this.relationshipConsentForms);
    const signature = 'Test signature';
    const consentFullName = 'Test consent full name';
    await this.locator.hipaaAcknowledgement.check();
    await this.locator.consentToTreat.check();
    await this.locator.signature.click();
    await this.locator.signature.fill(signature);
    await this.locator.consentFullName.click();
    await this.locator.consentFullName.fill(consentFullName);
    await this.locator.consentSignerRelationship.click();
    await this.page.getByRole('option', { name: relationshipConsentForms }).click();
    return { signature, relationshipConsentForms, consentFullName };
  }
  async checkAllChipsAreCompletedInPerson(): Promise<void> {
    await expect(this.locator.contactInformationChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.patientDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.pcpChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.insuranceDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.responsiblePartyChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.photoIdChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.consentFormsChipStatus).toHaveAttribute('data-testid', 'completed');
  }
  async checkAllChipsAreCompletedTelemed(): Promise<void> {
    await this.checkAllChipsAreCompletedInPerson();
    await expect(this.locator.currentMedicationsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.currentAllergiesChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.medicalHistoryChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.surgicalHistoryChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.additionalQuestionsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.patientConditionChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.schoolWorkNotesChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(this.locator.inviteParticipantChipStatus).toHaveAttribute('data-testid', 'completed');
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
