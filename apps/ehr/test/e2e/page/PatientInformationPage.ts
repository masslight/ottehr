import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { PatientHeader } from './PatientHeader';

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

  async enterPatientDateOfBirth(patientDateOfBirth: string): Promise<void> {
    const locator = this.#page.locator('#patient-date-of-birth');
    await locator.click();
    await this.#page.waitForTimeout(2000);
    await locator.pressSequentially(patientDateOfBirth);
  }

  async verifyPatientDateOfBirth(patientDateOfBirth: string): Promise<void> {
    await expect(this.#page.locator('#patient-date-of-birth')).toHaveValue(patientDateOfBirth);
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

  async enterCity(city: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.city).locator('input').fill(city);
  }

  async verifyCity(city: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.contactInformationContainer.city).locator('input')).toHaveValue(
      city
    );
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

  async enterPatientEmail(email: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.contactInformationContainer.patientEmail).locator('input').fill(email);
  }

    async verifyPatientEmail(email: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.contactInformationContainer.patientEmail).locator('input')).toHaveValue(email);
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
    ).toHaveValue(patientMobile);
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

  async selectRelationship(relationship: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.relationshipDropdown).click();
    await this.#page.getByText(relationship, { exact: true }).click();
  }
 
  async verifyRelationship(relationship: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.relationshipDropdown).locator('input')
    ).toHaveValue(relationship);
  }

  async enterFullName(fullName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.fullName)
      .locator('input')
      .fill(fullName);
  }

  async verifyFullName(fullName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.fullName).locator('input')
    ).toHaveValue(fullName);
  }

  async enterDateOfBirthFromResponsibleContainer(dateOfBirth: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.id).locator('[placeholder="MM/DD/YYYY"]');
    await locator.click();
    await this.#page.waitForTimeout(2000);
    await locator.pressSequentially(dateOfBirth);
  }

  async verifyDateOfBirthFromResponsibleContainer(dateOfBirth: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.responsiblePartyInformationContainer.id).locator('[placeholder="MM/DD/YYYY"]')).toHaveValue(dateOfBirth);
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

  async enterPhoneFromResponsibleContainer(phone: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.responsiblePartyInformationContainer.phoneInput)
      .locator('input')
      .fill(phone);
  }

  async verifyPhoneFromResponsibleContainer(phone: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.contactInformationContainer.patientMobile).locator('input')
    ).toHaveValue(phone);
  }

  async selectReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown).click();
    await this.#page.getByText(releaseOfInfo, { exact: true }).click();
  }

  async verifyReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown).locator('input')
    ).toHaveValue(releaseOfInfo);
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
    return expectPatientInformationPage(page,patientId);
}