import { expect, Locator, Page } from '@playwright/test';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export class Validations {
  page: Page;
  zipField: Locator;
  getStarted: Locator;
  zipValidationText: Locator;
  constructor(page: Page) {
    this.page = page;
    this.zipField = page.getByPlaceholder('ZIP');
    this.getStarted = page.getByRole('button', { name: 'Get Started' });
    this.zipValidationText = page.locator('#zip-helper-text');
  }

  async validateZip(zipValue: string, zipValidationText: string) {
    await this.zipField.click();
    await this.zipField.fill(zipValue);
    await this.getStarted.click();
    if (zipValue === '11111') {
      await expect(this.page.getByText('State with that ZIP code not found')).toBeVisible();
      await this.page.getByText('Close').click();
      await expect(this.page.getByText('State with that ZIP code not found')).toBeHidden();
    } else {
      await expect(this.zipValidationText).toHaveText(`${zipValidationText}`);
    }
  }

  async validateAvailableOptions(zipValue: string, expectedCount: number, stateName: string) {
    await this.zipField.click();
    await this.zipField.fill(zipValue);
    await this.getStarted.click();
    await expect(this.page).toHaveURL('/available-services');
    await expect(this.page.getByText('Services available in', { exact: false })).toHaveText(
      `Services available in ${stateName}`
    );
    const itemCount = await this.page.locator('.MuiTypography-h5').count();
    await expect(itemCount).toBe(expectedCount);
    if (expectedCount == 3) {
      await expect(this.page.getByText('Therapy appointment', { exact: true })).toBeVisible();
      await expect(this.page.getByText('Parent or sleep coaching', { exact: true })).toBeVisible();
      await expect(this.page.getByText('Consultation', { exact: true })).toBeVisible();
    } else {
      await expect(this.page.getByText('Parent or sleep coaching', { exact: true })).toBeVisible();
      await expect(this.page.getByText('Consultation', { exact: true })).toBeVisible();
    }
    await this.page.goto('/');
  }
  async validateEthnicity() {
    await this.page.locator("[id='patient-ethnicity']").click();
    const optionsLocator = this.page.locator('li[role="option"]');
    await expect(optionsLocator).toHaveCount(3);
    await expect(optionsLocator.nth(0)).toHaveText('Hispanic or Latino');
    await expect(optionsLocator.nth(1)).toHaveText('Not Hispanic or Latino');
    await expect(optionsLocator.nth(2)).toHaveText('Decline to Specify');
  }
  async validateRace() {
    await this.page.locator("[id='patient-race']").click();
    const options = [
      'American Indian or Alaska Native',
      'Asian',
      'Black or African American',
      'Native Hawaiian or Other Pacific Islander',
      'White',
      'Decline to Specify',
    ];
    for (const option of options) {
      await expect(this.page.getByRole('option', { name: option })).toBeVisible();
    }
  }
  async validatePronouns() {
    await this.page.locator("[id='patient-pronouns']").click();
    const options = ['He/him', 'She/her', 'They/them', 'My pronouns are not listed'];
    for (const option of options) {
      await expect(this.page.getByRole('option', { name: option })).toBeVisible();
    }
    await this.page.getByRole('option', { name: 'My pronouns are not listed' }).click();
    await expect(this.page.locator('#patient-pronouns-custom-label')).toBeVisible();
    await this.page.locator('text=Why do we ask this?').hover();
    await expect(
      this.page.locator('div[aria-label*="Pronoun responses are kept confidential in our system"]')
    ).toBeVisible();
  }
  async validateHowDidYouHear() {
    await this.page.locator("[id='patient-point-of-discovery']").click();
    const options = [
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
    ];
    for (const option of options) {
      await expect(this.page.getByRole('option', { name: option })).toBeVisible();
    }
    await this.page.getByRole('option', { name: 'School' }).click();
  }
  async validateVirtualOption() {
    await this.page.locator("[id='ovrp-interest']").click();
    const options = ['Yes/First available', 'No', 'Need more info'];
    for (const option of options) {
      await expect(this.page.getByRole('option', { name: option })).toBeVisible();
    }
    await this.page.getByRole('option', { name: 'No' }).click();
  }
}
