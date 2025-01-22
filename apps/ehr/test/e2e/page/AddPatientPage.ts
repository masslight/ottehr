import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class AddPatientPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async selectOffice(officeName: string): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.dashboard.locationSelect).click();
    await this.#page.getByText(new RegExp(officeName, 'i')).click();
    return this;
  }

  async enterMobilePhone(phone: string): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).locator('input').fill(phone);
    return this;
  }

  async verifyMobilePhoneNumberValidationErrorShown(): Promise<AddPatientPage> {
    await expect(this.#page.locator('p:text("Phone number must be 10 digits")')).toBeVisible;
    return this;
  }

  async verifySearchForPatientsErrorShown(): Promise<AddPatientPage> {
    await expect(this.#page.locator('p:text("Please search for patients before adding")')).toBeVisible();
    return this;
  }

  async clickSearchForPatientsButton(): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton).click();
    return this;
  }

  async clickAddButton(): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.addButton).click();
    return this;
  }

  async clickCancelButton(): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.cancelButton).click();
    return this;
  }

  async verifyPageStillOpened(): Promise<AddPatientPage> {
    await this.#page.waitForTimeout(1000);
    await expectAddPatientPage(this.#page);
    return this;
  }

  async clickPatientNotFoundButton(): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.patientNotFoundButton).click();
    return this;
  }

  async enterFirstName(firstName: string): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.firstNameInput).locator('input').fill(firstName);
    return this;
  }

  async enterLastName(lastName: string): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.lastNameInput).locator('input').fill(lastName);
    return this;
  }

  async enterDateOfBirth(dateOfBirth: string): Promise<AddPatientPage> {
    await this.#page.locator('[placeholder="MM/DD/YYYY"]').fill(dateOfBirth);
    return this;
  }

  async selectSexAtBirth(sexAtBirth: string): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown).click();
    await this.#page.getByText(sexAtBirth, { exact: true }).click();
    return this;
  }

  async selectReasonForVisit(reasonForVisit: string): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown).click();
    await this.#page.getByText(reasonForVisit).click();
    return this;
  }

  async selectVisitType(visitType: string): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown).click();
    await this.#page.getByText(visitType).click();
    return this;
  }

  async verifyDateFormatValidationErrorShown(): Promise<AddPatientPage> {
    await expect(this.#page.locator('p:text("please enter date in format MM/DD/YYYY")')).toBeVisible();
    return this;
  }

  async selectExistingPatient(existingPatient: string): Promise<AddPatientPage> {
    await this.#page.getByLabel(existingPatient).first().check();
    return this;
  }

  async clickPrefillForButton(): Promise<AddPatientPage> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.prefillForButton).click();
    return this;
  }

  async verifyPrefilledPatientName(patientName: string): Promise<AddPatientPage> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientName).getByText(patientName)
    ).toBeVisible();
    return this;
  }

  async verifyPrefilledPatientBirthday(patientBirthday: string): Promise<AddPatientPage> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientBirthday).getByText(patientBirthday)
    ).toBeVisible();
    return this;
  }

  async verifyPrefilledPatientBirthSex(patientBirthSex: string): Promise<AddPatientPage> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientBirthSex).getByText(patientBirthSex)
    ).toBeVisible();
    return this;
  }

  async verifyPrefilledPatientEmail(patientEmail: string): Promise<AddPatientPage> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientEmail).getByText(patientEmail)
    ).toBeVisible();
    return this;
  }
}

export async function expectAddPatientPage(page: Page): Promise<AddPatientPage> {
  await page.waitForURL(`/visits/add`);
  await expect(page.locator('h3').getByText('Add Patient')).toBeVisible();
  return new AddPatientPage(page);
}
