import { expect, Locator, Page } from '@playwright/test';
import { formatPhoneNumberForQuestionnaire, PATIENT_RECORD_CONFIG } from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { AddInsuranceDialog } from './patient-information/AddInsuranceDialog';
import { PatientHeader } from './PatientHeader';

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
  DEMO_VISIT_RESPONSIBLE_EMAIL,
  DEMO_VISIT_PROVIDER_FIRST_NAME,
  DEMO_VISIT_PROVIDER_LAST_NAME,
  DEMO_VISIT_PRACTICE_NAME,
  DEMO_VISIT_PHYSICIAN_ADDRESS,
  DEMO_VISIT_PHYSICIAN_MOBILE,
  DEMO_VISIT_POINT_OF_DISCOVERY,
  DEMO_VISIT_PREFERRED_LANGUAGE,
  GENDER_IDENTITY_ADDITIONAL_FIELD,
}

const patientSummary = PATIENT_RECORD_CONFIG.FormFields.patientSummary.items;
const contactInformation = PATIENT_RECORD_CONFIG.FormFields.patientContactInformation.items;
const patientDetails = PATIENT_RECORD_CONFIG.FormFields.patientDetails.items;
const responsibleParty = PATIENT_RECORD_CONFIG.FormFields.responsibleParty.items;
const primaryCarePhysician = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;

const FIELD_TO_TEST_ID = new Map<Field, string>()
  .set(Field.PATIENT_LAST_NAME, patientSummary.lastName.key)
  .set(Field.PATIENT_FIRST_NAME, patientSummary.firstName.key)
  .set(Field.PATIENT_DOB, patientSummary.birthDate.key)
  .set(Field.PATIENT_GENDER, patientSummary.birthSex.key)
  .set(Field.DEMO_VISIT_STREET_ADDRESS, contactInformation.streetAddress.key)
  .set(Field.DEMO_VISIT_CITY, contactInformation.city.key)
  .set(Field.DEMO_VISIT_STATE, contactInformation.state.key)
  .set(Field.DEMO_VISIT_ZIP, contactInformation.zip.key)
  .set(Field.PATIENT_EMAIL, contactInformation.email.key)
  .set(Field.PATIENT_PHONE_NUMBER, contactInformation.phone.key)
  .set(Field.DEMO_VISIT_PATIENT_ETHNICITY, patientDetails.ethnicity.key)
  .set(Field.DEMO_VISIT_PATIENT_RACE, patientDetails.race.key)
  .set(Field.DEMO_VISIT_RESPONSIBLE_RELATIONSHIP, responsibleParty.relationship.key)
  .set(Field.DEMO_VISIT_RESPONSIBLE_FIRST_NAME, responsibleParty.firstName.key)
  .set(Field.DEMO_VISIT_RESPONSIBLE_LAST_NAME, responsibleParty.lastName.key)
  .set(Field.DEMO_VISIT_RESPONSIBLE_BIRTHDATE, responsibleParty.birthDate.key)
  .set(Field.DEMO_VISIT_RESPONSIBLE_PHONE, responsibleParty.phone.key)
  .set(Field.DEMO_VISIT_RESPONSIBLE_EMAIL, responsibleParty.email.key)
  .set(Field.DEMO_VISIT_POINT_OF_DISCOVERY, patientDetails.sendMarketing.key)
  .set(Field.DEMO_VISIT_PREFERRED_LANGUAGE, patientDetails.language.key)
  .set(Field.DEMO_VISIT_PROVIDER_FIRST_NAME, primaryCarePhysician.firstName.key)
  .set(Field.DEMO_VISIT_PROVIDER_LAST_NAME, primaryCarePhysician.lastName.key)
  .set(Field.DEMO_VISIT_PRACTICE_NAME, primaryCarePhysician.practiceName.key)
  .set(Field.DEMO_VISIT_PHYSICIAN_ADDRESS, primaryCarePhysician.address.key)
  .set(Field.DEMO_VISIT_PHYSICIAN_MOBILE, primaryCarePhysician.phone.key)
  .set(Field.GENDER_IDENTITY_ADDITIONAL_FIELD, patientDetails.genderIdentityDetails.key);

export class PatientInformationPage {
  #page: Page;
  #insuranceCards: InsuranceCard[];

