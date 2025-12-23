import { expect, Page } from '@playwright/test';
import { assert } from 'console';
import { BOOKING_CONFIG } from 'utils';

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

  // todo grab from config!
  private reasonForVisit = [BOOKING_CONFIG.reasonForVisitOptions[0]];
  private cancelReason = BOOKING_CONFIG.cancelReasonOptions.slice();
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
    const reasonForVisit = this.getRandomElement(this.reasonForVisit);
    const enteredReason = this.getRandomString();
    await this.page.locator('#patient-first-name').click();
    await this.page.locator('#patient-first-name').fill(firstName);
    await this.page.locator('#patient-last-name').click();
    await this.page.locator('#patient-last-name').fill(lastName);
    await this.page.locator('#patient-birth-sex').click();
    const birthSex = this.getRandomElement(birthSexes);
    await this.page.getByRole('option', { name: birthSex, exact: true }).click();
    await this.page.locator('#patient-email').click();
    await this.page.locator('#patient-email').fill(email);
    await this.page.getByLabel('Reason for visit *', { exact: true }).click();
    await this.page.getByRole('option', { name: reasonForVisit, exact: true }).click();
    await this.page.getByRole('textbox', { name: 'Tell us more (optional)' }).fill(enteredReason);
    return { firstName, lastName, birthSex, email, reasonForVisit, enteredReason };
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

  async selectFirstServiceCategory() {
    // Check if we're on the service category selection page

    const availableCategories = BOOKING_CONFIG.serviceCategories || [];
    const firstCategory = availableCategories[0];
    assert(firstCategory.display);

    if (firstCategory) {
      await this.page.getByText(firstCategory.display).click();
    }
  }
}
