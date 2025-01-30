import { BrowserContext, Page, expect } from '@playwright/test';
import { CommonLocatorsHelper } from './CommonLocatorsHelper';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';

interface ValuePair {
  value: string;
  label: string;
}

export const AllStates: ValuePair[] = [
  { value: 'AL', label: 'AL' }, // Alabama
  { value: 'AK', label: 'AK' }, // Alaska
  { value: 'AZ', label: 'AZ' }, // Arizona
  { value: 'AR', label: 'AR' }, // Arkansas
  { value: 'CA', label: 'CA' }, // California
  { value: 'CO', label: 'CO' }, // Colorado
  { value: 'CT', label: 'CT' }, // Connecticut
  { value: 'DE', label: 'DE' }, // Delaware
  { value: 'DC', label: 'DC' },
  { value: 'FL', label: 'FL' }, // Florida
  { value: 'GA', label: 'GA' }, // Georgia
  { value: 'HI', label: 'HI' }, // Hawaii
  { value: 'ID', label: 'ID' }, // Idaho
  { value: 'IL', label: 'IL' }, // Illinois
  { value: 'IN', label: 'IN' }, // Indiana
  { value: 'IA', label: 'IA' }, // Iowa
  { value: 'KS', label: 'KS' }, // Kansas
  { value: 'KY', label: 'KY' }, // Kentucky
  { value: 'LA', label: 'LA' }, // Louisiana
  { value: 'ME', label: 'ME' }, // Maine
  { value: 'MD', label: 'MD' }, // Maryland
  { value: 'MA', label: 'MA' }, // Massachusetts
  { value: 'MI', label: 'MI' }, // Michigan
  { value: 'MN', label: 'MN' }, // Minnesota
  { value: 'MS', label: 'MS' }, // Mississippi
  { value: 'MO', label: 'MO' }, // Missouri
  { value: 'MT', label: 'MT' }, // Montana
  { value: 'NE', label: 'NE' }, // Nebraska
  { value: 'NV', label: 'NV' }, // Nevada
  { value: 'NH', label: 'NH' }, // New Hampshire
  { value: 'NJ', label: 'NJ' }, // New Jersey
  { value: 'NM', label: 'NM' }, // New Mexico
  { value: 'NY', label: 'NY' }, // New York
  { value: 'NC', label: 'NC' }, // North Carolina
  { value: 'ND', label: 'ND' }, // North Dakota
  { value: 'OH', label: 'OH' }, // Ohio
  { value: 'OK', label: 'OK' }, // Oklahoma
  { value: 'OR', label: 'OR' }, // Oregon
  { value: 'PA', label: 'PA' }, // Pennsylvania
  { value: 'RI', label: 'RI' }, // Rhode Island
  { value: 'SC', label: 'SC' }, // South Carolina
  { value: 'SD', label: 'SD' }, // South Dakota
  { value: 'TN', label: 'TN' }, // Tennessee
  { value: 'TX', label: 'TX' }, // Texas
  { value: 'UT', label: 'UT' }, // Utah
  { value: 'VT', label: 'VT' }, // Vermont
  { value: 'VA', label: 'VA' }, // Virginia
  { value: 'VI', label: 'VI' },
  { value: 'WA', label: 'WA' }, // Washington
  { value: 'WV', label: 'WV' }, // West Virginia
  { value: 'WI', label: 'WI' }, // Wisconsin
  { value: 'WY', label: 'WY' }, // Wyoming
];

export type StateType = (typeof AllStates extends readonly (infer TElementType)[] ? TElementType : never)['value'];

export const AllStatesToNames: {
  [value in StateType]: string;
} = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VI: 'Virgin Islands',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export enum PatientEthnicity {
  'Hispanic or Latino' = 'Hispanic or Latino',
  'Not Hispanic or Latino' = 'Not Hispanic or Latino',
  'Decline to Specify' = 'Decline to Specify',
}

