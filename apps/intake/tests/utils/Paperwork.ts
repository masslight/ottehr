import { BrowserContext, expect, Locator, Page } from '@playwright/test';
import { DateTime } from 'luxon';
import { AllStates, PatientEthnicity, PatientRace } from 'utils';
import { PatientBasicInfo } from './BaseFlow';
import { CommonLocatorsHelper } from './CommonLocatorsHelper';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';
import { QuestionnaireHelper } from './QuestionnaireHelper';
import { PaperworkTelemed } from './telemed/Paperwork';
import { UploadDocs } from './UploadDocs';

export interface InsuranceRequiredData {
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
export interface InsuranceOptionalData {
  policyHolderMiddleName: string;
  policyHolderAddressLine2: string;
}

export interface PatientDetailsRequiredData {
  randomEthnicity: string;
  randomRace: string;
  randomLanguage: string;
}
export interface PatientDetailsData extends PatientDetailsRequiredData {
  randomPronoun: string;
  randomPoint: string;
}

export interface PrimaryCarePhysicianData {
  firstName: string;
  lastName: string;
  pcpAddress: string;
  pcpName: string;
  formattedPhoneNumber: string;
}

export interface ResponsiblePartyData {
  relationship: string;
  birthSex: string;
  firstName: string;
  lastName: string;
  dob: string;
  address1: string;
  additionalAddress: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zip: string;
}

export interface EmployerInformationData {
  employerName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  contactFirstName: string;
  contactLastName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactFax: string;
}

export interface EmergencyContactData {
  relationship: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
}

export interface TelemedPaperworkData {
  filledValue: string;
  selectedValue: string;
}

export interface FlagsData {
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
export const CARD_NUMBER_OBSCURED = 'XXXX - XXXX - XXXX - 4242';
export const CARD_CVV = '123';
export const CARD_EXP_DATE = '11/30';

export type InPersonPaperworkReturn<
  PaperworkPayment extends 'card' | 'insurance',
  PaperworkResponsibleParty extends 'self' | 'not-self',
  PaperworkRequiredOnly extends boolean = false,
> = {
  state: string;
  patientDetailsData: PaperworkRequiredOnly extends true ? PatientDetailsRequiredData : PatientDetailsData;
  pcpData: PaperworkRequiredOnly extends true ? null : PrimaryCarePhysicianData;
  insuranceData: PaperworkPayment extends 'insurance'
    ? PaperworkRequiredOnly extends false
      ? {
          insuranceRequiredData: InsuranceRequiredData;
          insuranceOptionalData: InsuranceOptionalData;
        }
      : null
    : null;
  secondaryInsuranceData: PaperworkPayment extends 'insurance'
    ? PaperworkRequiredOnly extends false
      ? {
          insuranceRequiredData: InsuranceRequiredData;
          insuranceOptionalData: InsuranceOptionalData;
        }
      : null
    : null;
  responsiblePartyData: PaperworkResponsibleParty extends 'not-self' ? ResponsiblePartyData : null;
  employerInformation: EmployerInformationData | null;
  emergencyContactInformation: EmergencyContactData;
};

export type TelemedPaperworkReturn<
  PaperworkPayment extends 'card' | 'insurance',
  PaperworkResponsibleParty extends 'self' | 'not-self',
  PaperworkRequiredOnly extends boolean = false,
> = {
  state: string;
  patientDetailsData: PaperworkRequiredOnly extends true ? PatientDetailsRequiredData : PatientDetailsData;
  pcpData: PaperworkRequiredOnly extends true ? null : PrimaryCarePhysicianData;
  medicationData: TelemedPaperworkData;
  allergiesData: TelemedPaperworkData;
  medicalHistoryData: TelemedPaperworkData;
  surgicalHistoryData: TelemedPaperworkData;
  flags: FlagsData | null;
  insuranceData: PaperworkPayment extends 'insurance'
    ? PaperworkRequiredOnly extends false
      ? {
          insuranceRequiredData: InsuranceRequiredData;
          insuranceOptionalData: InsuranceOptionalData;
        }
      : null
    : null;
  secondaryInsuranceData: PaperworkPayment extends 'insurance'
    ? PaperworkRequiredOnly extends false
      ? {
          insuranceRequiredData: InsuranceRequiredData;
          insuranceOptionalData: InsuranceOptionalData;
        }
      : null
    : null;
  responsiblePartyData: PaperworkResponsibleParty extends 'not-self' ? ResponsiblePartyData : null;
  uploadedPhotoCondition: Locator | null;
};

export class Paperwork {
  page: Page;
  locator: Locators;
  fillingInfo: FillingInfo;
  CommonLocatorsHelper: CommonLocatorsHelper;
  context: BrowserContext;
  uploadPhoto: UploadDocs;
  paperworkTelemed: PaperworkTelemed;
  employerInformationPageExists: boolean;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.CommonLocatorsHelper = new CommonLocatorsHelper(page);
    this.uploadPhoto = new UploadDocs(page);
    this.paperworkTelemed = new PaperworkTelemed(page);
    this.context = page.context();
    this.employerInformationPageExists = QuestionnaireHelper.hasEmployerInformationPage();
  }
  // todo grab from config instead!
  private language = ['English', 'Spanish'];
  private relationshipResponsiblePartyNotSelf = ['Legal Guardian', 'Parent', 'Other', 'Spouse'];
  private relationshipConsentForms = ['Legal Guardian', 'Parent', 'Other', 'Spouse', 'Self'];
  private emergencyContactInformationRelationship = ['Legal Guardian', 'Parent', 'Other', 'Spouse'];
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

