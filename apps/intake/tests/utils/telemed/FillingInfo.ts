import { expect, Page } from '@playwright/test';
import { assert } from 'console';
import { TEST_PATIENT_EMAIL, TEST_PATIENT_FIRST_NAME, TEST_PATIENT_LAST_NAME } from 'test-utils';
import { BOOKING_CONFIG, genderMap, patientScreeningQuestionsConfig, VALUE_SETS } from 'utils';
import { BaseFillingInfo } from '../BaseFillingInfo';
import { Locators } from '../locators';
import { FlagsData } from '../Paperwork';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export class FillingInfo extends BaseFillingInfo {
  page: Page;
  locators: Locators;

  constructor(page: Page) {
    super(page);
    this.page = page;
    this.locators = new Locators(page);
  }

  private async clickContinueButton(awaitRedirect = true): Promise<void> {
    await this.locators.clickContinueButton(awaitRedirect);
  }

  // randomize in tests maybe not a good idea, left one option for now
  private reasonForVisit = [VALUE_SETS.reasonForVisitOptions[0].value];
  private ethnicity = ['Hispanic or Latino', 'Not Hispanic or Latino', 'Decline to Specify'];
  private race = ['American Indian or Alaska Native'];
  private discovery = ['Friend/Family'];
  private birthSexes = ['Male'];
  private thisEmailBelongsTo = ['Patient'];
  private preferredLanguage = ['Spanish'];

  getReasonForVisit() {
    return this.reasonForVisit[0];
  }

  async fillNewPatientInfo() {
    const firstName = `TM-UserFN${this.getRandomString()}`;
    const lastName = `TM-UserLN${this.getRandomString()}`;
    // cspell:disable-next dvoschuk
    const email = `dvoshchuk+${firstName}@masslight.com`;
    await this.page.locator('#patient-first-name').click();
    await this.page.locator('#patient-first-name').fill(firstName);
    await this.page.locator('#patient-last-name').click();
    await this.page.locator('#patient-last-name').fill(lastName);

    await this.page.locator('#patient-birth-sex').click();
    const birthSex = this.getRandomElement(this.birthSexes);
    await this.page.getByRole('option', { name: birthSex, exact: true }).click();

    await this.page.locator('#patient-email').click();
    await this.page.locator('#patient-email').fill(email);

    const thisEmailBelongsTo = this.getRandomElement(this.thisEmailBelongsTo);

    await this.page.locator('#reason-for-visit').click();
    const reasonForVisit: string = (await this.page.getByRole('option').first().textContent()) || '';
    await this.page.getByRole('option').first().click({ timeout: 5000 });
    return { firstName, lastName, birthSex, email, thisEmailBelongsTo, reasonForVisit };
  }

  async fillNewPatientInfoSmoke() {
    const firstName = TEST_PATIENT_FIRST_NAME;
    const lastName = TEST_PATIENT_LAST_NAME;
    // cspell:disable-next ykulik
    const email = TEST_PATIENT_EMAIL;
    const enteredReason = this.getRandomString();
    await this.page.locator('#patient-first-name').click();
    await this.page.locator('#patient-first-name').fill(firstName);
    await this.page.locator('#patient-last-name').click();
    await this.page.locator('#patient-last-name').fill(lastName);
    await this.page.locator('#patient-birth-sex').click();
    const birthSex = genderMap.female;
    await this.page.getByRole('option', { name: birthSex, exact: true }).click();
    await this.page.locator('#patient-email').click();
    await this.page.locator('#patient-email').fill(email);
    await this.page.locator('#reason-for-visit').click();
    const reasonForVisit: string = (await this.page.getByRole('option').first().textContent()) || '';
    await this.page.getByRole('option').first().click({ timeout: 5000 });
    const thisEmailBelongsTo = this.getRandomElement(this.thisEmailBelongsTo);
    return { firstName, lastName, birthSex, email, reasonForVisit, thisEmailBelongsTo, enteredReason };
  }

  async fillVisitReason() {
    await this.page.locator('#reason-for-visit').click();
    const reasonForVisit = this.getRandomElement(this.reasonForVisit);
    await this.page.getByRole('option', { name: reasonForVisit, exact: true }).click({ timeout: 5000 });
    return { reason: reasonForVisit, enteredReason: '' };
  }

  // async fillTelemedReasonForVisit() {
  //   await this.page.locator('#reason-for-visit').click();
  //   const reasonForVisit = this.getRandomElement(this.reasonForVisit);
  //   await this.page.getByRole('option', { name: reasonForVisit, exact: true }).click({ timeout: 5000 });
  //   return reasonForVisit;
  // }

  async fillDOBless18() {
    const today = new Date();
    const YearMax = today.getFullYear() - 1;
    const YearMin = today.getFullYear() - 17;
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(YearMin, YearMax).toString();

    // Convert month name to numeric format (01-12)
    const monthIndex = this.months.indexOf(randomMonth) + 1;
    const numericMonth = monthIndex.toString().padStart(2, '0');
    const paddedDay = randomDay.padStart(2, '0');

    const dateString = `${numericMonth}/${paddedDay}/${randomYear}`;

    await this.page.getByPlaceholder('MM/DD/YYYY').fill(dateString);
    return { randomMonth, randomDay, randomYear };
  }

  async fillDOBgreater18() {
    const today = new Date();
    const YearMax = today.getFullYear() - 19;
    const YearMin = today.getFullYear() - 25;
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(YearMin, YearMax).toString();

    // Convert month name to numeric format (01-12)
    const monthIndex = this.months.indexOf(randomMonth) + 1;
    const numericMonth = monthIndex.toString().padStart(2, '0');
    const paddedDay = randomDay.padStart(2, '0');

    const dateString = `${numericMonth}/${paddedDay}/${randomYear}`;

    await this.page.getByPlaceholder('MM/DD/YYYY').fill(dateString);

    return { randomMonth, randomDay, randomYear };
  }

  async fillWrongDOB(month: string, day: string, year: string) {
    const wrongDay = (parseInt(day, 10) + 1).toString();
    const wrongYear = (parseInt(year, 10) + 1).toString();

    await this.page.getByRole('combobox').nth(0).click();
    await this.page.getByRole('option', { name: month }).click();

    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: wrongDay, exact: true }).click();

    await this.page.getByRole('combobox').nth(2).click();
    await this.page.getByRole('option', { name: wrongYear }).click();

    return { month, wrongDay, wrongYear };
  }

  async fillContactInformation() {
    const streetAddress = 'Test address';
    const streetAddress2 = 'Test address 2';
    const patientCity = 'Test city';
    const patientZIP = '12345';
    const patientState = 'CA';
    const email = 'dvoshchuk+ta@masslight.com';
    const number = '1111111111';

    await this.page.locator('#patient-street-address').click();
    await this.page.locator('#patient-street-address').fill(streetAddress);
    await this.page.locator('#patient-street-address-2').click();
    await this.page.locator('#patient-street-address-2').fill(streetAddress2);
    await this.page.locator('#patient-city').click();
    await this.page.locator('#patient-city').fill(patientCity);
    await this.page.locator('#patient-zip').click();
    await this.page.locator('#patient-zip').fill(patientZIP);
    await this.page.locator('#patient-state').click();
    await this.page.getByRole('option', { name: patientState }).click();
    await this.page.locator('#patient-email').click();
    await this.page.locator('#patient-email').fill(email);
    await this.page.locator('#patient-number').click();
    await this.page.locator('#patient-number').fill(number);

    const preferredCommunicationMethodLocator = this.page.locator('#patient-preferred-communication-method');
    if (await preferredCommunicationMethodLocator.isVisible()) {
      await preferredCommunicationMethodLocator.click();
      await this.page.getByRole('option').first().click();
    }

    return { streetAddress, streetAddress2, patientCity, patientZIP, patientState, email, number };
  }

  async fillPatientDetails() {
    const ethnicity = this.getRandomElement(this.ethnicity);
    const race = this.getRandomElement(this.race);
    const discovery = this.getRandomElement(this.discovery);
    const preferredLanguage = this.getRandomElement(this.preferredLanguage);

    await this.page.locator('#patient-ethnicity').click();
    await this.page.getByRole('option', { name: ethnicity, exact: true }).click();

    await this.page.locator('#patient-race').click();
    await this.page.getByRole('option', { name: race, exact: true }).click();

    await this.page.locator('#preferred-language').click();
    await this.page.getByRole('option', { name: preferredLanguage }).click();

    expect(await this.page.getByRole('radio', { name: 'No' }).count()).toBe(1);
    await this.page.getByRole('radio', { name: 'No' }).check();

    return { ethnicity, race, discovery, preferredLanguage };
  }

  async fillCurrentMedications() {
    const filledValue = 'some medication';
    const selectedValue = 'Albuterol';

    await this.locators.currentMedicationsPresent.click();
    await this.clickContinueButton(false);
    await expect(this.locators.paperworkErrorInFieldAboveMessage).toBeVisible();

    const input = this.page.getByPlaceholder('Type or select all that apply');
    await input.click();
    await input.fill(filledValue);
    await this.page.keyboard.press('Enter');
    // Wait for the first chip to appear
    await expect(this.page.getByText(filledValue)).toBeVisible();

    await input.click();
    await this.page.getByRole('option', { name: selectedValue }).click();
    // Wait for the second chip to appear
    await expect(this.page.getByText(selectedValue)).toBeVisible();

    return { filledValue, selectedValue };
  }

  async fillCurrentAllergies() {
    const filledValue = 'other allergy';
    const selectedValue = 'Aspirin';

    await this.locators.knownAllergiesPresent.click();
    await this.clickContinueButton(false);
    await expect(this.locators.paperworkErrorInFieldAboveMessage).toBeVisible();

    await this.page.locator(`input[value='Other']`).click();
    const input = this.page.getByPlaceholder('Type or select all that apply');
    await input.click();
    await input.fill(filledValue);
    await this.page.keyboard.press('Enter');
    // Wait for the first chip to appear
    await expect(this.page.getByText(`${filledValue} | Other`)).toBeVisible();

    await this.page.locator(`input[value='Medications']`).click();
    await input.click();
    await this.page.getByRole('option', { name: selectedValue }).click();
    // Wait for the second chip to appear
    await expect(this.page.getByText(`${selectedValue} | Medication`)).toBeVisible();

    return { filledValue: `${filledValue} | Other`, selectedValue: `${selectedValue} | Medication` };
  }

  async fillMedicalHistory() {
    const filledValue = 'some history';
    const selectedValue = 'Anemia';

    await this.locators.medicalConditionsPresent.click();
    await this.clickContinueButton(false);
    await expect(this.locators.paperworkErrorInFieldAboveMessage).toBeVisible();

    const input = this.page.getByPlaceholder('Type or select all that apply');
    await input.click();
    await input.fill(filledValue);
    await this.page.keyboard.press('Enter');

    await input.click();
    await this.page.getByRole('option', { name: selectedValue }).click();

    return { filledValue, selectedValue };
  }

  async fillSurgicalHistory() {
    const filledValue = 'some history';
    const selectedValue = 'Appendectomy';

    await this.locators.surgicalHistoryPresent.click();
    await this.clickContinueButton(false);
    await expect(this.locators.paperworkErrorInFieldAboveMessage).toBeVisible();

    const input = this.page.getByPlaceholder('Type or select all that apply');
    await input.click();
    await input.fill(filledValue);
    await this.page.keyboard.press('Enter');

    await input.click();
    await this.page.getByRole('option', { name: selectedValue }).click();

    return { filledValue, selectedValue };
  }

  async fillAdditionalQuestions() {
    const result = {} as FlagsData;

    // Get questions from config that exist in questionnaire (shown in intake additional questions)
    const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((f) => f.existsInQuestionnaire);

    for (const field of questionnaireFields) {
      // Use first option as answer (typically 'Yes')
      const answer = field.options?.[0]?.label ?? 'Yes';

      // Build locator dynamically based on fhirField from config
      const locator = this.page.locator(`div[aria-labelledby='${field.fhirField}-label'] input[value='${answer}']`);

      const questionExists = await locator.isVisible({ timeout: 2000 }).catch(() => false);
      if (questionExists) {
        await locator.click();
        result[field.fhirField as keyof FlagsData] = answer;
      } else {
        console.log(`Question "${field.question}" (${field.fhirField}) not found on page, skipping`);
      }
    }

    return result;
  }

  async selectRandomSlot(): Promise<{ time: string; fullSlot: string }> {
    await expect(this.locators.firstAvailableTime).toBeVisible();
    const timeSlotsButtons = this.page.locator('role=button[name=/^\\d{1,2}:\\d{2} (AM|PM)$/]');
    const buttonCount = await timeSlotsButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
    const randomIndex = Math.min(Math.floor(Math.random() * (buttonCount - 1)) + 1, buttonCount - 1);
    const selectedSlotButton = timeSlotsButtons.nth(randomIndex);
    const time = await selectedSlotButton.textContent();
    if (!time) throw new Error('No time found in selected slot button');
    console.log(`Selected time: ${time}`);
    await selectedSlotButton.click();
    const selectButton = await this.page.getByRole('button', { name: /^Select/ });
    const selectButtonContent = await selectButton.textContent();
    const fullSlot = selectButtonContent?.replace('Select ', '').trim();
    if (!fullSlot) throw new Error('No fullSlot info found in select slot button');
    console.log(`Selected slot: ${fullSlot}`);
    return { time, fullSlot };
  }

  async selectFirstServiceCategory() {
    const availableCategories = BOOKING_CONFIG.serviceCategories || [];
    const firstCategory = availableCategories[0];
    assert(firstCategory.display);

    if (firstCategory) {
      await this.page.getByRole('button', { name: firstCategory.display }).click();
    }
  }
}
