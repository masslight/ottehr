import { Page } from '@playwright/test';
import { FillingInfo } from './FillingInfo';
import { login } from 'test-utils';

export class BookPrebookVisit {
  page: Page;
  bookingURL: string;
  constructor(page: Page) {
    this.page = page;
    this.bookingURL = page.url();
  }

  async login(): Promise<void> {
    const fillingInfo = new FillingInfo(this.page);
    await this.page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await fillingInfo.selectSlot();
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    await login(this.page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);
  }

  async bookVisit(): Promise<{
    bookingURL: string;
    randomMonth: string;
    randomDay: string;
    randomYear: string;
    firstName: string;
    lastName: string;
  }> {
    const fillingInfo = new FillingInfo(this.page);
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    const reserveButton = this.page.getByRole('button', { name: 'Reserve this check-in time' });
    const newPatient = this.page.getByText('Different family member');
    await this.page.waitForTimeout(3000);
    await continueButton.click();
    await continueButton.click();
    await newPatient.click();
    await continueButton.click();
    const { firstName, lastName } = await fillingInfo.fillNewPatientInfo();
    const { randomMonth, randomDay, randomYear } = await fillingInfo.fillDOBgreater18();
    await continueButton.click();
    await reserveButton.click();
    await this.page.waitForURL(/\/visit/);
    await this.page.waitForTimeout(6000);
    const bookingURL = this.page.url();
    return { bookingURL, randomMonth, randomDay, randomYear, firstName, lastName };
  }

  async bookNewPatientGT18yoAsParentFromPatientsScreen(): Promise<{
    bookingURL: string;
    randomMonth: string;
    randomDay: string;
    randomYear: string;
    firstName: string;
    lastName: string;
    BirthSex: string;
    email: string;
    middleName: string;
  }> {
    const fillingInfo = new FillingInfo(this.page);
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    const reserveButton = this.page.getByRole('button', { name: 'Reserve this check-in time' });
    const newPatient = this.page.getByText('Different family member');
    await this.page.getByRole('heading', { name: 'Different family member' }).isVisible();
    await newPatient.click();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'About the patient' }).isVisible();
    const { firstName, lastName, BirthSex, email } = await fillingInfo.fillNewPatientInfo();
    const middleName = await fillingInfo.fillMiddleName();
    const { randomMonth, randomDay, randomYear } = await fillingInfo.fillDOBgreater18();
    await this.page.getByText('Parent/Guardian').click();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Review and submit' }).isVisible();
    await reserveButton.click();
    await this.page.waitForURL(/\/visit/);
    await this.page.getByRole('heading', { name: 'Thank you for choosing Ottehr' }).isVisible({ timeout: 15000 });
    await this.page.getByRole('button', { name: 'Proceed to Paperwork' }).isVisible({ timeout: 15000 });
    const bookingURL = this.page.url();
    return { bookingURL, randomMonth, randomDay, randomYear, firstName, lastName, BirthSex, email, middleName };
  }

  async bookNewPatientLess18(): Promise<{
    bookingURL: string;
    randomMonth: string;
    randomDay: string;
    randomYear: string;
    firstName: string;
    lastName: string;
    BirthSex: string;
    email: string;
    middleName: string;
  }> {
    const fillingInfo = new FillingInfo(this.page);
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    const reserveButton = this.page.getByRole('button', { name: 'Reserve this check-in time' });
    const newPatient = this.page.getByText('Different family member');
    await this.page.getByRole('heading', { name: 'Different family member' }).isVisible();
    await newPatient.click();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'About the patient' }).isVisible();
    const { firstName, lastName, BirthSex, email } = await fillingInfo.fillNewPatientInfo();
    const { randomMonth, randomDay, randomYear } = await fillingInfo.fillDOBless18();
    const middleName = await fillingInfo.fillMiddleName();
    await this.page.getByText('Parent/Guardian').click();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Review and submit' }).isVisible();
    await reserveButton.click();
    await this.page.waitForURL(/\/visit/);
    await this.page.getByRole('heading', { name: 'Thank you for choosing Ottehr' }).isVisible({ timeout: 15000 });
    await this.page.getByRole('button', { name: 'Proceed to Paperwork' }).isVisible({ timeout: 15000 });
    const bookingURL = this.page.url();
    return { bookingURL, randomMonth, randomDay, randomYear, firstName, lastName, BirthSex, email, middleName };
  }

  async bookNewPatientEqual18(): Promise<{
    bookingURL: string;
    Month: string;
    Day: string;
    Year: string;
    firstName: string;
    lastName: string;
    BirthSex: string;
    email: string;
  }> {
    const fillingInfo = new FillingInfo(this.page);
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    const reserveButton = this.page.getByRole('button', { name: 'Reserve this check-in time' });
    const newPatient = this.page.getByText('Different family member');
    await this.page.getByRole('heading', { name: 'Different family member' }).isVisible();
    await newPatient.click();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'About the patient' }).isVisible();
    const { firstName, lastName, BirthSex, email } = await fillingInfo.fillNewPatientInfo();
    const { Month, Day, Year } = await fillingInfo.fillDOBequal18();
    await this.page.getByText('Parent/Guardian').click();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Review and submit' }).isVisible();
    await reserveButton.click();
    await this.page.waitForURL(/\/visit/);
    await this.page.getByRole('heading', { name: 'Thank you for choosing Ottehr' }).isVisible({ timeout: 15000 });
    await this.page.getByRole('button', { name: 'Proceed to Paperwork' }).isVisible({ timeout: 15000 });
    const bookingURL = this.page.url();
    return { bookingURL, Month, Day, Year, firstName, lastName, BirthSex, email };
  }
}