export enum PatientRace {
  'American Indian or Alaska Native' = 'American Indian or Alaska Native',
  'Asian' = 'Asian',
  'Black or African American' = 'Black or African American',
  'Native Hawaiian or Other Pacific Islander' = 'Native Hawaiian or Other Pacific Islander',
  'White' = 'White',
  'Decline to Specify' = 'Decline to Specify',
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
  getRandomState(): string {
    // const randomIndex = Math.floor(Math.random() * AllStates.length);
    // return AllStates[randomIndex].value;
    // Fetch all available states from the dropdown
    const availableStates = this.locator.patientState.evaluateAll(
      (options) =>
        options
          .map((option) => (option as HTMLOptionElement).value) // Explicitly cast to HTMLOptionElement
          .filter((value) => value !== '') // Exclude empty values
    );

    // Filter the list based on available options
    const validStates = AllStates.map((state) => state.value).filter(async (state) =>
      (await availableStates).includes(state)
    );

    if (validStates.length === 0) {
      throw new Error('No valid states are available in the dropdown');
    }

    // Select a random valid state
    return validStates[Math.floor(Math.random() * validStates.length)];
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
    await expect(this.locator.contactInformationHeading).toBeVisible();
  }
  async fillContactInformationRequiredFields(): Promise<void> {
    await this.fillStreetAddress();
    await this.page.waitForTimeout(500);
    await this.fillPatientCity();
    await this.page.waitForTimeout(500);
    await this.fillPatientState();
    await this.page.waitForTimeout(500);
    await this.fillPatientZip();
    await this.page.waitForTimeout(500);
  }
  async fillContactInformationAllFields(): Promise<void> {
    await this.fillContactInformationRequiredFields();
    await this.fillStreetAddressLine2();
    await this.fillMobileOptIn();
  }
  async fillStreetAddress(): Promise<void> {
    await this.locator.streetAddress.fill('Test address');
  }
  async fillStreetAddressLine2(): Promise<void> {
    await this.locator.streetAddressLine2.fill('Test Address Line 2');
  }
  async fillPatientCity(): Promise<void> {
    await this.locator.patientCity.fill('Test City');
  }
  async fillPatientState(): Promise<void> {
    const randomState = this.getRandomState();
    await this.locator.patientState.click();
    await this.locator.patientState.pressSequentially(randomState);
    await this.verifyOptionIsPresentAndSelect(randomState);
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
    await expect(this.locator.patientDetailsHeading).toBeVisible();
  }
  async fillEthnicity(): Promise<void> {
    const randomEthnicity = this.getRandomEthnicity();
    await this.locator.patientEthnicity.click();
    await this.verifyOptionIsPresentAndSelect(randomEthnicity);
  }
  async fillRace(): Promise<void> {
    const randomRace = this.getRandomRace();
    await this.locator.patientRace.click();
    await this.verifyOptionIsPresentAndSelect(randomRace);
  }
  async fillPreferredLanguage(): Promise<void> {
    const randomLanguage = this.getRandomElement(this.language);
    await this.locator.patientPreferredLanguage.click();
    await this.verifyOptionIsPresentAndSelect(randomLanguage);
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
    const birthSex = this.getRandomElement(this.birthSex);
    await this.locator.responsiblePartyBirthSex.click();
    await this.verifyOptionIsPresentAndSelect(birthSex);
  }
  async fillResponsiblePartyDOB(): Promise<void> {
    // TO DO
  }
  async fillResponsiblePartySelfRelationship(): Promise<void> {
    await this.locator.responsiblePartyRelationship.click();
    await this.page.getByRole('option', { name: this.relationshipResponsiblePartySelf }).click();
  }
  async fillResponsiblePartyNotSelfRelationship(): Promise<void> {
    const relationship = this.getRandomElement(this.relationshipResponsiblePartyNotSelf);
    await this.locator.responsiblePartyRelationship.click();
    await this.verifyOptionIsPresentAndSelect(relationship);
  }
  async fillConsentForms(): Promise<void> {
    const relationshipConsentForms = this.getRandomElement(this.relationshipConsentForms);
    await this.locator.hipaaAcknowledgement.check();
    await this.locator.consentToTreat.check();
    await this.locator.signature.click();
    await this.locator.signature.fill('Test signature');
    await this.locator.consentFullName.click();
    await this.locator.consentFullName.fill('Test consent full name');
    await this.locator.consentSignerRelationship.click();
    await this.verifyOptionIsPresentAndSelect(relationshipConsentForms);
  }
  async verifyOptionIsPresentAndSelect(value: string): Promise<void> {
    const options = await this.page.locator('[role="option"]').allInnerTexts();
    if (options.includes(value)) {
      await this.page.getByRole('option', { name: value, exact: true }).click();
    } else {
      console.warn(`Option '${value}' not found in the dropdown.`);
    }
  }
}
