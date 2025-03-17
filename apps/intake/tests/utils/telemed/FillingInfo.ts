import { Page, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { Locators } from '../locators';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export class FillingInfo {
  page: Page;
  locators: Locators;

  constructor(page: Page) {
    this.page = page;
    this.locators = new Locators(page);
  }
  // Helper method to get a random element from an array
  private getRandomElement(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private async clickContinueButton(awaitRedirect = true): Promise<void> {
    await this.locators.clickContinueButton(awaitRedirect);
  }

  // Helper method to get a random integer between min and max (inclusive)
  private getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // randomize in tests maybe not a good idea, left one option for now
  private reasonForVisit = ['Fever'];
  private cancelReason = ['Wait time too long'];
  private ethnicity = ['Hispanic or Latino', 'Not Hispanic or Latino', 'Decline to Specify'];
  private race = ['American Indian or Alaska Native'];
  private pronouns = ['He/him'];
  private discovery = ['Friend/Family'];
  private ovrp = ['No'];
  private relationships = ['Father'];
  private relationshipsConstentForms = ['Parent'];
  private relationshipsInsurance = ['Child'];
  private months = ['Jan'];
  private birthSexes = ['Male'];
  private thisEmailBelongsTo = ['Patient'];
  private preferredLanguage = ['Spanish'];

  getStringDateByDateUnits(month: string, day: string, year: string, format: string | undefined = 'MMMM dd, yyyy') {
    const monthIndex = this.months.indexOf(month);
    return DateTime.fromObject({
      year: +year,
      month: monthIndex + 1,
      day: +day,
    }).toFormat(format);
  }

  getRandomString() {
    return Math.random().toString().slice(2, 7);
  }

  async fillNewPatientInfo() {
    const firstName = `TM-UserFN${this.getRandomString()}`;
    const lastName = `TM-UserLN${this.getRandomString()}`;
    const email = `dvoshchuk+${firstName}@masslight.com`;

    await this.page.getByPlaceholder('First name').click();
    await this.page.getByPlaceholder('First name').fill(firstName);
    await this.page.getByPlaceholder('Last name').click();
    await this.page.getByPlaceholder('Last name').fill(lastName);

    await this.page.locator('#sex').click();
    const birthSex = this.getRandomElement(this.birthSexes);
    await this.page.getByRole('option', { name: birthSex, exact: true }).click();

    await this.page.getByPlaceholder('example@mail.com').click();
    await this.page.getByPlaceholder('example@mail.com').fill(email);

    const thisEmailBelongsTo = this.getRandomElement(this.thisEmailBelongsTo);

    await this.page.locator('#reasonForVisit').click();
    const reasonForVisit: string = (await this.page.getByRole('option').first().textContent()) || '';
    await this.page.getByRole('option').first().click({ timeout: 5000 });

    return { firstName, lastName, birthSex, email, thisEmailBelongsTo, reasonForVisit };
  }

  async fillReasonForVisit() {
    const reasonForVisit = this.getRandomElement(this.reasonForVisit);
    await this.page.getByPlaceholder('Type or select all that apply').click();
    await this.page.getByRole('option', { name: reasonForVisit, exact: true }).click();
    return reasonForVisit;
  }

  async fillTelemedReasonForVisit() {
    await this.page.locator('#reasonForVisit').click();
    const reasonForVisit = this.getRandomElement(this.reasonForVisit);
    await this.page.getByRole('option', { name: reasonForVisit, exact: true }).click({ timeout: 5000 });
    return reasonForVisit;
  }

  async fillMiddleName() {
    const middleName = `TM-UserMN${this.getRandomString()}`;
    await this.page.getByPlaceholder('Middle name').click();
    await this.page.getByPlaceholder('Middle name').fill(middleName);
    return middleName;
  }

  async fillDOBless18() {
    const today = new Date();
    const YearMax = today.getFullYear() - 1;
    const YearMin = today.getFullYear() - 17;
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(YearMin, YearMax).toString();

    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click();
    await this.page.getByRole('option', { name: randomMonth }).click();
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: randomDay, exact: true }).click();
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click();
    await this.page.getByRole('option', { name: randomYear }).click();

    return { randomMonth, randomDay, randomYear };
  }

  async fillDOBgreater18() {
    const today = new Date();
    const YearMax = today.getFullYear() - 19;
    const YearMin = today.getFullYear() - 25;
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(YearMin, YearMax).toString();
    // await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.getByRole('option', { name: randomMonth }).click();
    // await this.page.waitForTimeout(3000);

    //  await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: randomDay, exact: true }).click();
    // await this.page.waitForTimeout(3000);

    //  await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: randomYear }).click();

    return { randomMonth, randomDay, randomYear };
  }

  async fillDOBequal18() {
    const today = new Date();
    const Day = today.getDate().toString();
    const Month = today.toLocaleString('default', { month: 'short' });
    const Year = (today.getFullYear() - 18).toString();
    // await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.getByRole('option', { name: Month }).click();
    // await this.page.waitForTimeout(3000);

    //  await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: Day, exact: true }).click({ timeout: 10000 });
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: Year }).click();

    return { Month, Day, Year };
  }

  async fillDOBgreater26() {
    //  await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.getByRole('option', { name: 'Jan' }).click();
    // await this.page.waitForTimeout(3000);

    //  await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: '10' }).click();
    // await this.page.waitForTimeout(3000);

    //  await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: '1997' }).click();
  }

  async fillCorrectDOB(month: string, day: string, year: string) {
    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click();
    await this.page.getByRole('option', { name: month }).click();
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: day, exact: true }).click();
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click();
    await this.page.getByRole('option', { name: year }).click();
  }

  async fillWrongDOB(month: string, day: string, year: string) {
    const wrongDay = (parseInt(day, 10) + 1).toString();
    const wrongYear = (parseInt(year, 10) + 1).toString();
    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click();
    await this.page.getByRole('option', { name: month }).click();
    // await this.page.waitForTimeout(3000);

    //await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: wrongDay, exact: true }).click();
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click();
    await this.page.getByRole('option', { name: wrongYear }).click();

    return { month, wrongDay, wrongYear };
  }

  async fillInvalidDOB() {
    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.getByRole('option', { name: 'Feb' }).click();
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: '31', exact: true }).click();
    // await this.page.waitForTimeout(3000);

    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: '2019' }).click();
  }

  async cancelPrebookVisit() {
    const randomCancelReason = this.getRandomElement(this.cancelReason);
    await this.page.getByRole('button', { name: 'Cancel' }).click();
    await this.page.locator('#cancellationReason').click();
    await this.page.getByRole('option', { name: randomCancelReason }).click();
    await this.page.getByRole('button', { name: 'Cancel visit' }).click();
    await expect(this.page.getByRole('heading', { name: 'Your visit has been canceled' })).toBeVisible({
      timeout: 15000,
    });
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

    await input.click();
    await this.page.getByRole('option', { name: selectedValue }).click();

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

    await this.page.locator(`input[value='Medications']`).click();
    await input.click();
    await this.page.getByRole('option', { name: selectedValue }).click();

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
    const covid = 'Yes';
    const test = 'No';
    const travel = 'Yes';

    await this.locators.covidSymptoms(covid).click();
    await this.locators.testedPositiveCovid(test).click();
    await this.locators.travelUSA(travel).click();

    return { covid, test, travel };
  }

  async fillSelfPayCardData(card: { number: string; expDate: string; cvc: string }) {
    const stripeFrame = this.page.frameLocator('iframe').first();

    await stripeFrame.locator('[placeholder="Card number"]').fill(card.number);
    await stripeFrame.locator('[placeholder="MM / YY"]').fill(card.expDate);
    await stripeFrame.locator('[placeholder="CVC"]').fill(card.cvc);
  }

  async NewPatientDetails() {
    const randomEthnicity = this.getRandomElement(this.ethnicity);
    const randomRace = this.getRandomElement(this.race);
    const randomPronouns = this.getRandomElement(this.pronouns);
    const randomDiscovery = this.getRandomElement(this.discovery);
    const randomOVRP = this.getRandomElement(this.ovrp);
    await this.page.locator('#patient-ethnicity').click();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
    await this.page.locator('#patient-race').click();
    await this.page.getByRole('option', { name: randomRace, exact: true }).click();
    await this.page.locator('#patient-pronouns').click();
    await this.page.getByRole('option', { name: randomPronouns, exact: true }).click();
    await this.page.locator('#patient-point-of-discovery').click();
    await this.page.getByRole('option', { name: randomDiscovery, exact: true }).click();
    await this.page.locator('#ovrp-interest').click();
    await this.page.getByRole('option', { name: randomOVRP, exact: true }).click();
    return { randomEthnicity, randomRace, randomPronouns, randomOVRP, randomDiscovery };
  }
  async PatientDetailsWithFilledPaperwor() {
    const randomEthnicity = this.getRandomElement(this.ethnicity);
    const randomRace = this.getRandomElement(this.race);
    const randomPronouns = this.getRandomElement(this.pronouns);
    const randomOVRP = this.getRandomElement(this.ovrp);
    await this.page.locator('#patient-ethnicity').click();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
    await this.page.locator('#patient-race').click();
    await this.page.getByRole('option', { name: randomRace, exact: true }).click();
    await this.page.locator('#patient-pronouns').click();
    await this.page.getByRole('option', { name: randomPronouns, exact: true }).click();
    await this.page.locator('#ovrp-interest').click();
    await this.page.getByRole('option', { name: randomOVRP, exact: true }).click();
    return { randomEthnicity, randomRace, randomPronouns, randomOVRP };
  }
  async ResponsiblePartyRandom() {
    const firstName = `TM-UserFN${this.getRandomString()}`;
    const lastName = `TM-UserLN${this.getRandomString()}`;
    const randomRelationship = this.getRandomElement(this.relationships);
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(1950, 2023).toString();
    const randomBirthSex = this.getRandomElement(this.birthSexes);
    await this.page.getByRole('heading', { name: 'Responsible party information' }).isVisible();
    await this.page.locator('#responsible-party-relationship').click();
    await this.page.getByRole('option', { name: randomRelationship }).click();
    await this.page.locator('#responsible-party-first-name').click();
    await this.page.getByRole('textbox', { name: 'First name' }).fill(firstName);
    await this.page.locator('#responsible-party-last-name').click();
    await this.page.getByRole('textbox', { name: 'Last name' }).fill(lastName);
    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomMonth}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomMonth }).click();
    await this.page.waitForTimeout(500);
    //await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomDay}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomDay, exact: true }).click();
    await this.page.waitForTimeout(500);
    //await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(3).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomYear}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomYear }).click();
    await this.page.waitForTimeout(500);
    await this.page.locator('#responsible-party-birth-sex').click();
    await this.page.getByRole('option', { name: randomBirthSex, exact: true }).click();
  }
  async ResponsiblePartyLegalGuardian() {
    const firstName = `TM-UserFN${this.getRandomString()}`;
    const lastName = `TM-UserLN${this.getRandomString()}`;
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(1950, 2023).toString();
    const randomBirthSex = this.getRandomElement(this.birthSexes);
    await this.page.getByRole('heading', { name: 'Responsible party information' }).isVisible();
    await this.page.locator('#responsible-party-relationship').click();
    await this.page.getByRole('option', { name: 'Legal Guardian' }).click();
    await this.page.locator('#responsible-party-first-name').click();
    await this.page.getByRole('textbox', { name: 'First name' }).fill(firstName);
    await this.page.locator('#responsible-party-last-name').click();
    await this.page.getByRole('textbox', { name: 'Last name' }).fill(lastName);
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomMonth}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomMonth }).click();
    await this.page.waitForTimeout(500);
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomDay}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomDay, exact: true }).click();
    await this.page.waitForTimeout(500);
    await this.page.getByRole('combobox').nth(3).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomYear}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomYear }).click();
    await this.page.waitForTimeout(500);
    await this.page.locator('#responsible-party-birth-sex').click();
    await this.page.getByRole('option', { name: randomBirthSex, exact: true }).click();
  }
  async fillConsentForm() {
    const firstName = `TM-UserFN${this.getRandomString()}`;
    const lastName = `TM-UserLN${this.getRandomString()}`;
    const randomRelationships = this.getRandomElement(this.relationshipsConstentForms);
    await this.page.getByLabel('I have reviewed and accept HIPAA Acknowledgement *').check();
    await this.page.getByLabel('I have reviewed and accept Consent to Treat and Guarantee of Payment *').check();
    await this.page.getByPlaceholder('Type out your full name').click();
    await this.page.getByPlaceholder('Type out your full name').fill(firstName + ' ' + lastName);
    await this.page.getByRole('textbox', { name: 'Full name' }).click();
    await this.page.getByRole('textbox', { name: 'Full name' }).fill(firstName + ' ' + lastName);
    await this.page.locator('#consent-form-signer-relationship').click();
    await this.page.getByRole('option', { name: randomRelationships }).click();
    return { firstName, lastName, randomRelationships };
  }
  async getMonthDay(monthStr: string, dayStr: string) {
    const monthNumber = new Date(`${monthStr} 01 2000`).toLocaleDateString(`en`, { month: `2-digit` });
    const dayNumber = new Date(`Jan ${dayStr} 2000`).toLocaleDateString(`en`, { day: `2-digit` });
    return { monthNumber, dayNumber };
  }
  async fillInsuranceRequiredFields() {
    const firstName = `TM-UserFN${this.getRandomString()}`;
    const lastName = `TM-UserLN${this.getRandomString()}`;
    const randomRelationships = this.getRandomElement(this.relationshipsInsurance);
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(1950, 2023).toString();
    const randomBirthSex = this.getRandomElement(this.birthSexes);
    await this.page.locator('#insurance-carrier').click();
    await this.page.locator('#insurance-carrier').fill('Insurance carrier test');
    await this.page.locator('#insurance-member-id').click();
    await this.page.locator('#insurance-member-id').fill('Insurance member test');
    await this.page.locator('#policy-holder-first-name').click();
    await this.page.locator('#policy-holder-first-name').fill(firstName);
    await this.page.locator('#policy-holder-last-name').click();
    await this.page.locator('#policy-holder-last-name').fill(lastName);
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomMonth}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomMonth }).click();
    await this.page.waitForTimeout(500);
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomDay}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomDay, exact: true }).click();
    await this.page.waitForTimeout(500);
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.waitForSelector(`role=option[name="${randomYear}"]`, { state: 'visible' });
    await this.page.getByRole('option', { name: randomYear }).click();
    await this.page.waitForTimeout(500);
    await this.page.locator('#policy-holder-birth-sex').click();
    await this.page.getByRole('option', { name: randomBirthSex, exact: true }).click();
    await this.page.locator('#patient-relationship-to-insured').click();
    await this.page.getByRole('option', { name: randomRelationships }).click();
    return { firstName, lastName, randomRelationships };
  }
  async selectRandomSlot(): Promise<{ time: string; fullSlot: string }> {
    await expect(this.locators.firstAvailableTime).toBeVisible();
    const timeSlotsButtons = this.page.locator('role=button[name=/^\\d{1,2}:\\d{2} (AM|PM)$/]');
    const buttonCount = await timeSlotsButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
    const randomIndex = Math.floor(Math.random() * (buttonCount - 1)) + 1;
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
}
