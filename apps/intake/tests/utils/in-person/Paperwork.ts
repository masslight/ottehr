import { Page, expect } from '@playwright/test';
import { FillingInfo } from './FillingInfo';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export class Paperwork {
  page: Page;
  constructor(page: Page) {
    this.page = page;
  }
  // Helper method to get a random element from an array
  private getRandomElement(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Helper method to get a random integer between min and max (inclusive)
  private getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  getRandomString() {
    return Math.random().toString().slice(2, 7);
  }
  async FillPaperworkNewPatientAsParentWOid() {
    const fillingInfo = new FillingInfo(this.page);
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    await this.page.getByRole('heading', { name: 'Contact information' }).isVisible({ timeout: 15000 });
    //  await expect(this.page.locator('input[id*="guardian-email."]')).toHaveValue(/.+/);
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await this.page.getByText('How did you hear about us? *').isVisible({ timeout: 15000 });
    const filledDetails = await fillingInfo.NewPatientDetails();
    const randomEthnicity = filledDetails.randomEthnicity;
    const randomRace = filledDetails.randomRace;
    const randomPronouns = filledDetails.randomPronouns;
    const randomDiscovery = filledDetails.randomDiscovery;
    const randomOVRP = filledDetails.randomOVRP;
    await continueButton.click();
    await this.page.getByText('Select payment option *').isVisible({ timeout: 15000 });
    await this.page.getByLabel('I will pay without insurance').check();
    await continueButton.click();
    await fillingInfo.ResponsiblePartyRandom();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Photo ID' }).isVisible({ timeout: 15000 });
    await continueButton.click();
    const consentFormsFilledData = await fillingInfo.fillConsentForm();
    const consentFormsRelationship = consentFormsFilledData.randomRelationships;
    const consentFormsFirstName = consentFormsFilledData.firstName;
    const consentFormsLastName = consentFormsFilledData.lastName;
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Review and submit' }).isVisible({ timeout: 15000 });
    return {
      randomEthnicity,
      randomRace,
      randomPronouns,
      randomOVRP,
      randomDiscovery,
      consentFormsRelationship,
      consentFormsFirstName,
      consentFormsLastName,
    };
  }
  async FillPaperworkExistingPatientAsParentWOid() {
    const fillingInfo = new FillingInfo(this.page);
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    await this.page.getByRole('heading', { name: 'Contact information' }).isVisible({ timeout: 15000 });
    //  await expect(this.page.locator('input[id*="guardian-email."]')).toHaveValue(/.+/);
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await this.page.getByText('How did you hear about us? *').isVisible({ timeout: 15000 });
    const filledDetails = await fillingInfo.PatientDetailsWithFilledPaperwor();
    const randomEthnicity = filledDetails.randomEthnicity;
    const randomRace = filledDetails.randomRace;
    const randomPronouns = filledDetails.randomPronouns;
    const randomOVRP = filledDetails.randomOVRP;
    await continueButton.click();
    await this.page.getByText('Select payment option *').isVisible({ timeout: 15000 });
    await this.page.getByLabel('I will pay without insurance').check();
    await continueButton.click();
    await fillingInfo.ResponsiblePartyRandom();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Photo ID' }).isVisible({ timeout: 15000 });
    await continueButton.click();
    await expect(this.page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
    await expect(this.page.getByPlaceholder('Type out your full name')).toHaveValue('');
    await expect(this.page.getByRole('textbox', { name: 'Full name' })).toHaveValue('');
    await expect(this.page.getByLabel('I have reviewed and accept HIPAA Acknowledgement *')).not.toBeChecked();
    await expect(
      this.page.getByLabel('I have reviewed and accept Consent to Treat and Guarantee of Payment *')
    ).not.toBeChecked();
    await fillingInfo.fillConsentForm();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Review and submit' }).isVisible({ timeout: 15000 });
    return { randomEthnicity, randomRace, randomPronouns, randomOVRP };
  }
  async FillPaperworkOnlyRequiredFields() {
    const fillingInfo = new FillingInfo(this.page);
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    await fillingInfo.fillContactInformationOnlyRequiredFields();
    await continueButton.click();
    await this.page.getByText('How did you hear about us? *').isVisible({ timeout: 15000 });
    const filledDetails = await fillingInfo.fillPatientDetailsOnlyRequiredFields();
    const randomEthnicity = filledDetails.randomEthnicity;
    const randomRace = filledDetails.randomRace;
    const randomOVRP = filledDetails.randomOVRP;
    await continueButton.click();
    await this.page.getByText('Select payment option *').isVisible({ timeout: 15000 });
    await this.page.getByLabel('I will pay without insurance').check();
    await continueButton.click();
    await fillingInfo.ResponsiblePartyLegalGuardian();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Photo ID' }).isVisible({ timeout: 15000 });
    await continueButton.click();
    await fillingInfo.fillConsentForm();
    await continueButton.click();
    await this.page.getByRole('heading', { name: 'Review and submit' }).isVisible({ timeout: 15000 });
    return { randomEthnicity, randomRace, randomOVRP };
  }
}
