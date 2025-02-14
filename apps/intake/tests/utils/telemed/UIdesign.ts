/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Page, expect } from '@playwright/test';

export class UIDesign {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async contactInformationUIcheck(firstName: string) {
    await expect(this.page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await expect(this.page.getByText(new RegExp(firstName))).toBeVisible();

    await expect(this.page.locator('#patient-street-address-label')).toBeVisible();
    await expect(this.page.locator('#patient-street-address')).toBeVisible();

    await expect(this.page.locator('#patient-street-address-2-label')).toBeVisible();
    await expect(this.page.locator('#patient-street-address-2')).toBeVisible();

    await expect(this.page.locator('#patient-city-label')).toBeVisible();
    await expect(this.page.locator('#patient-city')).toBeVisible();

    await expect(this.page.locator('#patient-state-label')).toBeVisible();
    await expect(this.page.locator('#patient-state')).toBeVisible();

    await expect(this.page.locator('#patient-zip-label')).toBeVisible();
    await expect(this.page.locator('#patient-zip')).toBeVisible();

    await expect(
      this.page.getByText('Please provide the information for the best point of contact regarding this reservation.')
    ).toBeVisible();

    await expect(this.page.locator('#patient-email-label')).toBeVisible();
    await expect(this.page.locator('#patient-email')).toBeVisible();

    await expect(this.page.locator('#patient-number-label')).toBeVisible();
    await expect(this.page.locator('#patient-number')).toBeVisible();

    await this.page.getByLabel('mobile-opt-in-label').scrollIntoViewIfNeeded();
    await expect(this.page.getByText('Yes! I would like to receive').nth(1)).toBeVisible();

    await expect(this.page.getByRole('button', { name: 'Continue' })).toBeVisible();
  }

  async patientDetailsUIcheck() {
    await expect(this.page.getByRole('heading', { name: 'Patient details' })).toBeVisible({ timeout: 10000 });

    await expect(this.page.locator('#patient-ethnicity-label')).toBeVisible();
    await expect(this.page.locator('#patient-ethnicity')).toBeVisible();

    await expect(this.page.locator('#patient-race-label')).toBeVisible();
    await expect(this.page.locator('#patient-race')).toBeVisible();

    await expect(this.page.locator('#patient-pronouns-label')).toBeVisible();
    await expect(this.page.locator('#patient-pronouns')).toBeVisible();

    await expect(this.page.getByRole('heading', { name: 'Additional information' })).toBeVisible();

    await expect(this.page.locator('#preferred-language-label')).toBeVisible();
    await expect(this.page.locator('#preferred-language')).toBeVisible();

    await expect(this.page.locator('#relay-phone-label')).toBeVisible();

    await expect(this.page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Continue' })).toBeVisible();
  }
}
