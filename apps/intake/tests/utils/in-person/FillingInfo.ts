import { Page, expect } from '@playwright/test';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export class FillingInfo {
  page: Page;
  constructor(page: Page) {
    this.page = page;
  }
  // Helper method to get a random element from an array
  getRandomElement(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Helper method to get a random integer between min and max (inclusive)
  private getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  private WalkinFillInformationAsProceed = [
    'I am the Parent or legal',
    'I am the Patient',
    'I am NOT the parent or legal guardian but have permission to bring the minor patient for care',
  ];
  private reasonForVisit = [
    'Cough and/or congestion',
    'Throat pain',
    'Eye concern',
    'Fever',
    'Ear pain',
    'Vomiting and/or diarrhea',
    'Abdominal (belly) pain',
    'Rash or skin issue',
    'Urinary problem',
    'Breathing problem',
    'Injury to arm',
    'Injury to leg',
    'Injury to head',
    'Injury (Other)',
    'Cut to arm or leg',
    'Cut to face or head',
    'Removal of sutures/stitches/staples',
    'Choked or swallowed something',
    'Allergic reaction to medication or food',
    'Other',
  ];
  private cancelReason = [
    'Patient improved',
    'Wait time too long',
    'Prefer another provider',
    'Changing location',
    'Changing to telemedicine',
    'Financial responsibility concern',
    'Insurance issue',
  ];
  private ethnicity = ['Hispanic or Latino', 'Not Hispanic or Latino', 'Decline to Specify'];
  private race = [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Decline to Specify',
  ];
  private pronouns = ['He/Him', 'She/Her', 'They/Them', 'My pronouns are not listed'];
  private discovery = [
    'Friend/Family',
    'Been there with another child or family member',
    'Pediatrician/Healthcare Professional',
    'Google/Internet search',
    'Internet ad',
    'Social media community group',
    'Webinar',
    'TV/Radio',
    'Newsletter',
    'School',
    'Drive by/Signage',
    'Local event',
  ];
  private ovrp = ['Yes/First available', 'No', 'Need more info'];
  private relationships = ['Legal Guardian', 'Father', 'Mother', 'Spouse'];
  private relationshipsConstentForms = ['Parent', 'Self', 'Legal Guardian', 'Other'];
  private relationshipsInsurance = ['Child', 'Parent', 'Mother', 'Father', 'Sibling', 'Spouse', 'Other'];
  private months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private birthSexes = ['Male', 'Female', 'Intersex'];
  getRandomString() {
    return Math.random().toString().slice(2, 7);
  }
  async selectSlot() {
    if (
      await this.page.getByText('To continue, please select an available appointment.', { exact: true }).isVisible()
    ) {
      await this.page.getByText('Close').click();
    }
    const firstAvailableTimeText = await this.page
      .getByRole('button', { name: 'First available time', exact: false })
      .textContent();
    if (!firstAvailableTimeText) {
      throw new Error('firstAvailableTimeText is null');
    }
    const splitIndex = firstAvailableTimeText.indexOf('time:');
    const firstAvailableTime = firstAvailableTimeText.slice(splitIndex + 6);
    await this.page.getByRole('button', { name: 'First available time', exact: false }).click();
    await this.page.locator('button[type=submit]').click();
    return firstAvailableTime;
  }
  async selectRandomSlot() {
    await expect(this.page.getByText('First available time')).toBeVisible();
    const buttons = this.page.locator('role=button[name=/^\\d{1,2}:\\d{2} (AM|PM)$/]');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);
    const randomIndex = Math.floor(Math.random() * (buttonCount - 1)) + 1;
    const selectedButton = buttons.nth(randomIndex);
    const buttonName = await selectedButton.textContent();
    console.log(`Button name: ${buttonName}`);
    await selectedButton.click();
    const selectButton = await this.page.getByRole('button', { name: /^Select/ });
    const selectButtonContent = await selectButton.textContent();
    const selectedSlot = selectButtonContent?.replace('Select ', '').trim();
    await selectButton.click();
    console.log(`Selected slot: ${selectedSlot}`);
    return { buttonName, selectedSlot };
  }
  async fillNewPatientInfo() {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    const birthSexes = ['Male', 'Female', 'Intersex'];
    const email = `ykulik+${firstName}@masslight.com`;
    const reason = this.getRandomElement(this.reasonForVisit);
    const enteredReason = this.getRandomString();
    await this.page.getByPlaceholder('First name').click();
    await this.page.getByPlaceholder('First name').fill(firstName);
    await this.page.getByPlaceholder('Last name').click();
    await this.page.getByPlaceholder('Last name').fill(lastName);
    await this.page.locator('#sex').click();
    const BirthSex = this.getRandomElement(birthSexes);
    await this.page.getByRole('option', { name: BirthSex, exact: true }).click();
    await this.page.getByPlaceholder('example@mail.com').click();
    await this.page.getByPlaceholder('example@mail.com').fill(email);
    await this.page.getByLabel('Reason for visit *', { exact: true }).click();
    await this.page.getByRole('option', { name: reason, exact: true }).click();
    await this.page.getByRole('textbox', { name: 'Tell us more (optional)' }).fill(enteredReason);
    return { firstName, lastName, BirthSex, email, reason, enteredReason };
  }
  async fillVisitReason() {
    const reason = this.getRandomElement(this.reasonForVisit);
    const enteredReason = this.getRandomString();
    await this.page.getByLabel('Reason for visit *', { exact: true }).click();
    await this.page.getByRole('option', { name: reason, exact: true }).click();
    await this.page.getByRole('textbox', { name: 'Tell us more (optional)' }).fill(enteredReason);
    return { reason, enteredReason };
  }
  async fillMiddleName() {
    const middleName = `TA-UserMN${this.getRandomString()}`;
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
    await expect(this.page.getByRole('option', { name: randomMonth })).toBeVisible();
    await this.page.getByRole('option', { name: randomMonth }).click();
    await this.page.waitForTimeout(3000);
    // await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: randomDay, exact: true }).click();
    await this.page.waitForTimeout(3000);
    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
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
    await this.page.getByRole('combobox').nth(0).click();
    await expect(this.page.getByRole('option', { name: randomMonth })).toBeVisible();
    await this.page.getByRole('option', { name: randomMonth }).click();
    await this.page.waitForTimeout(3000);
    //  await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await expect(this.page.getByRole('option', { name: randomDay, exact: true })).toBeVisible();
    await this.page.getByRole('option', { name: randomDay, exact: true }).click();
    await this.page.waitForTimeout(3000);
    //  await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await expect(this.page.getByRole('option', { name: randomYear })).toBeVisible();
    await this.page.getByRole('option', { name: randomYear }).click();
    return { randomMonth, randomDay, randomYear };
  }
  async fillDOBequal18() {
    const today = new Date();
    const Day = today.getDate().toString();
    const Month = today.toLocaleString('default', { month: 'short' });
    const Year = (today.getFullYear() - 18).toString();
    // await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click();
    await expect(this.page.getByRole('option', { name: Month })).toBeVisible();
    await this.page.getByRole('option', { name: Month }).click();
    await this.page.waitForTimeout(3000);
    //  await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: Day, exact: true }).click({ timeout: 10000 });
    await this.page.waitForTimeout(3000);
    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: Year }).click();
    return { Month, Day, Year };
  }
  async fillDOBgreater26() {
    //  await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click();
    await expect(this.page.getByRole('option', { name: 'Jan' })).toBeVisible();
    await this.page.getByRole('option', { name: 'Jan' }).click();
    await this.page.waitForTimeout(3000);
    //  await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: '10' }).click();
    await this.page.waitForTimeout(3000);
    //  await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: '1997' }).click();
  }
  async fillCorrectDOB(month: string, day: string, year: string) {
    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.getByRole('option', { name: month }).click();
    await this.page.waitForTimeout(3000);
    // await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: day, exact: true }).click();
    await this.page.waitForTimeout(3000);
    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: year }).click();
  }
  async fillWrongDOB(month: string, day: string, year: string) {
    const wrongDay = (parseInt(day, 10) + 1).toString();
    const wrongYear = (parseInt(year, 10) + 1).toString();
    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.getByRole('option', { name: month }).click();
    await this.page.waitForTimeout(3000);
    //await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: wrongDay, exact: true }).click();
    await this.page.waitForTimeout(3000);
    // await this.page.getByText('Year').first().click({ force: true });
    await this.page.getByRole('combobox').nth(2).click({ force: true });
    await this.page.getByRole('option', { name: wrongYear }).click();
    return { month, wrongDay, wrongYear };
  }
  async fillInvalidDOB() {
    //await this.page.getByText('Month').first().click({ force: true });
    await this.page.getByRole('combobox').nth(0).click({ force: true });
    await this.page.getByRole('option', { name: 'Feb' }).click();
    await this.page.waitForTimeout(3000);
    // await this.page.getByText('Day').first().click({ force: true });
    await this.page.getByRole('combobox').nth(1).click({ force: true });
    await this.page.getByRole('option', { name: '31', exact: true }).click();
    await this.page.waitForTimeout(3000);
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
    await this.page.locator('[id="patient-street-address"]').click();
    await this.page.locator('[id="patient-street-address"]').fill('Test address');
    await this.page.locator('[id="patient-street-address-2"]').click();
    await this.page.locator('[id="patient-street-address-2"]').fill('Test address 2');
    await this.page.locator('[id="patient-city"]').click();
    await this.page.locator('[id="patient-city"]').fill('patient-city');
    await this.page.locator('[id="patient-zip"]').click();
    await this.page.locator('[id="patient-zip"]').fill('12345');
    await this.page.locator('[id="patient-state"]').click();
    await this.page.getByRole('option', { name: 'AK' }).click();
    await this.page.locator('[id="guardian-email"]').click();
    await this.page.locator('[id="guardian-email"]').fill('ykulik+ta@masslight.com');
    await this.page.locator('[id="guardian-number"]').click();
    await this.page.locator('[id="guardian-number"]').fill('1111111111');
  }
  async fillContactInformationOnlyRequiredFields() {
    await this.page.locator('[id="patient-street-address"]').click();
    await this.page.locator('[id="patient-street-address"]').fill('Test address');
    await this.page.locator('[id="patient-city"]').click();
    await this.page.locator('[id="patient-city"]').fill('patient-city');
    await this.page.locator('[id="patient-zip"]').click();
    await this.page.locator('[id="patient-zip"]').fill('12345');
    await this.page.locator('[id="patient-state"]').click();
    await this.page.getByRole('option', { name: 'AK' }).click();
    await this.page.locator('[id="guardian-email"]').click();
    await this.page.locator('[id="guardian-email"]').fill('ykulik+ta@masslight.com');
    await this.page.locator('[id="guardian-number"]').click();
    await this.page.locator('[id="guardian-number"]').fill('1111111111');
  }
  async fillPatientDetailsOnlyRequiredFields() {
    const randomEthnicity = this.getRandomElement(this.ethnicity);
    const randomRace = this.getRandomElement(this.race);
    const randomDiscovery = this.getRandomElement(this.discovery);
    const randomOVRP = this.getRandomElement(this.ovrp);
    await this.page.locator('[id="patient-ethnicity"]').click();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
    await this.page.locator('[id="patient-race"]').click();
    await this.page.getByRole('option', { name: randomRace, exact: true }).click();
    await this.page.locator('[id="patient-point-of-discovery"]').click();
    await this.page.getByRole('option', { name: randomDiscovery, exact: true }).click();
    await this.page.locator('[id="ovrp-interest"]').click();
    await this.page.getByRole('option', { name: randomOVRP, exact: true }).click();
    return { randomEthnicity, randomRace, randomOVRP, randomDiscovery };
  }
  async NewPatientDetails() {
    const randomEthnicity = this.getRandomElement(this.ethnicity);
    const randomRace = this.getRandomElement(this.race);
    const randomPronouns = this.getRandomElement(this.pronouns);
    const randomDiscovery = this.getRandomElement(this.discovery);
    const randomOVRP = this.getRandomElement(this.ovrp);
    await this.page.locator('[id="patient-ethnicity"]').click();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
    await this.page.locator('[id="patient-race"]').click();
    await this.page.getByRole('option', { name: randomRace, exact: true }).click();
    await this.page.locator('[id="patient-pronouns"]').click();
    await this.page.getByRole('option', { name: randomPronouns, exact: true }).click();
    await this.page.locator('[id="patient-point-of-discovery"]').click();
    await this.page.getByRole('option', { name: randomDiscovery, exact: true }).click();
    await this.page.locator('[id="ovrp-interest"]').click();
    await this.page.getByRole('option', { name: randomOVRP, exact: true }).click();
    return { randomEthnicity, randomRace, randomPronouns, randomOVRP, randomDiscovery };
  }
  async PatientDetailsWithFilledPaperwor() {
    const randomEthnicity = this.getRandomElement(this.ethnicity);
    const randomRace = this.getRandomElement(this.race);
    const randomPronouns = this.getRandomElement(this.pronouns);
    const randomOVRP = this.getRandomElement(this.ovrp);
    await this.page.locator('[id="patient-ethnicity"]').click();
    await this.page.getByRole('option', { name: randomEthnicity, exact: true }).click();
    await this.page.locator('[id="patient-race"]').click();
    await this.page.getByRole('option', { name: randomRace, exact: true }).click();
    await this.page.locator('[id="patient-pronouns"]').click();
    await this.page.getByRole('option', { name: randomPronouns, exact: true }).click();
    await this.page.locator('[id="ovrp-interest"]').click();
    await this.page.getByRole('option', { name: randomOVRP, exact: true }).click();
    return { randomEthnicity, randomRace, randomPronouns, randomOVRP };
  }
  async ResponsiblePartyRandom() {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    const randomRelationship = this.getRandomElement(this.relationships);
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(1950, 2005).toString();
    const randomBirthSex = this.getRandomElement(this.birthSexes);
    await this.page.getByRole('heading', { name: 'Responsible party information' }).isVisible();
    await this.page.locator("[id='responsible-party-relationship']").click();
    await this.page.getByRole('option', { name: randomRelationship }).click();
    await this.page.locator("[id='responsible-party-first-name']").click();
    await this.page.locator("[id='responsible-party-first-name']").fill(firstName);
    await this.page.locator("[id='responsible-party-last-name']").click();
    await this.page.locator("[id='responsible-party-last-name']").fill(lastName);
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
    await this.page.locator("[id='responsible-party-birth-sex']").click();
    await this.page.getByRole('option', { name: randomBirthSex, exact: true }).click();
  }
  async ResponsiblePartyLegalGuardian() {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(1950, 2005).toString();
    const randomBirthSex = this.getRandomElement(this.birthSexes);
    await this.page.getByRole('heading', { name: 'Responsible party information' }).isVisible();
    await this.page.locator("[id='responsible-party-relationship']").click();
    await this.page.getByRole('option', { name: 'Legal Guardian' }).click();
    await this.page.locator("[id='responsible-party-first-name']").click();
    await this.page.locator("[id='responsible-party-first-name']").fill(firstName);
    await this.page.locator("[id='responsible-party-last-name']").click();
    await this.page.locator("[id='responsible-party-last-name']").fill(lastName);
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
    await this.page.locator("[id='responsible-party-birth-sex']").click();
    await this.page.getByRole('option', { name: randomBirthSex, exact: true }).click();
  }
  async fillConsentForm() {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    const randomRelationships = this.getRandomElement(this.relationshipsConstentForms);
    await this.page.getByLabel('I have reviewed and accept HIPAA Acknowledgement *').check();
    await this.page.getByLabel('I have reviewed and accept Consent to Treat and Guarantee of Payment *').check();
    await this.page.getByPlaceholder('Type out your full name').click();
    await this.page.getByPlaceholder('Type out your full name').fill(firstName + ' ' + lastName);
    await this.page.locator("[id='full-name']").click();
    await this.page.locator("[id='full-name']").fill(firstName + ' ' + lastName);
    await this.page.locator("[id='consent-form-signer-relationship']").click();
    await this.page.getByRole('option', { name: randomRelationships }).click();
    return { firstName, lastName, randomRelationships };
  }
  async getMonthDay(monthStr: string, dayStr: string) {
    const monthNumber = new Date(`${monthStr} 01 2000`).toLocaleDateString(`en`, { month: `2-digit` });
    const dayNumber = new Date(`Jan ${dayStr} 2000`).toLocaleDateString(`en`, { day: `2-digit` });
    return { monthNumber, dayNumber };
  }
  async getToday() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear().toString().slice(-2);
    const formattedDate = `${month}/${day}/${year}`;
    return formattedDate;
  }
  async fillInsuranceRequiredFields() {
    const firstName = `TA-UserFN${this.getRandomString()}`;
    const lastName = `TA-UserLN${this.getRandomString()}`;
    const randomRelationships = this.getRandomElement(this.relationshipsInsurance);
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(1950, 2023).toString();
    const randomBirthSex = this.getRandomElement(this.birthSexes);
    await this.page.locator("[id='insurance-carrier']").click();
    await this.page.locator("[id='insurance-carrier']").fill('Insurance carrier test');
    await this.page.locator("[id='insurance-member-id']").click();
    await this.page.locator("[id='insurance-member-id']").fill('Insurance member test');
    await this.page.locator("[id='policy-holder-first-name']").click();
    await this.page.locator("[id='policy-holder-first-name']").fill(firstName);
    await this.page.locator("[id='policy-holder-last-name']").click();
    await this.page.locator("[id='policy-holder-last-name']").fill(lastName);
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
    await this.page.locator("[id='policy-holder-birth-sex']").click();
    await this.page.getByRole('option', { name: randomBirthSex, exact: true }).click();
    await this.page.locator("[id='patient-relationship-to-insured']").click();
    await this.page.getByRole('option', { name: randomRelationships, exact: true }).click();
    await this.page.locator('[id="policy-holder-address"]').click();
    await this.page.locator('[id="policy-holder-address"]').fill('TestAddress 101');
    await this.page.locator('[id="policy-holder-city"]').click();
    await this.page.locator('[id="policy-holder-city"]').fill('TestCity');
    await this.page.locator('[id="policy-holder-state"]').click();
    await this.page.getByRole('option', { name: 'CO' }).click();
    await this.page.locator('[id="policy-holder-zip"]').click();
    await this.page.locator('[id="policy-holder-zip"]').fill('10111');

    return { firstName, lastName, randomRelationships };
  }
  async WalkinInformationAsProceed() {
    const WalkinFillingInformationAs = this.getRandomElement(this.WalkinFillInformationAsProceed);
    await this.page.getByRole('heading', { name: WalkinFillingInformationAs }).click();
  }
  async WalkinInformationAsParentProceed() {
    await this.page.getByRole('heading', { name: 'I am the Parent or legal' }).click();
  }
}