  /**
   * Fill paperwork based on the provided input parameters.
   *
   * Provides common functionality and defines the contract for telemed visit workflows, including patient registration,
   * paperwork completion, and appointment management.
   *
   * If `requiredOnly` is true, the payment method will be overridden to 'self'.
   *
   * @property {'self' | 'insurance'} payment - Fill in insurance information or credit card details
   * @property {'self' | 'not-self'} responsibleParty - Whether the responsible party is the patient or another person
   * @property {boolean} [requiredOnly] - If true, only required fields will be filled. Defaults to false.
   *
   */
  async fillPaperworkInPerson<
    P extends 'card' | 'insurance',
    RP extends 'self' | 'not-self',
    RO extends boolean = false,
  >({
    payment,
    responsibleParty,
    requiredOnly,
  }: {
    payment: P;
    responsibleParty: RP;
    requiredOnly: RO;
  }): Promise<InPersonPaperworkReturn<P, RP, RO>> {
    await this.checkCorrectPageOpens('Contact information');
    let state: string;
    if (requiredOnly) {
      state = await this.fillContactInformationRequiredFields();
    } else {
      state = await this.fillContactInformationAllFields();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Patient details');
    const patientDetailsData = requiredOnly
      ? await this.fillPatientDetailsRequiredFields()
      : await this.fillPatientDetailsAllFields();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Primary Care Physician');
    const pcpData = requiredOnly ? null : await this.fillPrimaryCarePhysician();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Preferred pharmacy');
    // todo fill preferred pharmacy if not required only
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('How would you like to pay for your visit?');
    let insuranceData = null;
    let secondaryInsuranceData = null;
    if (!requiredOnly && payment === 'insurance') {
      await this.selectInsurancePayment();
      insuranceData = await this.fillInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillInsuranceFront();
      await this.uploadPhoto.fillInsuranceBack();

      await this.locator.addSecondaryInsurance.click();
      secondaryInsuranceData = await this.fillSecondaryInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillSecondaryInsuranceFront();
      await this.uploadPhoto.fillSecondaryInsuranceBack();
    } else {
      await this.selectSelfPayPayment();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Credit card details');
    if (requiredOnly) {
      // test skipping credit card is fine when no insurance submitted
      await this.locator.clickContinueButton();
      await this.checkCorrectPageOpens('Responsible party information');
      await this.locator.clickBackButton();
    }
    if (payment === 'card') {
      await this.fillAndAddCreditCard();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Responsible party information');
    const responsiblePartyData = responsibleParty === 'self' ? null : await this.fillResponsiblePartyDataNotSelf();
    if (responsibleParty === 'self') {
      await this.fillResponsiblePartyDataSelf();
    }
    await this.locator.clickContinueButton();

    const employerInformation = this.employerInformationPageExists
      ? await (async () => {
          await this.checkCorrectPageOpens('Employer information');
          const data = await this.fillEmployerInformation();
          await this.locator.clickContinueButton();
          return data;
        })()
      : null;

    await this.checkCorrectPageOpens('Emergency Contact');
    const emergencyContactInformation = await this.fillEmergencyContactInformation();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Photo ID');
    if (!requiredOnly) {
      await this.uploadPhoto.fillPhotoFrontID();
      await this.uploadPhoto.fillPhotoBackID();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Complete consent forms');
    await this.fillConsentForms();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Medical history');
    // todo fill medical history if not required only
    await this.locator.clickContinueButton();

    return {
      state,
      patientDetailsData,
      pcpData,
      responsiblePartyData,
      employerInformation,
      emergencyContactInformation,
      insuranceData,
      secondaryInsuranceData,
    } as InPersonPaperworkReturn<P, RP, RO>;
  }
  /**
   * Fill paperwork based on the provided input parameters.
   *
   * Provides common functionality and defines the contract for telemed visit workflows, including patient registration,
   * paperwork completion, and appointment management.
   *
   * If `requiredOnly` is true, the payment method will be overridden to 'self'.
   *
   * @property {'self' | 'insurance'} payment - Fill in insurance information or credit card details
   * @property {'self' | 'not-self'} responsibleParty - Whether the responsible party is the patient or another person
   * @property {boolean} [requiredOnly] - If true, only required fields will be filled. Defaults to false.
   *
   */
  async fillPaperworkTelemed<
    P extends 'card' | 'insurance',
    RP extends 'self' | 'not-self',
    RO extends boolean = false,
  >({
    payment,
    responsibleParty,
    requiredOnly,
    patientBasicInfo,
  }: {
    payment: P;
    responsibleParty: RP;
    requiredOnly: RO;
    patientBasicInfo?: PatientBasicInfo;
  }): Promise<TelemedPaperworkReturn<P, RP, RO>> {
    await this.checkCorrectPageOpens('Contact information');
    let state: string;
    if (requiredOnly) {
      state = await this.fillContactInformationRequiredFields();
    } else {
      state = await this.fillContactInformationAllFields();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Patient details');
    const patientDetailsData = requiredOnly
      ? await this.fillPatientDetailsRequiredFields(true)
      : await this.fillPatientDetailsAllFields(true, patientBasicInfo?.isNewPatient);
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Primary Care Physician');
    const pcpData = requiredOnly ? null : await this.fillPrimaryCarePhysician();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Preferred pharmacy');
    // todo fill preferred pharmacy if not required only
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Current medications');
    const medicationData = requiredOnly
      ? await this.paperworkTelemed.fillAndCheckEmptyCurrentMedications()
      : await this.paperworkTelemed.fillAndCheckFilledCurrentMedications();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Current allergies');
    const allergiesData = requiredOnly
      ? await this.paperworkTelemed.fillAndCheckEmptyCurrentAllergies()
      : await this.paperworkTelemed.fillAndCheckFilledCurrentAllergies();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Medical history');
    const medicalHistoryData = requiredOnly
      ? await this.paperworkTelemed.fillAndCheckEmptyMedicalHistory()
      : await this.paperworkTelemed.fillAndCheckFilledMedicalHistory();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Surgical history');
    const surgicalHistoryData = requiredOnly
      ? await this.paperworkTelemed.fillAndCheckEmptySurgicalHistory()
      : await this.paperworkTelemed.fillAndCheckFilledSurgicalHistory();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Additional questions');
    const flags = !requiredOnly ? await this.paperworkTelemed.fillAndCheckAdditionalQuestions() : null;
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('How would you like to pay for your visit?');
    let insuranceData = null;
    let secondaryInsuranceData = null;
    if (!requiredOnly && payment === 'insurance') {
      await this.selectInsurancePayment();
      insuranceData = await this.fillInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillInsuranceFront();
      await this.uploadPhoto.fillInsuranceBack();

      await this.locator.addSecondaryInsurance.click();
      secondaryInsuranceData = await this.fillSecondaryInsuranceAllFieldsWithoutCards();
      await this.uploadPhoto.fillSecondaryInsuranceFront();
      await this.uploadPhoto.fillSecondaryInsuranceBack();
    } else {
      await this.selectSelfPayPayment();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Credit card details');
    // credit card required for virtual flows
    await this.fillAndAddCreditCard();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Responsible party information');
    const responsiblePartyData = responsibleParty === 'self' ? null : await this.fillResponsiblePartyDataNotSelf();
    if (responsibleParty === 'self') {
      await this.fillResponsiblePartyDataSelf();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Photo ID');
    if (!requiredOnly) {
      await this.uploadPhoto.fillPhotoFrontID();
      await this.uploadPhoto.fillPhotoBackID();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Patient condition');
    let uploadedPhotoCondition: Locator | null = null;
    if (!requiredOnly) {
      uploadedPhotoCondition = await this.uploadPhoto.fillPatientConditionPhotoPaperwork();
    }
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Do you need a school or work note?');
    // todo why not add a school/work note for completion?
    await this.paperworkTelemed.fillAndCheckSchoolWorkNoteAsNone();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Complete consent forms');
    await this.fillConsentForms();
    await this.locator.clickContinueButton();

    await this.checkCorrectPageOpens('Would you like someone to join this call?');
    // todo why not invite a participant for completion?
    await this.paperworkTelemed.fillAndCheckNoInviteParticipant();
    await this.locator.clickContinueButton();

    return {
      state,
      patientDetailsData,
      pcpData,
      medicationData,
      allergiesData,
      medicalHistoryData,
      surgicalHistoryData,
      flags,
      insuranceData,
      secondaryInsuranceData,
      responsiblePartyData,
      uploadedPhotoCondition,
    } as TelemedPaperworkReturn<P, RP, RO>;
  }

  // ---------------------------------------------------------------------------

  async fillContactInformationRequiredFields(): Promise<string> {
    const state = await this.fillPatientState();
    await this.fillStreetAddress();
    await this.fillPatientCity();
    await this.fillPatientZip();
    await this.fillPreferredCommunicationMethod();
    await expect(this.locator.streetAddress).not.toBeEmpty();
    await expect(this.locator.patientCity).not.toBeEmpty();
    await expect(this.locator.patientState).not.toBeEmpty();
    await expect(this.locator.patientZip).not.toBeEmpty();
    return state;
  }
  async fillContactInformationAllFields(): Promise<string> {
    const state = await this.fillContactInformationRequiredFields();
    await this.fillStreetAddressLine2();
    await this.fillMobileOptIn();
    return state;
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
  async fillPatientState(): Promise<string> {
    const state = this.getRandomState();
    await this.locator.patientState.click();
    await this.locator.patientState.fill(state);
    await this.page.getByRole('option', { name: state }).click();
    await expect(this.locator.patientState).toHaveValue(state);
    return state;
  }
  async fillPatientZip(): Promise<void> {
    await this.locator.patientZip.fill(PATIENT_ZIP);
    await expect(this.locator.patientZip).toHaveValue(PATIENT_ZIP);
  }
  async fillPreferredCommunicationMethod(): Promise<void> {
    const preferredCommunicationMethodInputPresent = await this.locator.preferredCommunicationMethod.isVisible();
    if (!preferredCommunicationMethodInputPresent) {
      return;
    }
    await this.locator.preferredCommunicationMethod.click();
    await this.page.getByRole('option').first().click();
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
  async checkPatientNameIsDisplayed(firstName: string, lastName: string, isPhotoIdPage?: boolean): Promise<void> {
    if (isPhotoIdPage) {
      await expect(this.page.getByText(`Adult Guardian for ${firstName} ${lastName}`)).toBeVisible();
    } else {
      await expect(this.page.getByText(`${firstName} ${lastName}`)).toBeVisible();
    }
  }
  async checkCorrectPageOpens(pageTitle: string): Promise<void> {
    // wait for "Loading..." to disappear (page finished loading data)
    await expect(this.locator.flowHeading).not.toHaveText('Loading...', { timeout: 60000 });
    // Then assert the expected title
    await expect(this.locator.flowHeading).toHaveText(pageTitle);
  }
  async fillEthnicity(): Promise<PatientDetailsData['randomEthnicity']> {
    await this.validateAllOptions(this.locator.patientEthnicity, Object.values(PatientEthnicity), 'ethnicity');
    const randomEthnicity = this.getRandomEthnicity();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
    return randomEthnicity;
  }
  async fillRace(): Promise<PatientDetailsData['randomRace']> {
    await this.validateAllOptions(this.locator.patientRace, Object.values(PatientRace), 'race');
    const randomRace = this.getRandomRace();
    await this.page.getByRole('option', { name: randomRace }).click();
    return randomRace;
  }
  async fillPronoun(): Promise<PatientDetailsData['randomPronoun']> {
    await this.validateAllOptions(this.locator.patientPronouns, this.pronouns, 'pronoun');
    const randomPronoun = this.getRandomElement(this.pronouns);
    await this.page.getByRole('option', { name: randomPronoun }).click();
    return randomPronoun;
  }
  async fillNotListedPronouns(): Promise<void> {
    await this.validateAllOptions(this.locator.patientPronouns, this.pronouns, 'pronoun');
    await this.page.getByRole('option', { name: 'My pronouns are not listed' }).click();
    await expect(this.locator.patientMyPronounsLabel).toBeVisible();
    await expect(this.locator.patientMyPronounsInput).toBeVisible();
    await this.locator.patientMyPronounsInput.fill('Not listed pronouns');
  }
  async fillPointOfDiscovery(): Promise<PatientDetailsData['randomPoint']> {
    await this.validateAllOptions(this.locator.patientPointOfDiscovery, this.pointOfDiscovery, 'point of discovery');
    const randomPoint = this.getRandomElement(this.pointOfDiscovery);
    await this.page.getByRole('option', { name: randomPoint }).click();
    return randomPoint;
  }
  async fillPreferredLanguage(): Promise<PatientDetailsData['randomLanguage']> {
    await this.validateAllOptions(this.locator.patientPreferredLanguage, this.language, 'language');
    const randomLanguage = this.getRandomElement(this.language);
    await this.page.getByRole('option', { name: randomLanguage }).click();
    return randomLanguage;
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
  async fillPatientDetailsRequiredFields(telemed?: boolean): Promise<PatientDetailsRequiredData> {
    const randomEthnicity = await this.fillEthnicity();
    const randomRace = await this.fillRace();
    const randomLanguage = await this.fillPreferredLanguage();
    if (telemed) {
      await this.locator.relayServiceNo.check();
    }
    return { randomEthnicity, randomRace, randomLanguage };
  }
  async fillPatientDetailsAllFields(telemed?: boolean, isNewPatient?: boolean): Promise<PatientDetailsData> {
    const randomEthnicity = await this.fillEthnicity();
    const randomRace = await this.fillRace();
    const randomPronoun = await this.fillPronoun();
    let randomPoint = '';
    if (isNewPatient) {
      randomPoint = await this.fillPointOfDiscovery();
    }
    const randomLanguage = await this.fillPreferredLanguage();
    if (telemed) {
      await this.locator.relayServiceNo.check();
    }
    return { randomEthnicity, randomRace, randomPronoun, randomPoint, randomLanguage };
  }
  async skipPrimaryCarePhysician(): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
  }
  async skipPreferredPharmacy(): Promise<void> {
    await this.CommonLocatorsHelper.clickContinue();
  }
  async fillPrimaryCarePhysician(): Promise<PrimaryCarePhysicianData> {
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
    await expect(this.page.getByText(CARD_NUMBER_OBSCURED)).toBeVisible();
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
    const paperworkDOB = await this.fillPaperworkDOB(locators.policyHolderDOB);
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
  async fillResponsiblePartyDataNotSelf(): Promise<ResponsiblePartyData> {
    const relationship = await this.fillResponsiblePartyNotSelfRelationship();
    const name = await this.fillResponsiblePartyPatientName();
    const birthSex = await this.fillResponsiblePartyBirthSex();
    const paperworkDOB = await this.fillPaperworkDOB(this.locator.responsiblePartyDOBAnswer);
    const address1 = await this.fillResponsiblePartyAddress();
    const city = await this.fillResponsiblePartyCity();
    const state = await this.fillResponsiblePartyState();
    const zip = await this.fillResponsiblePartyZip();
    const additionalAddress = await this.fillResponsiblePartyAdditionalAddress();
    const phone = await this.fillResponsiblePartyPhone();
    const email = await this.fillResponsiblePartyEmail();
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
  async fillResponsiblePartyPatientName(): Promise<Pick<ResponsiblePartyData, 'firstName' | 'lastName'>> {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    await this.locator.responsiblePartyFirstName.click();
    await this.locator.responsiblePartyFirstName.fill(firstName);
    await this.locator.responsiblePartyLastName.click();
    await this.locator.responsiblePartyLastName.fill(lastName);
    return { firstName, lastName };
  }
  async fillResponsiblePartyBirthSex(): Promise<ResponsiblePartyData['birthSex']> {
    await this.validateAllOptions(this.locator.responsiblePartyBirthSex, this.birthSex, 'birth sex');
    const birthSex = this.getRandomElement(this.birthSex);
    await this.page.getByRole('option', { name: birthSex, exact: true }).click();
    return birthSex;
  }
  async fillPaperworkDOB(dobField: Locator): Promise<string> {
    const twentyYearsAgo = DateTime.now().minus({ years: 20 });
    await dobField.fill(twentyYearsAgo.toFormat('MM/dd/yyyy'));
    return twentyYearsAgo.toFormat('MM/dd/yyyy');
  }
  async fillResponsiblePartySelfRelationship(): Promise<void> {
    await this.validateAllOptions(
      this.locator.responsiblePartyRelationship,
      [RELATIONSHIP_RESPONSIBLE_PARTY_SELF],
      'responsible party self'
    );
    await this.page.getByRole('option', { name: RELATIONSHIP_RESPONSIBLE_PARTY_SELF }).click();
  }
  async fillResponsiblePartyNotSelfRelationship(): Promise<ResponsiblePartyData['relationship']> {
    await this.validateAllOptions(
      this.locator.responsiblePartyRelationship,
      this.relationshipResponsiblePartyNotSelf,
      'responsible party not self'
    );
    const relationship = this.getRandomElement(this.relationshipResponsiblePartyNotSelf);
    await this.page.getByRole('option', { name: relationship }).click();
    return relationship;
  }
  async fillResponsiblePartyPhone(): Promise<ResponsiblePartyData['phone']> {
    const formattedPhoneNumber = this.formatPhoneNumber(PHONE_NUMBER);
    await this.locator.responsiblePartyNumber.fill(PHONE_NUMBER);
    return formattedPhoneNumber;
  }
  async fillResponsiblePartyEmail(): Promise<ResponsiblePartyData['email']> {
    await this.locator.responsiblePartyEmail.fill(EMAIL);
    return EMAIL;
  }
  async fillResponsiblePartyAddress(): Promise<ResponsiblePartyData['address1']> {
    const address = `Address ${this.getRandomString()}`;
    await this.locator.responsiblePartyAddress1.fill(address);
    return address;
  }
  async fillResponsiblePartyAdditionalAddress(): Promise<ResponsiblePartyData['additionalAddress']> {
    const address = `Additional Address ${this.getRandomString()}`;
    await this.locator.responsiblePartyAddress2.fill(address);
    return address;
  }
  async fillResponsiblePartyCity(): Promise<ResponsiblePartyData['city']> {
    const city = `City${this.getRandomString()}`;
    await this.locator.responsiblePartyCity.fill(city);
    return city;
  }
  async fillResponsiblePartyState(): Promise<ResponsiblePartyData['state']> {
    // const nyState = 'NY';
    await this.locator.responsiblePartyState.click();
    // await this.locator.responsiblePartyState.fill(nyState);
    // await this.page.getByRole('option', { name: nyState }).click();
    await this.page.getByRole('option').first().click();
    await expect(this.locator.responsiblePartyState).toHaveValue('AL');
    return 'AL';
  }
  async fillResponsiblePartyZip(): Promise<ResponsiblePartyData['zip']> {
    const zip = '12345';
    await this.locator.responsiblePartyZip.fill(zip);
    return zip;
  }

  async fillEmployerInformation(): Promise<EmployerInformationData> {
    const employerName = `Employer ${this.getRandomString()}`;
    const address1 = `Employer Address ${this.getRandomString()}`;
    const address2 = `Employer Address 2 ${this.getRandomString()}`;
    const city = `EmployerCity${this.getRandomString()}`;
    const state = 'AL';
    const zip = '12345';
    const contactFirstName = `ContactFN${this.getRandomString()}`;
    const contactLastName = `ContactLN${this.getRandomString()}`;
    const contactTitle = `Title ${this.getRandomString()}`;
    const contactEmail = `employer${this.getRandomString()}@mail.com`;
    const contactPhoneRaw = PHONE_NUMBER;
    const contactPhone = this.formatPhoneNumber(contactPhoneRaw);
    const contactFaxRaw = '9876543210';
    const contactFax = this.formatPhoneNumber(contactFaxRaw);

    await this.locator.employerName.fill(employerName);
    await this.locator.employerAddress1.fill(address1);
    await this.locator.employerAddress2.fill(address2);
    await this.locator.employerCity.fill(city);
    await this.locator.employerState.click();
    await this.page.getByRole('option', { name: state }).click();
    await expect(this.locator.employerState).toHaveValue(state);
    await this.locator.employerZip.fill(zip);
    await this.locator.employerContactFirstName.fill(contactFirstName);
    await this.locator.employerContactLastName.fill(contactLastName);
    await this.locator.employerContactTitle.fill(contactTitle);
    await this.locator.employerContactEmail.fill(contactEmail);
    await this.locator.employerContactPhone.fill(contactPhoneRaw);
    await expect(this.locator.employerContactPhone).toHaveValue(contactPhone);
    await this.locator.employerContactFax.fill(contactFaxRaw);
    await expect(this.locator.employerContactFax).toHaveValue(contactFax);

    return {
      employerName,
      address1,
      address2,
      city,
      state,
      zip,
      contactFirstName,
      contactLastName,
      contactTitle,
      contactEmail,
      contactPhone,
      contactFax,
    };
  }

  async fillEmergencyContactInformation(): Promise<EmergencyContactData> {
    const relationship = await this.fillEmergencyContactInformationRelationship();
    const name = await this.fillEmergencyContactInformationName();
    const phone = await this.fillEmergencyContactInformationPhone();
    const addressInfo = await this.fillEmergencyContactAddressInformation();
    return {
      relationship,
      firstName: name.firstName,
      lastName: name.lastName,
      phone,
      ...addressInfo,
    };
  }
  async fillEmergencyContactInformationRelationship(): Promise<EmergencyContactData['relationship']> {
    await this.validateAllOptions(
      this.locator.emergencyContactInformationRelationship,
      this.emergencyContactInformationRelationship,
      'emergency contact'
    );
    const relationship = 'Parent';
    await this.page.getByRole('option', { name: relationship }).click();
    return relationship;
  }
  async fillEmergencyContactInformationName(): Promise<Pick<EmergencyContactData, 'firstName' | 'lastName'>> {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    await this.locator.emergencyContactInformationFirstName.click();
    await this.locator.emergencyContactInformationFirstName.fill(firstName);
    await this.locator.emergencyContactInformationLastName.click();
    await this.locator.emergencyContactInformationLastName.fill(lastName);
    return { firstName, lastName };
  }
  async fillEmergencyContactInformationPhone(): Promise<EmergencyContactData['phone']> {
    const formattedPhoneNumber = this.formatPhoneNumber(PHONE_NUMBER);
    await this.locator.emergencyContactInformationPhone.fill(PHONE_NUMBER);
    return formattedPhoneNumber;
  }
  async fillEmergencyContactAddressInformation(): Promise<
    Pick<EmergencyContactData, 'address' | 'addressLine2' | 'city' | 'state' | 'zip'>
  > {
    await this.locator.emergencyContactSameAddressAsPatient.setChecked(false);
    const address = `Emergency Address ${this.getRandomString()}`;
    const addressLine2 = `Emergency Address Line 2 ${this.getRandomString()}`;
    const city = `EmergencyCity${this.getRandomString()}`;
    const state = 'AL';
    const zip = '12345';
    await this.locator.emergencyContactAddress.fill(address);
    await this.locator.emergencyContactAddressLine2.fill(addressLine2);
    await this.locator.emergencyContactCity.fill(city);
    await this.locator.emergencyContactState.click();
    await this.page.getByRole('option').first().click();
    await expect(this.locator.emergencyContactState).toHaveValue(state);
    await this.locator.emergencyContactZip.fill(zip);
    return { address, addressLine2, city, state, zip };
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
