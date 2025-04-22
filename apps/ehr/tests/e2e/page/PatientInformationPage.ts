import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { PatientHeader } from './PatientHeader';
import { formatPhoneNumberForQuestionarie } from 'utils';

export enum Field {
  PATIENT_LAST_NAME,
  PATIENT_FIRST_NAME,
  PATIENT_DOB,
  PATIENT_GENDER,
  DEMO_VISIT_STREET_ADDRESS,
  DEMO_VISIT_CITY,
  DEMO_VISIT_STATE,
  DEMO_VISIT_ZIP,
  PATIENT_EMAIL,
  PATIENT_PHONE_NUMBER,
  DEMO_VISIT_PATIENT_ETHNICITY,
  DEMO_VISIT_PATIENT_RACE,
  DEMO_VISIT_RESPONSIBLE_RELATIONSHIP,
  DEMO_VISIT_RESPONSIBLE_FIRST_NAME,
  DEMO_VISIT_RESPONSIBLE_LAST_NAME,
  DEMO_VISIT_RESPONSIBLE_BIRTHDATE,
  DEMO_VISIT_RESPONSIBLE_PHONE,
  DEMO_VISIT_PROVIDER_FIRST_NAME,
  DEMO_VISIT_PROVIDER_LAST_NAME,
  DEMO_VISIT_PRACTICE_NAME,
  DEMO_VISIT_PHYSICIAN_ADDRESS,
  DEMO_VISIT_PHYSICIAN_MOBILE,
  DEMO_VISIT_POINT_OF_DISCOVERY,
  DEMO_VISIT_PREFERRED_LANGUAGE,
}

const FIELD_TO_TEST_ID = new Map<Field, string>()
  .set(Field.PATIENT_LAST_NAME, dataTestIds.patientInformationContainer.patientLastName)
  .set(Field.PATIENT_FIRST_NAME, dataTestIds.patientInformationContainer.patientFirstName)
  .set(Field.PATIENT_DOB, dataTestIds.patientInformationContainer.patientDateOfBirth)
  .set(Field.PATIENT_GENDER, dataTestIds.patientInformationContainer.patientBirthSex)
  .set(Field.DEMO_VISIT_STREET_ADDRESS, dataTestIds.contactInformationContainer.streetAddress)
  .set(Field.DEMO_VISIT_CITY, dataTestIds.contactInformationContainer.city)
  .set(Field.DEMO_VISIT_STATE, dataTestIds.contactInformationContainer.state)
  .set(Field.DEMO_VISIT_ZIP, dataTestIds.contactInformationContainer.zip)
  .set(Field.PATIENT_EMAIL, dataTestIds.contactInformationContainer.patientEmail)
  .set(Field.PATIENT_PHONE_NUMBER, dataTestIds.contactInformationContainer.patientMobile)
  .set(Field.DEMO_VISIT_PATIENT_ETHNICITY, dataTestIds.patientDetailsContainer.patientsEthnicity)
  .set(Field.DEMO_VISIT_PATIENT_RACE, dataTestIds.patientDetailsContainer.patientsRace)
  .set(Field.DEMO_VISIT_RESPONSIBLE_RELATIONSHIP, dataTestIds.responsiblePartyInformationContainer.relationshipDropdown)
  .set(Field.DEMO_VISIT_RESPONSIBLE_FIRST_NAME, dataTestIds.responsiblePartyInformationContainer.firstName)
  .set(Field.DEMO_VISIT_RESPONSIBLE_LAST_NAME, dataTestIds.responsiblePartyInformationContainer.lastName)
  .set(Field.DEMO_VISIT_RESPONSIBLE_BIRTHDATE, dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown)
  .set(Field.DEMO_VISIT_RESPONSIBLE_PHONE, dataTestIds.responsiblePartyInformationContainer.phoneInput)
  .set(Field.DEMO_VISIT_POINT_OF_DISCOVERY, dataTestIds.patientDetailsContainer.sendMarketingMessages)
  .set(Field.DEMO_VISIT_PREFERRED_LANGUAGE, dataTestIds.patientDetailsContainer.preferredLanguage)
  .set(Field.DEMO_VISIT_PROVIDER_FIRST_NAME, dataTestIds.primaryCarePhysicianContainer.firstName)
  .set(Field.DEMO_VISIT_PROVIDER_LAST_NAME, dataTestIds.primaryCarePhysicianContainer.lastName)
  .set(Field.DEMO_VISIT_PRACTICE_NAME, dataTestIds.primaryCarePhysicianContainer.practiceName)
  .set(Field.DEMO_VISIT_PHYSICIAN_ADDRESS, dataTestIds.primaryCarePhysicianContainer.address)
  .set(Field.DEMO_VISIT_PHYSICIAN_MOBILE, dataTestIds.primaryCarePhysicianContainer.mobile);