  constructor(page: Page) {
    this.#page = page;
    this.#insuranceCards = [
      new InsuranceCard(page.getByTestId('insuranceContainer').nth(0)),
      new InsuranceCard(page.getByTestId('insuranceContainer').nth(1)),
    ];
  }

  getPatientHeader(): PatientHeader {
    return new PatientHeader(this.#page);
  }

  getInsuranceCard(index: number): InsuranceCard {
    return this.#insuranceCards[index];
  }

  inputByName(name: string): Locator {
    return this.#page.locator(`input[name="${name}"]`);
  }

  inputById(id: string): Locator {
    return this.#page.locator(`#${id}`).locator('input');
  }

  selectById(id: string): Locator {
    return this.#page.locator(`#${id}`);
  }

  errorForField(fieldKey: string, errorText: string): Locator {
    // First try to find error within the wrapper with ID (for regular fields)
    // Then fall back to finding it near the input by name (for grouped fields like city/state/zip)
    const wrapperSelector = this.#page.locator(`#${fieldKey}`);
    const inputSelector = this.#page.locator(`input[name="${fieldKey}"]`);

    return wrapperSelector
      .getByText(errorText)
      .or(inputSelector.locator('xpath=ancestor::*[contains(@class, "MuiFormControl-root")]').getByText(errorText));
  }

  async verifyPatientFirstNameFieldEnabled(): Promise<void> {
    await expect(
      this.inputByName(patientSummary.firstName.key)
      // this.#page.getByTestId(dataTestIds.patientInformationContainer.patientFirstName).locator('input')
    ).toBeEnabled();
  }

  async enterPatientLastName(patientLastName: string): Promise<void> {
    await this.inputByName(patientSummary.lastName.key).fill(patientLastName);
  }

  async verifyPatientLastName(patientLastName: string): Promise<void> {
    await expect(this.inputByName(patientSummary.lastName.key)).toHaveValue(patientLastName);
  }

  async clearPatientLastName(): Promise<void> {
    await this.inputByName(patientSummary.lastName.key).clear();
  }

  async verifyValidationErrorShown(field: Field): Promise<void> {
    await expect(this.errorForField(FIELD_TO_TEST_ID.get(field)!, 'This field is required')).toBeVisible();
  }

  async enterPatientFirstName(patientFirstName: string): Promise<void> {
    await this.inputByName(patientSummary.firstName.key).fill(patientFirstName);
  }

  async verifyPatientFirstName(patientFirstName: string): Promise<void> {
    await expect(this.inputByName(patientSummary.firstName.key)).toHaveValue(patientFirstName);
  }

  async clearPatientFirstName(): Promise<void> {
    await this.inputByName(patientSummary.firstName.key).clear();
  }

  async enterPatientMiddleName(patientMiddleName: string): Promise<void> {
    await this.inputByName(patientSummary.middleName.key).fill(patientMiddleName);
  }

  async verifyPatientMiddleName(patientMiddleName: string): Promise<void> {
    await expect(this.inputByName(patientSummary.middleName.key)).toHaveValue(patientMiddleName);
  }

  async enterPatientSuffix(patientSuffix: string): Promise<void> {
    await this.inputByName(patientSummary.suffix.key).fill(patientSuffix);
  }

  async verifyPatientSuffix(patientSuffix: string): Promise<void> {
    await expect(this.inputByName(patientSummary.suffix.key)).toHaveValue(patientSuffix);
  }

  async enterPatientPreferredName(patientPreferredName: string): Promise<void> {
    await this.inputByName(patientSummary.preferredName.key).fill(patientPreferredName);
  }

  async verifyPatientPreferredName(patientPreferredName: string): Promise<void> {
    await expect(this.inputByName(patientSummary.preferredName.key)).toHaveValue(patientPreferredName);
  }

  async enterPatientDateOfBirth(patientDateOfBirth: string): Promise<void> {
    const locator = this.inputByName(patientSummary.birthDate.key);
    await locator.click();
    await locator.pressSequentially(patientDateOfBirth);
  }

  async verifyPatientDateOfBirth(patientDateOfBirth: string): Promise<void> {
    await expect(this.inputByName(patientSummary.birthDate.key)).toHaveValue(patientDateOfBirth);
  }

  async clearPatientDateOfBirth(): Promise<void> {
    await this.inputByName(patientSummary.birthDate.key).clear();
  }

  async selectPatientPreferredPronouns(pronouns: string): Promise<void> {
    await this.selectById(patientSummary.pronouns.key).click();
    await this.#page.getByRole('option', { name: pronouns, exact: true }).click();
  }

  async verifyPatientPreferredPronouns(patientPreferredPronouns: string): Promise<void> {
    await expect(this.inputByName(patientSummary.pronouns.key)).toHaveValue(patientPreferredPronouns);
  }

  async selectPatientBirthSex(birthSex: string): Promise<void> {
    await this.selectById(patientSummary.birthSex.key).click();
    await this.#page.getByRole('option', { name: birthSex, exact: true }).click();
  }

  async verifyPatientBirthSex(patientBirthSex: string): Promise<void> {
    await expect(this.inputByName(patientSummary.birthSex.key)).toHaveValue(patientBirthSex);
  }

  async clearPatientBirthSex(): Promise<void> {
    await this.inputByName(patientSummary.birthSex.key).clear();
  }

  async enterStreetAddress(streetAddress: string): Promise<void> {
    await this.inputByName(contactInformation.streetAddress.key).fill(streetAddress);
  }

  async verifyStreetAddress(streetAddress: string): Promise<void> {
    await expect(this.inputByName(contactInformation.streetAddress.key)).toHaveValue(streetAddress);
  }

  async clearStreetAddress(): Promise<void> {
    await this.inputByName(contactInformation.streetAddress.key).clear();
  }

  async enterAddressLineOptional(addressLineOptional: string): Promise<void> {
    await this.inputByName(contactInformation.addressLine2.key).fill(addressLineOptional);
  }

  async verifyAddressLineOptional(addressLineOptional: string): Promise<void> {
    await expect(this.inputByName(contactInformation.addressLine2.key)).toHaveValue(addressLineOptional);
  }

  async enterCity(city: string): Promise<void> {
    await this.inputByName(contactInformation.city.key).fill(city);
  }

  async verifyCity(city: string): Promise<void> {
    await expect(this.inputByName(contactInformation.city.key)).toHaveValue(city);
  }

  async clearCity(): Promise<void> {
    await this.inputByName(contactInformation.city.key).clear();
  }

  async selectState(state: string): Promise<void> {
    await this.selectById(contactInformation.state.key).click();
    await this.#page.getByRole('option', { name: state, exact: true }).click();
  }

  async verifyState(state: string): Promise<void> {
    await expect(this.inputByName(contactInformation.state.key)).toHaveValue(state);
  }

  async enterZip(zip: string): Promise<void> {
    await this.inputByName(contactInformation.zip.key).fill(zip);
  }

  async verifyZip(zip: string): Promise<void> {
    await expect(this.inputByName(contactInformation.zip.key)).toHaveValue(zip);
  }

  async verifyValidationErrorZipField(): Promise<void> {
    await expect(this.errorForField(contactInformation.zip.key, 'Must be 5 digits')).toBeVisible();
  }

  async clearZip(): Promise<void> {
    await this.inputByName(contactInformation.zip.key).clear();
  }

  async enterPatientEmail(email: string): Promise<void> {
    await this.inputByName(contactInformation.email.key).fill(email);
  }

  async verifyPatientEmail(email: string): Promise<void> {
    await expect(this.inputByName(contactInformation.email.key)).toHaveValue(email);
  }

  async clearPatientEmail(): Promise<void> {
    await this.inputByName(contactInformation.email.key).clear();
  }

  async verifyValidationErrorInvalidEmail(): Promise<void> {
    await expect(
      this.errorForField(contactInformation.email.key, 'Must be in the format "email@example.com"')
    ).toBeVisible();
  }

  async enterPatientMobile(patientMobile: string): Promise<void> {
    await this.inputByName(contactInformation.phone.key).fill(patientMobile);
  }

  async verifyPatientMobile(patientMobile: string): Promise<void> {
    await expect(this.inputByName(contactInformation.phone.key)).toHaveValue(
      formatPhoneNumberForQuestionnaire(patientMobile)
    );
  }

  async clearPatientMobile(): Promise<void> {
    await this.selectById(contactInformation.phone.key).click();
    for (let i = 0; i <= 20; i++) {
      await this.#page.keyboard.press('Backspace');
    }
  }

  async verifyValidationErrorInvalidMobile(): Promise<void> {
    await expect(
      this.errorForField(contactInformation.phone.key, 'Phone number must be 10 digits in the format (xxx) xxx-xxxx')
    ).toBeVisible();
  }
  async enterHomePhoneNumber(homePhoneNumber: string): Promise<void> {
    await this.inputByName(contactInformation.homePhone.key).fill(homePhoneNumber);
  }

  async verifyHomePhoneNumber(homePhoneNumber: string): Promise<void> {
    await expect(this.inputByName(contactInformation.homePhone.key)).toHaveValue(
      formatPhoneNumberForQuestionnaire(homePhoneNumber)
    );
  }

  async clearHomePhoneNumber(): Promise<void> {
    await this.selectById(contactInformation.homePhone.key).click();
    for (let i = 0; i <= 20; i++) {
      await this.#page.keyboard.press('Backspace');
    }
  }
  async verifyValidationErrorInvalidPhoneFromHomeNumber(): Promise<void> {
    await expect(
      this.errorForField(
        contactInformation.homePhone.key,
        'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
      )
    ).toBeVisible();
  }

  async selectPatientEthnicity(patientEthnicity: string): Promise<void> {
    await this.selectById(patientDetails.ethnicity.key).click();
    await this.#page.getByRole('option', { name: patientEthnicity, exact: true }).click();
  }

  async verifyPatientEthnicity(patientEthnicity: string): Promise<void> {
    await expect(this.inputByName(patientDetails.ethnicity.key)).toHaveValue(patientEthnicity);
  }

  async selectPatientRace(patientRace: string): Promise<void> {
    await this.selectById(patientDetails.race.key).click();
    await this.#page.getByRole('option', { name: patientRace, exact: true }).click();
  }

  async verifyPatientRace(patientRace: string): Promise<void> {
    await expect(this.inputByName(patientDetails.race.key)).toHaveValue(patientRace);
  }

  async selectHowDidYouHear(howDidYouHear: string): Promise<void> {
    await this.selectById(patientDetails.pointOfDiscovery.key).click();
    await this.#page.getByRole('option', { name: howDidYouHear, exact: true }).click();
  }

  async verifyHowDidYouHear(howDidYouHear: string): Promise<void> {
    await expect(this.inputByName(patientDetails.pointOfDiscovery.key)).toHaveValue(howDidYouHear);
  }

  async selectMarketingMessaging(selected: boolean): Promise<void> {
    const input = this.inputByName(patientDetails.sendMarketing.key);
    const isChecked = await input.isChecked();
    if (isChecked !== selected) {
      await input.click();
    }
  }

  async verifyMarketingMessaging(marketingMessaging: boolean): Promise<void> {
    if (marketingMessaging) {
      await expect(this.inputByName(patientDetails.sendMarketing.key)).toBeChecked();
    } else {
      await expect(this.inputByName(patientDetails.sendMarketing.key)).not.toBeChecked();
    }

    //await expect(this.byName(patientDetails.sendMarketing.key)).toHaveText(marketingMessaging);
  }

  async selectPreferredLanguage(preferredLanguage: string): Promise<void> {
    await this.selectById(patientDetails.language.key).click();
    await this.#page.getByRole('option', { name: preferredLanguage, exact: true }).click();
  }

  async verifyPreferredLanguage(preferredLanguage: string): Promise<void> {
    await expect(this.inputByName(patientDetails.language.key)).toHaveValue(preferredLanguage);
  }

  async selectSexualOrientation(sexualOrientation: string): Promise<void> {
    await this.selectById(patientDetails.sexualOrientation.key).click();
    await this.#page.getByRole('option', { name: sexualOrientation, exact: true }).click();
  }

  async verifySexualOrientation(sexualOrientation: string): Promise<void> {
    await expect(this.inputByName(patientDetails.sexualOrientation.key)).toHaveValue(sexualOrientation);
  }

  async selectGenderIdentity(genderIdentity: string): Promise<void> {
    await this.selectById(patientDetails.genderIdentity.key).click();
    await this.#page.getByRole('option', { name: genderIdentity, exact: true }).click();
  }

  async verifyGenderIdentity(genderIdentity: string): Promise<void> {
    await expect(this.inputByName(patientDetails.genderIdentity.key)).toHaveText(genderIdentity);
  }

  async verifyOtherGenderFieldIsVisible(): Promise<void> {
    await this.inputByName(patientDetails.genderIdentityDetails.key).isVisible();
  }

  async verifyOtherGenderFieldIsNotVisible(): Promise<void> {
    await this.inputByName(patientDetails.genderIdentityDetails.key).isHidden();
  }

  async enterOtherGenderField(specifyInput: string): Promise<void> {
    await this.inputByName(patientDetails.genderIdentityDetails.key).fill(specifyInput);
  }

  async verifyOtherGenderInput(specifyInput: string): Promise<void> {
    await expect(this.inputByName(patientDetails.genderIdentityDetails.key)).toHaveValue(specifyInput);
  }

  async selectCommonWellConsent(commonWellConsent: string): Promise<void> {
    await this.selectById(patientDetails.commonWellConsent.key).click();
    await this.#page.getByRole('option', { name: commonWellConsent, exact: true }).click();
  }

  async verifyCommonWellConsent(commonWellConsent: string): Promise<void> {
    await expect(this.inputByName(patientDetails.commonWellConsent.key)).toHaveText(commonWellConsent);
  }

  async selectRelationshipFromResponsibleContainer(relationship: string): Promise<void> {
    await this.selectById(responsibleParty.relationship.key).click();
    await this.#page.getByRole('option', { name: relationship, exact: true }).click();
  }

  async verifyRelationshipFromResponsibleContainer(relationship: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.relationship.key)).toHaveValue(relationship);
  }

  async enterFirstNameFromResponsibleContainer(firstName: string): Promise<void> {
    await this.inputByName(responsibleParty.firstName.key).fill(firstName);
  }

  async verifyFirstNameFromResponsibleContainer(firstName: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.firstName.key)).toHaveValue(firstName);
  }

  async clearFirstNameFromResponsibleContainer(): Promise<void> {
    await this.inputByName(responsibleParty.firstName.key).clear();
  }

  async enterLastNameFromResponsibleContainer(lastName: string): Promise<void> {
    await this.inputByName(responsibleParty.lastName.key).fill(lastName);
  }

  async verifyLastNameFromResponsibleContainer(lastName: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.lastName.key)).toHaveValue(lastName);
  }

  async clearLastNameFromResponsibleContainer(): Promise<void> {
    await this.inputByName(responsibleParty.lastName.key).clear();
  }

  async enterDateOfBirthFromResponsibleContainer(dateOfBirth: string): Promise<void> {
    const locator = this.inputByName(responsibleParty.birthDate.key);
    await locator.click();
    await locator.pressSequentially(dateOfBirth);
  }

  async verifyDateOfBirthFromResponsibleContainer(dateOfBirth: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.birthDate.key)).toHaveValue(dateOfBirth);
  }

  async verifyValidationErrorForDateOfBirth(): Promise<void> {
    await expect(
      this.errorForField(responsibleParty.birthDate.key, 'Responsible party should be older than 18 years')
    ).toBeVisible();
  }

  async clearDateOfBirthFromResponsibleContainer(): Promise<void> {
    await this.inputByName(responsibleParty.birthDate.key).clear();
  }

  async selectBirthSexFromResponsibleContainer(birthSex: string): Promise<void> {
    await this.selectById(responsibleParty.birthSex.key).click();
    await this.#page.getByRole('option', { name: birthSex, exact: true }).click();
  }

  async verifyBirthSexFromResponsibleContainer(birthSex: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.birthSex.key)).toHaveValue(birthSex);
  }

  async clearBirthSexFromResponsibleContainer(): Promise<void> {
    await this.inputByName(responsibleParty.birthSex.key).clear();
  }

  async enterPhoneFromResponsibleContainer(phone: string): Promise<void> {
    await this.inputByName(responsibleParty.phone.key).fill(phone);
  }

  async verifyPhoneFromResponsibleContainer(phone: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.phone.key)).toHaveValue(phone);
  }

  async clearPhoneFromResponsibleContainer(): Promise<void> {
    await this.inputByName(responsibleParty.phone.key).clear();
  }

  async enterEmailFromResponsibleContainer(email: string): Promise<void> {
    await this.inputByName(responsibleParty.email.key).fill(email);
  }

  async verifyEmailFromResponsibleContainer(email: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.email.key)).toHaveValue(email);
  }

  async clearEmailFromResponsibleContainer(): Promise<void> {
    await this.inputByName(responsibleParty.email.key).clear();
  }

  async enterStreetLine1FromResponsibleContainer(line1: string): Promise<void> {
    await this.inputByName(responsibleParty.addressLine1.key).fill(line1);
  }

  async verifyStreetLine1FromResponsibleContainer(line1: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.addressLine1.key)).toHaveValue(line1);
  }

  async clearStreetLine1FromResponsibleContainer(): Promise<void> {
    await this.inputByName(responsibleParty.addressLine1.key).clear();
  }

  async enterResponsiblePartyCity(city: string): Promise<void> {
    await this.inputByName(responsibleParty.city.key).fill(city);
  }

  async verifyResponsiblePartyCity(city: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.city.key)).toHaveValue(city);
  }

  async clearResponsiblePartyCity(): Promise<void> {
    await this.inputByName(responsibleParty.city.key).clear();
  }

  async selectResponsiblePartyState(state: string): Promise<void> {
    await this.selectById(responsibleParty.state.key).click();
    await this.#page.getByRole('option', { name: state, exact: true }).click();
  }

  async verifyResponsiblePartyState(state: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.state.key)).toHaveValue(state);
  }

  async enterResponsiblePartyZip(zip: string): Promise<void> {
    await this.inputByName(responsibleParty.zip.key).fill(zip);
  }

  async verifyResponsiblePartyZip(zip: string): Promise<void> {
    await expect(this.inputByName(responsibleParty.zip.key)).toHaveValue(zip);
  }

  async verifyResponsiblePartyValidationErrorZipField(): Promise<void> {
    await expect(this.errorForField(responsibleParty.zip.key, 'Must be 5 digits')).toBeVisible();
  }

  async clearResponsiblePartyZip(): Promise<void> {
    await this.inputByName(responsibleParty.zip.key).clear();
  }

  async verifyValidationErrorInvalidPhoneFromResponsibleContainer(): Promise<void> {
    await expect(
      this.errorForField(responsibleParty.phone.key, 'Phone number must be 10 digits in the format (xxx) xxx-xxxx')
    ).toBeVisible();
  }
  async selectReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown).click();
    await this.#page.getByRole('option', { name: releaseOfInfo, exact: true }).click();
  }

  async verifyReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown)).toHaveText(
      releaseOfInfo
    );
  }

  async selectRxHistoryConsent(rxHistoryConsent: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.userSettingsContainer.RxHistoryConsentDropdown).click();
    await this.#page.getByRole('option', { name: rxHistoryConsent, exact: true }).click();
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
    await this.inputByName(primaryCarePhysician.active.key).setChecked(false);
  }

  async verifyCheckboxOff(): Promise<void> {
    await expect(this.inputByName(primaryCarePhysician.active.key)).not.toBeChecked();
  }

  async verifyLoadingScreenIsNotVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.loadingScreen).waitFor({ state: 'detached' });
  }

  async setCheckboxOn(): Promise<void> {
    await this.inputByName(primaryCarePhysician.active.key).setChecked(true);
  }

  async verifyCheckboxOn(): Promise<void> {
    await expect(this.inputByName(primaryCarePhysician.active.key)).toBeChecked();
  }
  async enterFirstNameFromPcp(firstName: string): Promise<void> {
    await this.inputByName(primaryCarePhysician.firstName.key).fill(firstName);
  }

  async verifyFirstNameFromPcp(firstName: string): Promise<void> {
    await expect(this.inputByName(primaryCarePhysician.firstName.key)).toHaveValue(firstName);
  }

  async verifyFirstNameFromPcpIsVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.firstName.key).isVisible();
  }

  async verifyFirstNameFromPcpIsNotVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.firstName.key).isHidden();
  }

  async clearFirstNameFromPcp(): Promise<void> {
    await this.inputByName(primaryCarePhysician.firstName.key).clear();
  }

  async enterLastNameFromPcp(lastName: string): Promise<void> {
    await this.inputByName(primaryCarePhysician.lastName.key).fill(lastName);
  }

  async verifyLastNameFromPcp(lastName: string): Promise<void> {
    await expect(this.inputByName(primaryCarePhysician.lastName.key)).toHaveValue(lastName);
  }

  async verifyLastNameFromPcpIsVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.lastName.key).isVisible();
  }

  async verifyLastNameFromPcpIsNotVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.lastName.key).isHidden();
  }

  async clearLastNameFromPcp(): Promise<void> {
    await this.inputByName(primaryCarePhysician.lastName.key).clear();
  }

  async enterPracticeNameFromPcp(practiceName: string): Promise<void> {
    await this.inputByName(primaryCarePhysician.practiceName.key).fill(practiceName);
  }

  async verifyPracticeNameFromPcp(practiceName: string): Promise<void> {
    await expect(this.inputByName(primaryCarePhysician.practiceName.key)).toHaveValue(practiceName);
  }

  async verifyPracticeNameFromPcpIsVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.practiceName.key).isVisible();
  }

  async verifyPracticeNameFromPcpIsNotVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.practiceName.key).isHidden();
  }

  async clearPracticeNameFromPcp(): Promise<void> {
    await this.inputByName(primaryCarePhysician.practiceName.key).clear();
  }

  async enterAddressFromPcp(address: string): Promise<void> {
    await this.inputByName(primaryCarePhysician.address.key).fill(address);
  }

  async verifyAddressFromPcp(address: string): Promise<void> {
    await expect(this.inputByName(primaryCarePhysician.address.key)).toHaveValue(address);
  }

  async verifyAddressFromPcpIsVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.address.key).isVisible();
  }

  async verifyAddressFromPcpIsNotVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.address.key).isHidden();
  }

  async clearAddressFromPcp(): Promise<void> {
    await this.inputByName(primaryCarePhysician.address.key).clear();
  }

  async enterMobileFromPcp(mobile: string): Promise<void> {
    await this.inputByName(primaryCarePhysician.phone.key).fill(mobile);
  }

  async verifyMobileFromPcp(mobile: string): Promise<void> {
    await expect(this.inputByName(primaryCarePhysician.phone.key)).toHaveValue(mobile);
  }

  async verifyMobileFromPcpIsVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.phone.key).isVisible();
  }

  async verifyMobileFromPcpIsNotVisible(): Promise<void> {
    await this.inputByName(primaryCarePhysician.phone.key).isHidden();
  }

  async verifyValidationErrorInvalidPhoneFromPcp(): Promise<void> {
    await expect(
      this.errorForField(primaryCarePhysician.phone.key, 'Phone number must be 10 digits in the format (xxx) xxx-xxxx')
    ).toBeVisible();
  }

  async clearMobileFromPcp(): Promise<void> {
    await this.inputByName(primaryCarePhysician.phone.key).clear();
  }

  async clickAddInsuranceButton(): Promise<AddInsuranceDialog> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.addInsuranceButton).click();
    await this.#page.getByTestId(dataTestIds.addInsuranceDialog.id).isVisible();
    return new AddInsuranceDialog(this.#page.getByTestId(dataTestIds.addInsuranceDialog.id));
  }

  async verifyAddInsuranceButtonIsHidden(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.addInsuranceButton).isHidden();
  }

  async verifyAddInsuranceButtonIsVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.addInsuranceButton).isVisible();
  }

  async verifyCoverageAddedSuccessfullyMessageShown(): Promise<void> {
    await expect(this.#page.getByText('Coverage added to patient account successfully.')).toBeVisible();
  }

  async verifyCoverageRemovedMessageShown(): Promise<void> {
    await expect(this.#page.getByText('Coverage removed from patient account')).toBeVisible();
  }

  async clickCloseButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientHeader.closeButton).click();
  }

  async clickPatientNameBreadcrumb(patientName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.breadcrumb).getByText(patientName).click();
  }

  async clickPatientsBreadcrumb(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.breadcrumb).getByText('Patients').click();
  }
}

