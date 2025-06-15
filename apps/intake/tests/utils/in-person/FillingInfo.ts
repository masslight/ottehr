import { Page, expect, Locator } from '@playwright/test';

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
  private months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    const randomIndex = Math.min(Math.floor(Math.random() * (buttonCount - 1)) + 1, buttonCount - 1);
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
    // cspell:disable-next ykulik
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

  private async pressComboBox(locator: Locator) {
    await locator.hover();
    const cursorStyle = await locator.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(cursorStyle).toBe('pointer');
    await locator.click({ force: true });
  }

  private async pressDropdownOption(options: Parameters<typeof this.page.getByRole>['1'], awaitDropdownClose = true) {
    await expect(this.page.getByRole('option', options)).toBeVisible();
    const locator = this.page.getByRole('option', options);
    await locator.click();
    if (awaitDropdownClose) {
      await expect(locator).toBeVisible({ visible: false });
    }
  }

  async fillDOBgreater18() {
    const today = new Date();
    const YearMax = today.getFullYear() - 19;
    const YearMin = today.getFullYear() - 25;
    const randomMonth = this.getRandomElement(this.months);
    const randomDay = this.getRandomInt(1, 28).toString();
    const randomYear = this.getRandomInt(YearMin, YearMax).toString();

    await this.page.getByRole('combobox').nth(0).click();
    await this.pressDropdownOption({ name: randomMonth });

    const dayFieldLocator = this.page.getByRole('combobox').nth(1);
    await this.pressComboBox(dayFieldLocator);
    await this.pressDropdownOption({ name: randomDay, exact: true });

    const yearFieldLocator = this.page.getByRole('combobox').nth(2);
    await this.pressComboBox(yearFieldLocator);
    await this.pressDropdownOption({ name: randomYear }, false);

    return { randomMonth, randomDay, randomYear };
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
  async fillVisitReason() {
    const reason = this.getRandomElement(this.reasonForVisit);
    const enteredReason = this.getRandomString();
    await this.page.getByLabel('Reason for visit *', { exact: true }).click();
    await this.page.getByRole('option', { name: reason, exact: true }).click();
    await this.page.getByRole('textbox', { name: 'Tell us more (optional)' }).fill(enteredReason);
    return { reason, enteredReason };
  }
  async fillCorrectDOB(month: string, day: string, year: string) {
    await this.page.getByRole('combobox').nth(0).click();
    await this.page.getByRole('option', { name: month }).click();

    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: day, exact: true }).click();

    await this.page.getByRole('combobox').nth(2).click();
    await this.page.getByRole('option', { name: year }).click();
  }
}