export class PatientInformationPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  getPatientHeader(): PatientHeader {
    return new PatientHeader(this.#page);
  }

  async enterPatientLastName(patientLastName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.patientInformationContainer.patientLastName)
      .locator('input')
      .fill(patientLastName);
  }

  async verifyPatientLastName(patientLastName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientLastName).locator('input')
    ).toHaveValue(patientLastName);
  }

  async clearPatientLastName(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationContainer.patientLastName).locator('input').clear();
  }

  async verifyValidationErrorShown(field: Field): Promise<void> {
    await expect(
      this.#page.getByTestId(FIELD_TO_TEST_ID.get(field)!).locator('p:text("This field is required")')
    ).toBeVisible();
  }

  async enterPatientFirstName(patientFirstName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.patientInformationContainer.patientFirstName)
      .locator('input')
      .fill(patientFirstName);
  }

  async verifyPatientFirstName(patientFirstName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientFirstName).locator('input')
    ).toHaveValue(patientFirstName);
  }

  async clearPatientFirstName(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationContainer.patientFirstName).locator('input').clear();
  }

  async enterPatientMiddleName(patientMiddleName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.patientInformationContainer.patientMiddleName)
      .locator('input')
      .fill(patientMiddleName);
  }

  async verifyPatientMiddleName(patientMiddleName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientMiddleName).locator('input')
    ).toHaveValue(patientMiddleName);
  }

  async enterPatientSuffix(patientSuffix: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.patientInformationContainer.patientSuffix)
      .locator('input')
      .fill(patientSuffix);
  }

  async verifyPatientSuffix(patientSuffix: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientSuffix).locator('input')
    ).toHaveValue(patientSuffix);
  }

  async enterPatientPreferredName(patientPreferredName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.patientInformationContainer.patientPreferredName)
      .locator('input')
      .fill(patientPreferredName);
  }

  async verifyPatientPreferredName(patientPreferredName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientPreferredName).locator('input')
    ).toHaveValue(patientPreferredName);
  }

  async enterPatientDateOfBirth(patientDateOfBirth: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.patientInformationContainer.patientDateOfBirth).locator('input');
    await locator.click();
    await locator.pressSequentially(patientDateOfBirth);
  }

  async verifyPatientDateOfBirth(patientDateOfBirth: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientDateOfBirth).locator('input')
    ).toHaveValue(patientDateOfBirth);
  }

  async clearPatientDateOfBirth(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationContainer.patientDateOfBirth).locator('input').clear();
  }

  async selectPatientPreferredPronouns(pronouns: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationContainer.patientPreferredPronouns).click();
    await this.#page.getByText(pronouns, { exact: true }).click();
  }

  async verifyPatientPreferredPronouns(patientPreferredPronouns: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientPreferredPronouns).locator('input')
    ).toHaveValue(patientPreferredPronouns);
  }

  async selectPatientBirthSex(birthSex: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationContainer.patientBirthSex).click();
    await this.#page.getByText(birthSex, { exact: true }).click();
  }

  async verifyPatientBirthSex(patientBirthSex: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformationContainer.patientBirthSex).locator('input')
    ).toHaveValue(patientBirthSex);
  }

  async clearPatientBirthSex(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationContainer.patientBirthSex).locator('input').clear();
  }

  async enterStreetAddress(streetAddress: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.contactInformationContainer.streetAddress)
      .locator('input')
      .fill(streetAddress);
  }

  async verifyStreetAddress(streetAddress: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.contactInformationContainer.streetAddress).locator('input')
    ).toHaveValue(streetAddress);
  }

  async clearStreetAdress(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.streetAddress).locator('input').clear();
  }

  async enterAddressLineOptional(addressLineOptional: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.contactInformationContainer.addressLineOptional)
      .locator('input')
      .fill(addressLineOptional);
  }

  async verifyAddressLineOptional(addressLineOptional: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.contactInformationContainer.addressLineOptional).locator('input')
    ).toHaveValue(addressLineOptional);
  }

  async enterCity(city: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.city).locator('input').fill(city);
  }

  async verifyCity(city: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.contactInformationContainer.city).locator('input')).toHaveValue(
      city
    );
  }

  async clearCity(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.city).locator('input').clear();
  }

  async selectState(state: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.state).click();
    await this.#page.getByText(state, { exact: true }).click();
  }

  async verifyState(state: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.contactInformationContainer.state).locator('input')).toHaveValue(
      state
    );
  }

  async enterZip(zip: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.zip).locator('input').fill(zip);
  }

  async verifyZip(zip: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.contactInformationContainer.zip).locator('input')).toHaveValue(zip);
  }

  async verifyValidationErrorZipField(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.contactInformationContainer.zip).locator('p:text("Must be 5 digits")')
    ).toBeVisible();
  }

  async clearZip(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.zip).locator('input').clear();
  }

  async enterPatientEmail(email: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.patientEmail).locator('input').fill(email);
  }

  async verifyPatientEmail(email: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.contactInformationContainer.patientEmail).locator('input')
    ).toHaveValue(email);
  }

  async clearPatientEmail(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.patientEmail).locator('input').clear();
  }

  async verifyValidationErrorInvalidEmail(): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.contactInformationContainer.patientEmail)
        .locator('p:text("Must be in the format \\"email@example.com\\"")')
    ).toBeVisible();
  }

  async enterPatientMobile(patientMobile: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.contactInformationContainer.patientMobile)
      .locator('input')
      .fill(patientMobile);
  }

  async verifyPatientMobile(patientMobile: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.contactInformationContainer.patientMobile).locator('input')
    ).toHaveValue(formatPhoneNumberForQuestionarie(patientMobile));
  }

  async clearPatientMobile(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.patientMobile).locator('input').click();
    for (let i = 0; i <= 20; i++) {
      await this.#page.keyboard.press('Backspace');
    }
  }

  async verifyValidationErrorInvalidMobile(): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.contactInformationContainer.patientMobile)
        .locator('p:text("Phone number must be 10 digits in the format (xxx) xxx-xxxx")')
    ).toBeVisible();
  }

  async selectPatientEthnicity(patientEthnicity: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.patientsEthnicity).click();
    await this.#page.getByText(patientEthnicity, { exact: true }).click();
  }

  async verifyPatientEthnicity(patientEthnicity: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientDetailsContainer.patientsEthnicity).locator('input')
    ).toHaveValue(patientEthnicity);
  }

  async selectPatientRace(patientEthnicity: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.patientsRace).click();
    await this.#page.getByText(patientEthnicity, { exact: true }).click();
  }

  async verifyPatientRace(patientRace: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.patientDetailsContainer.patientsRace).locator('input')).toHaveValue(
      patientRace
    );
  }

  async selectHowDidYouHear(howDidYouHear: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.howDidYouHearAboutUs).click();
    await this.#page.getByText(howDidYouHear, { exact: true }).click();
  }

  async verifyHowDidYouHear(howDidYouHear: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientDetailsContainer.howDidYouHearAboutUs).locator('input')
    ).toHaveValue(howDidYouHear);
  }

  async selectMarketingMessaging(marketingMessaging: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.sendMarketingMessages).click();
    await this.#page.getByText(marketingMessaging, { exact: true }).click();
  }

  async verifyMarketingMessaging(marketingMessaging: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.patientDetailsContainer.sendMarketingMessages)).toHaveText(
      marketingMessaging
    );
  }

  async selectPreferredLanguage(preferredLanguage: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.preferredLanguage).click();
    await this.#page.getByText(preferredLanguage, { exact: true }).click();
  }

  async verifyPreferredLanguage(preferredLanguage: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientDetailsContainer.preferredLanguage).locator('input')
    ).toHaveValue(preferredLanguage);
  }

  async selectSexualOrientation(sexualOrientation: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.sexualOrientation).click();
    await this.#page.getByText(sexualOrientation, { exact: true }).click();
  }

  async verifySexualOrientation(sexualOrientation: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientDetailsContainer.sexualOrientation).locator('input')
    ).toHaveValue(sexualOrientation);
  }

  async selectGenderIdentity(genderIdentity: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.genderIdentity).click();
    await this.#page.getByText(genderIdentity, { exact: true }).click();
  }

  async verifyGenderIdentity(genderIdentity: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.patientDetailsContainer.genderIdentity)).toHaveText(genderIdentity);
  }
  async selectCommonwellConsent(commonwellConsent: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientDetailsContainer.commonWellConsent).click();
    await this.#page.getByText(commonwellConsent, { exact: true }).click();
  }

  async verifyCommonwellConsent(commonwellConsent: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.patientDetailsContainer.commonWellConsent)).toHaveText(
      commonwellConsent
    );
  }

  async selectRelationshipFromResponsibleContainer(relationship: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.relationshipDropdown).click();
    await this.#page.getByText(relationship, { exact: true }).click();
  }

  async verifyRelationshipFromResponsibleContainer(relationship: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.relationshipDropdown).locator('input')
    ).toHaveValue(relationship);
  }

  async enterFirstNameFromResponsibleContainer(firstName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.firstName)
      .locator('input')
      .fill(firstName);
  }

  async verifyFirstNameFromResponsibleContainer(firstName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.firstName).locator('input')
    ).toHaveValue(firstName);
  }

  async clearFirstNameFromResponsibleContainer(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.firstName).locator('input').clear();
  }

  async enterLastNameFromResponsibleContainer(lastName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.lastName)
      .locator('input')
      .fill(lastName);
  }

  async verifyLastNameFromResponsibleContainer(lastName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.lastName).locator('input')
    ).toHaveValue(lastName);
  }

  async clearLastNameFromResponsibleContainer(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.lastName).locator('input').clear();
  }

  async enterDateOfBirthFromResponsibleContainer(dateOfBirth: string): Promise<void> {
    const locator = this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown)
      .locator('input');
    await locator.click();
    await locator.pressSequentially(dateOfBirth);
  }

  async verifyDateOfBirthFromResponsibleContainer(dateOfBirth: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown).locator('input')
    ).toHaveValue(dateOfBirth);
  }

  async clearDateOfBirthFromResponsibleContainer(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown)
      .locator('input')
      .clear();
  }

  async selectBirthSexFromResponsibleContainer(birthSex: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.birthSexDropdown).click();
    await this.#page.locator('li').getByText(birthSex, { exact: true }).click();
  }

  async verifyBirthSexFromResponsibleContainer(birthSex: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.birthSexDropdown).locator('input')
    ).toHaveValue(birthSex);
  }

  async clearBirthSexFromResponsibleContainer(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.birthSexDropdown)
      .locator('input')
      .clear();
  }

  async enterPhoneFromResponsibleContainer(phone: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.phoneInput)
      .locator('input')
      .fill(phone);
  }

  async verifyPhoneFromResponsibleContainer(phone: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.phoneInput).locator('input')
    ).toHaveValue(phone);
  }

  async clearPhoneFromResponsibleContainer(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.phoneInput).locator('input').click();
    for (let i = 0; i <= 20; i++) {
      await this.#page.keyboard.press('Backspace');
    }
  }

  async enterStreetLine1FromResponsibleContainer(line1: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.addressLine1)
      .locator('input')
      .fill(line1);
  }

  async verifyStreetLine1FromResponsibleContainer(line1: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.addressLine1).locator('input')
    ).toHaveValue(line1);
  }

  async clearStreetLine1FromResponsibleContainer(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.addressLine1)
      .locator('input')
      .click();
    for (let i = 0; i <= 20; i++) {
      await this.#page.keyboard.press('Backspace');
    }
  }

  async enterResponsiblePartyCity(city: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.city).locator('input').fill(city);
  }

  async verifyResponsiblePartyCity(city: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.city).locator('input')
    ).toHaveValue(city);
  }

  async clearResponsiblePartyCity(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.city).locator('input').clear();
  }

  async selectResponsiblePartyState(state: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.state).click();
    await this.#page.getByText(state, { exact: true }).click();
  }

  async verifyResponsiblePartyState(state: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.state).locator('input')
    ).toHaveValue(state);
  }

  async enterResponsiblePartyZip(zip: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.zip).locator('input').fill(zip);
  }

  async verifyResponsiblePartyZip(zip: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.zip).locator('input')
    ).toHaveValue(zip);
  }

  async verifyResponsiblePartyValidationErrorZipField(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.zip).locator('p:text("Must be 5 digits")')
    ).toBeVisible();
  }

  async clearResponsiblePartyZip(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.zip).locator('input').clear();
  }

  async verifyValidationErrorInvalidPhoneFromResponsibleContainer(): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.responsiblePartyInformationContainer.phoneInput)
        .locator('p:text("Phone number must be 10 digits in the format (xxx) xxx-xxxx")')
    ).toBeVisible();
  }
  async selectReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown).click();
    await this.#page.getByText(releaseOfInfo, { exact: true }).click();
  }

  async verifyReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown)).toHaveText(
      releaseOfInfo
    );
  }

  async selectRxHistoryConsent(rxHistoryConsent: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.userSettingsContainer.RxHistoryConsentDropdown).click();
    await this.#page.getByText(rxHistoryConsent, { exact: true }).click();
  }

  async verifyRxHistoryConsent(rxHistoryConsent: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.userSettingsContainer.RxHistoryConsentDropdown).locator('input')
    ).toHaveValue(rxHistoryConsent);
  }

  async reloadPatientInformationPage(): Promise<void> {
    await this.#page.reload();
  }

  async clickSaveChangesButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.saveChangesButton).click();
    //await this.#page.waitForSelector('text=State was updated successfully');
  }

  async verifyUpdatedSuccessfullyMessageShown(): Promise<void> {
    await expect(this.#page.getByText('Patient information updated successfully')).toBeVisible();
  }

  async setCheckboxOff(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox)
      .locator('input')
      .setChecked(false);
  }

  async verifyCheckboxOff(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox).locator('input')
    ).toBeChecked({
      checked: false,
    });
  }

  async setCheckboxOn(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox)
      .locator('input')
      .setChecked(true);
  }

  async verifyCheckboxOn(): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox).locator('input')
    ).toBeChecked({
      checked: true,
    });
  }
  async enterFirstNameFromPcp(firstName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').fill(firstName);
  }

  async verifyFirstNameFromPcp(firstName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName).locator('input')
    ).toHaveValue(firstName);
  }

  async verifyFirstNameFromPcpIsVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').isVisible();
  }

  async verifyFirstNameFromPcpIsNotVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').isHidden();
  }

  async clearFirstNameFromPcp(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').clear();
  }

  async enterLastNameFromPcp(lastName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').fill(lastName);
  }

  async verifyLastNameFromPcp(lastName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName).locator('input')
    ).toHaveValue(lastName);
  }

  async verifyLastNameFromPcpIsVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').isVisible();
  }

  async verifyLastNameFromPcpIsNotVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').isHidden();
  }

  async clearLastNameFromPcp(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').clear();
  }

  async enterPracticeNameFromPcp(practiceName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName)
      .locator('input')
      .fill(practiceName);
  }

  async verifyPracticeNameFromPcp(practiceName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input')
    ).toHaveValue(practiceName);
  }

  async verifyPracticeNameFromPcpIsVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input').isVisible();
  }

  async verifyPracticeNameFromPcpIsNotVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input').isHidden();
  }

  async clearPracticeNameFromPcp(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input').clear();
  }

  async enterAddressFromPcp(address: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.address).locator('input').fill(address);
  }

  async verifyAddressFromPcp(address: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.address).locator('input')
    ).toHaveValue(address);
  }

  async verifyAddressFromPcpIsVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.address).locator('input').isVisible();
  }

  async verifyAddressFromPcpIsNotVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.address).locator('input').isHidden();
  }

  async clearAddressFromPcp(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.address).locator('input').clear();
  }

  async enterMobileFromPcp(mobile: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').fill(mobile);
  }

  async verifyMobileFromPcp(mobile: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile).locator('input')).toHaveValue(
      mobile
    );
  }

  async verifyMobileFromPcpIsVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').isVisible();
  }

  async verifyMobileFromPcpIsNotVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').isHidden();
  }

  async clearMobileFromPcp(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').clear();
  }
}

export async function expectPatientInformationPage(page: Page, patientId: string): Promise<PatientInformationPage> {
  await page.waitForURL('/patient/' + patientId + '/info');
  await page.locator('h3').getByText('Patient Information').isVisible();
  return new PatientInformationPage(page);
}

export async function openPatientInformationPage(page: Page, patientId: string): Promise<PatientInformationPage> {
  await page.goto('/patient/' + patientId + '/info');
  return expectPatientInformationPage(page, patientId);
}