export class InsuranceCard {
  #container: Locator;

  constructor(container: Locator) {
    this.#container = container;
  }

  async waitUntilInsuranceCarrierIsRendered(): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.insuranceCarrier).locator('input')
    ).not.toHaveValue('');
  }

  async verifyInsuranceType(type: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.insuranceContainer.type).locator('input')).toHaveValue(type);
  }

  async verifyInsuranceCarrier(insuranceCarrier: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.insuranceCarrier).locator('input')
    ).toHaveValue(insuranceCarrier);
  }

  async verifyPlanType(planType: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.insurancePlanType).locator('input')
    ).toHaveValue(planType);
  }

  async verifyMemberId(memberId: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.insuranceContainer.memberId).locator('input')).toHaveValue(
      memberId
    );
  }

  async clickShowMoreButton(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.showMoreButton).click();
  }

  async verifyPolicyHoldersFirstName(firstName: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersFirstName).locator('input')
    ).toHaveValue(firstName);
  }

  async verifyPolicyHoldersLastName(lastName: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersLastName).locator('input')
    ).toHaveValue(lastName);
  }

  async verifyPolicyHoldersMiddleName(middleName: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersMiddleName).locator('input')
    ).toHaveValue(middleName);
  }

  async verifyPolicyHoldersDateOfBirth(policyHoldersDateOfBirth: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersDateOfBirth).locator('input')
    ).toHaveValue(policyHoldersDateOfBirth);
  }

  async verifyPolicyHoldersSex(sex: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersSex).locator('input')
    ).toHaveValue(sex);
  }

  async verifyInsuranceStreetAddress(streetAddress: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.streetAddress).locator('input')
    ).toHaveValue(streetAddress);
  }

  async verifyInsuranceAddressLine2(addressLine2: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.insuranceContainer.addressLine2).locator('input')).toHaveValue(
      addressLine2
    );
  }

  async verifyInsuranceCity(city: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.insuranceContainer.city).locator('input')).toHaveValue(city);
  }

  async verifyInsuranceState(state: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.insuranceContainer.state).locator('input')).toHaveValue(state);
  }

  async verifyInsuranceZip(zip: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.insuranceContainer.zip).locator('input')).toHaveValue(zip);
  }

  async verifyPatientsRelationshipToInjured(relationship: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.insuranceContainer.relationship).locator('input')).toHaveValue(
      relationship
    );
  }

  async verifyAdditionalInsuranceInformation(additionalInfo: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.additionalInformation).locator('input')
    ).toHaveValue(additionalInfo);
  }

  async verifyAlwaysShownFieldsAreVisible(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.type).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.insuranceCarrier).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.memberId).locator('input').isVisible();
  }

  async verifyAdditionalFieldsAreVisible(): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersFirstName)
      .locator('input')
      .isVisible();
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersMiddleName)
      .locator('input')
      .isVisible();
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersLastName)
      .locator('input')
      .isVisible();
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersDateOfBirth)
      .locator('input')
      .isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersSex).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.streetAddress).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.addressLine2).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.city).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.state).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.zip).locator('input').isVisible();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.relationship).locator('input').isVisible();
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.additionalInformation)
      .locator('input')
      .isVisible();
  }

  async verifyAdditionalFieldsAreHidden(): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersFirstName)
      .locator('input')
      .isHidden();
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersMiddleName)
      .locator('input')
      .isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersLastName).locator('input').isHidden();
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersDateOfBirth)
      .locator('input')
      .isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersSex).locator('input').isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.streetAddress).locator('input').isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.addressLine2).locator('input').isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.city).locator('input').isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.state).locator('input').isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.zip).locator('input').isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.relationship).locator('input').isHidden();
    await this.#container.getByTestId(dataTestIds.insuranceContainer.additionalInformation).locator('input').isHidden();
  }

  async clearMemberIdField(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.memberId).locator('input').clear();
  }

  async clearPolicyHolderFirstNameField(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersFirstName).locator('input').clear();
  }

  async clearPolicyHolderLastNameField(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersLastName).locator('input').clear();
  }

  async clearDateOfBirthFromInsuranceContainer(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersDateOfBirth).locator('input').clear();
  }

  async clearStreetAddressFromInsuranceContainer(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.streetAddress).locator('input').clear();
  }

  async clearCityFromInsuranceContainer(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.city).locator('input').clear();
  }

  async clearZipFromInsuranceContainer(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.zip).locator('input').clear();
  }

  async verifyValidationErrorShown(testId: string): Promise<void> {
    await expect(this.#container.getByTestId(testId).locator('p:text("This field is required")')).toBeVisible();
  }

  async verifyValidationErrorZipFieldFromInsurance(): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.insuranceContainer.zip).locator('p:text("Must be 5 digits")')
    ).toBeVisible();
  }

  async verifyValidationErrorOnPrimaryInsuranceType(): Promise<void> {
    await expect(
      this.#container
        .getByTestId(dataTestIds.insuranceContainer.type)
        .locator('p:text("Account may not have two secondary insurance plans")')
    ).toBeVisible();
  }

  async verifyValidationErrorOnSecondaryInsuranceType(): Promise<void> {
    await expect(
      this.#container
        .getByTestId(dataTestIds.insuranceContainer.type)
        .locator('p:text("Account may not have two primary insurance plans")')
    ).toBeVisible();
  }

  async selectInsuranceType(type: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.type).click();
    await this.#container.page().locator(`li:text("${type}")`).click();
  }

  async selectInsuranceCarrier(insuranceCarrier: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.insuranceCarrier).click();
    await this.#container.page().locator(`li:text("${insuranceCarrier}")`).click();
  }

  async enterPlanType(planType: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.insurancePlanType).click();
    await this.#container.page().locator(`li:text("${planType}")`).click();
  }

  async enterMemberId(memberId: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.memberId).locator('input').fill(memberId);
  }

  async enterPolicyHolderFirstName(firstName: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersFirstName)
      .locator('input')
      .fill(firstName);
  }

  async enterPolicyHolderMiddleName(middleName: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersMiddleName)
      .locator('input')
      .fill(middleName);
  }

  async enterPolicyHolderLastName(lastName: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersLastName)
      .locator('input')
      .fill(lastName);
  }

  async enterDateOfBirthFromInsuranceContainer(dateOfBirth: string): Promise<void> {
    const locator = this.#container
      .getByTestId(dataTestIds.insuranceContainer.policyHoldersDateOfBirth)
      .locator('input');
    await locator.click();
    await locator.pressSequentially(dateOfBirth);
  }

  async selectPolicyHoldersBirthSex(birthSex: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.policyHoldersSex).click();
    await this.#container.page().locator(`li:text("${birthSex}")`).click();
  }

  async enterPolicyHolderStreetAddress(street: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.streetAddress).locator('input').fill(street);
  }

  async enterPolicyHolderAddressLine2(addressLine2: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.addressLine2).locator('input').fill(addressLine2);
  }

  async enterPolicyHolderCity(city: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.city).locator('input').fill(city);
  }

  async selectPolicyHoldersState(state: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.state).click();
    await this.#container.page().locator(`li:text("${state}")`).click();
  }

  async enterZipFromInsuranceContainer(zip: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.zip).locator('input').fill(zip);
  }

  async selectPatientsRelationship(relationship: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.relationship).click();
    await this.#container.page().locator(`li:text("${relationship}")`).click();
  }

  async enterAdditionalInsuranceInformation(additionalInfo: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.insuranceContainer.additionalInformation)
      .locator('input')
      .fill(additionalInfo);
  }

  async clickRemoveInsuranceButton(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.removeButton).click();
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
