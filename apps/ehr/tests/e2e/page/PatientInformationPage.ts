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
  .set(Field.DEMO_VISIT_RESPONSIBLE_PHONE, dataTestIds.responsiblePartyInformationContainer.phoneInput);

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
