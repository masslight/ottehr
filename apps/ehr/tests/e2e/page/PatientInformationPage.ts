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

  async verifyPatientLastName(patientLastName: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.patientLastName).locator('input')).toHaveValue(
      patientLastName
    );
    return this;
  }

  async verifyPatientFirstName(patientFirstName: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.patientFirstName).locator('input')).toHaveValue(
      patientFirstName
    );
    return this;
  }

  async verifyPatientDateOfBirth(patientDateOfBirth: string): Promise<PatientInformationPage> {
    await expect(this.#page.locator('#patient-date-of-birth')).toHaveValue(patientDateOfBirth);
    return this;
  }

  async verifyPatientBirthSex(patientBirthSex: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.patientBirthSex).locator('input')).toHaveValue(
      patientBirthSex
    );
    return this;
  }

  async verifyStreetaddress(streetAddress: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.streetAddress).locator('input')).toHaveValue(
      streetAddress
    );
    return this;
  }

  async verifyCity(city: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.city).locator('input')).toHaveValue(city);
    return this;
  }

  async verifyState(state: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.state).locator('input')).toHaveValue(state);
    return this;
  }

  async verifyzip(zip: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.zip).locator('input')).toHaveValue(zip);
    return this;
  }

  async verifyfillingThisInfoAs(fillingThisInfoAs: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.fillingThisInfoAs).locator('input')).toHaveValue(
      fillingThisInfoAs
    );
    return this;
  }

  async verifyParentGuardianEmail(parentGuardianEmail: string): Promise<PatientInformationPage> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformation.parentGuardianEmail).locator('input')
    ).toHaveValue(parentGuardianEmail);
    return this;
  }

  async verifypatientEmail(patientEmail: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.patientEmail).locator('input')).toHaveValue(
      patientEmail
    );
    return this;
  }

  async verifypatientMobile(patientMobile: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.patientMobile).locator('input')).toHaveValue(
      patientMobile
    );
    return this;
  }

  async verifypatientEthnicity(patientEthnicity: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.patientsEthnicity).locator('input')).toHaveValue(
      patientEthnicity
    );
    return this;
  }

  async verifypatientRace(patientRace: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.patientsRace).locator('input')).toHaveValue(
      patientRace
    );
    return this;
  }

  async checkhowDidYouHearAboutUs(howDidYouHearAboutUs: string): Promise<PatientInformationPage> {
    await expect(
      this.#page.getByTestId(dataTestIds.patientInformation.howDidYouHearAboutUs).locator('input')
    ).toHaveValue(howDidYouHearAboutUs);
    return this;
  }

  async verifyFullName(fullName: string): Promise<PatientInformationPage> {
    await expect(this.#page.getByTestId(dataTestIds.patientInformation.fullName).locator('input')).toHaveValue(
      fullName
    );
    return this;
  }
}

export async function expectPatientInformationPage(page: Page, patientId: string): Promise<PatientInformationPage> {
  await page.waitForURL('/patient/' + patientId + '/info');
  await page.locator('h3').getByText('Patient Information').isVisible();
  return new PatientInformationPage(page);
}
