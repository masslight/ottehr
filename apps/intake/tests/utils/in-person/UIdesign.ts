/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { expect, Page } from '@playwright/test';
export class UIDesign {
  page: Page;
  constructor(page: Page) {
    this.page = page;
  }
  async PatientDetailsUIcheck(firstName: string, middleName: string, lastName: string) {
    await expect(this.page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await expect(this.page.locator(`text=${firstName} ${middleName} ${lastName}`)).toBeVisible();
    await expect(this.page.getByText("Patient's ethnicity")).toBeVisible();
    await expect(this.page.locator("[id='patient-ethnicity']")).toBeVisible();
    await expect(this.page.getByText("Patient's race")).toBeVisible();
    await expect(this.page.locator("[id='patient-race']")).toBeVisible();
    await expect(this.page.getByText('Preferred pronouns')).toBeVisible();
    await expect(this.page.locator("[id='patient-pronouns']")).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Primary Care Physician information' })).toBeVisible();
    //await expect(this.page.getByLabel('PCP first name')).toBeVisible();
    await expect(this.page.locator("[id='pcp-first']")).toBeVisible();
    //await expect(this.page.getByLabel('PCP last name')).toBeVisible();
    await expect(this.page.locator("[id='pcp-last']")).toBeVisible();
    //await expect(this.page.getByLabel('PCP phone number')).toBeVisible();
    await expect(this.page.locator("[id='pcp-number']")).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Preferred pharmacy' })).toBeVisible();
    //await expect(this.page.getByLabel('Pharmacy name')).toBeVisible();
    await expect(this.page.locator("[id='pharmacy-name']")).toBeVisible();
    //await expect(this.page.getByLabel('Pharmacy address')).toBeVisible();
    await expect(this.page.locator("[id='pharmacy-address']")).toBeVisible();
    //await expect(this.page.getByLabel('Pharmacy phone')).toBeVisible();
    await expect(this.page.locator("[id='pharmacy-phone']")).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Additional information' })).toBeVisible();
    await expect(this.page.getByText('How did you hear about us?')).toBeVisible();
    await expect(this.page.locator("[id='patient-point-of-discovery']")).toBeVisible();
    await expect(
      this.page.getByText(
        'For eligible visits, you can (optionally) be seen by a virtual provider via an iPad, partnered with our in-office nursing/support team. These visits feature all our typical office care, including: lab testing, vital signs, throat/ear exams, medications, school notes, prescriptions, injury care, and more!'
      )
    ).toBeVisible();
    await expect(
      this.page.getByText(
        "Would you be interested in seeing a virtual provider (if it's an option) to save time for this visit?"
      )
    ).toBeVisible();
    await expect(this.page.locator("[id='ovrp-interest']")).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Continue' })).toBeVisible();
  }
  async WalkinCheckInScreenPaperworkMissing() {
    await expect(this.page.getByRole('heading', { name: 'You are checked in!' })).toBeVisible({ timeout: 25000 });
    await expect(this.page.getByText('Paperwork missing')).toBeVisible();
    await expect(this.page.getByRole('link', { name: 'Complete paperwork' })).toBeVisible();
    await expect(this.page.getByText('You are checked in', { exact: true })).toBeVisible();
    await expect(this.page.getByText(`${process.env.SLUG_ONE}`)).toBeVisible();
    await expect(this.page.getByText('1-minute survey', { exact: true })).toBeVisible();
    const link = await this.page.locator('a.appointments-button');
    await expect(link).toHaveAttribute('href', 'https://www.example.com/survey');
    // await expect(page.getByRole('button', { name: '-minute survey' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Register another patient' })).toBeVisible();
    await expect(this.page.getByRole('img', { name: 'Ottehr In Person' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(this.page.getByLabel('Help button')).toBeVisible();
  }
  async WalkinCheckInScreenPaperworkComplete() {
    await expect(this.page.getByRole('heading', { name: 'You are checked in!' })).toBeVisible({ timeout: 35000 });
    await expect(this.page.getByText('Your paperwork is complete')).toBeVisible();
    await expect(this.page.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(this.page.getByText('You are checked in', { exact: true })).toBeVisible();
    await expect(this.page.getByText(`${process.env.SLUG_ONE}`)).toBeVisible();
    await expect(this.page.getByText('1-minute survey', { exact: true })).toBeVisible();
    const link = await this.page.locator('a.appointments-button');
    await expect(link).toHaveAttribute('href', 'https://www.example.com/survey');
    // await expect(page.getByRole('button', { name: '-minute survey' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Register another patient' })).toBeVisible();
    await expect(this.page.getByRole('img', { name: 'Ottehr In Person' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(this.page.getByLabel('Help button')).toBeVisible();
  }
}
