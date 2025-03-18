import { Page, expect } from '@playwright/test';
import { waitForResponseWithData } from 'test-utils';
import { FillingInfo } from './FillingInfo';
import { UIDesign } from './UIdesign';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export class Paperwork {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private async nextBackClick(waitFor?: () => Promise<void>) {
    await this.page.getByRole('button', { name: 'Continue', exact: true }).click();

    if (waitFor) {
      await waitFor;
    }

    await expect(this.page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled({ timeout: 15000 });
    await this.page.getByRole('button', { name: 'Back', exact: true }).click();
  }

  private getCardOptionLocator(paymentMethod: string) {
    return this.page.locator(`input[type='radio'][value='${paymentMethod}']`);
  }

  private async getPaymentMethodFromConfirmCardRequest() {
    const response = await waitForResponseWithData(this.page, 'api.stripe.com/v1/setup_intents');
    return (await response.json())?.payment_method;
  }

  async fillAndCheckContactInformation(
    patientInfo: Awaited<ReturnType<FillingInfo['fillNewPatientInfo']>> | undefined
  ) {
    const fillingInfo = new FillingInfo(this.page);
    const uiDesign = new UIDesign(this.page);

    await uiDesign.contactInformationUIcheck(patientInfo?.firstName || '');
    const contactInformation = await fillingInfo.fillContactInformation();

    await this.nextBackClick();

    await this.checkContactInformation(contactInformation);
  }

  async checkContactInformation(contactInformation: Awaited<ReturnType<FillingInfo['fillContactInformation']>>) {
    await expect(this.page.locator('#patient-street-address')).toHaveValue(contactInformation.streetAddress);
    await expect(this.page.locator('#patient-street-address-2')).toHaveValue(contactInformation.streetAddress2);

    await expect(this.page.locator('#patient-city')).toHaveValue(contactInformation.patientCity);
    await expect(this.page.locator('#patient-zip')).toHaveValue(contactInformation.patientZIP);

    await expect(this.page.locator('#patient-email')).toHaveValue(contactInformation.email);
    await expect(this.page.locator('#patient-number')).toHaveValue(
      contactInformation.number.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') // parse number "1111111111" to "(111) 111-1111"
    );
  }

  async fillAndCheckPatientDetails() {
    const fillingInfo = new FillingInfo(this.page);
    const uiDesign = new UIDesign(this.page);

    await uiDesign.patientDetailsUIcheck();
    const patientDetails = await fillingInfo.fillPatientDetails();

    await this.nextBackClick();

    await this.page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(this.page.getByRole('heading', { name: 'Primary Care Physician' })).toBeVisible();
    await this.page.goBack();
    await this.checkPatientDetails(patientDetails);
  }

  async checkPatientDetails(patientDetails: Awaited<ReturnType<FillingInfo['fillPatientDetails']>>) {
    await expect(this.page.locator('#patient-ethnicity')).toHaveValue(patientDetails.ethnicity);
    await expect(this.page.locator('#patient-race')).toHaveValue(patientDetails.race);
    await expect(this.page.locator('#preferred-language')).toHaveValue(patientDetails.preferredLanguage);

    expect(await this.page.getByRole('radio', { name: 'No' }).count()).toBe(1);
    await expect(this.page.getByRole('radio', { name: 'No' })).toBeChecked();
  }

  async fillAndCheckEmptyCurrentMedications() {
    const value = 'Patient does not take any medications currently';

    await this.page.locator(`input[value='${value}']`).click();

    await this.nextBackClick(async () => {
      await this.page.getByRole('heading', { name: 'Current allergies', level: 2 }).waitFor({ state: 'visible' });
    });
    await expect(this.page.getByRole('heading', { name: 'Current medications' })).toBeVisible();

    await this.checkEmptyCurrentMedications(value);
  }

  async checkEmptyCurrentMedications(value: string) {
    await expect(this.page.getByRole('radio', { name: value })).toBeChecked();
  }

  async fillAndCheckEmptyCurrentAllergies() {
    const value = 'Patient has no known current allergies';

    await this.page.locator(`input[value='${value}']`).click();

    await this.nextBackClick();

    await this.checkEmptyCurrentAllergies(value);
  }

  async checkEmptyCurrentAllergies(value: string) {
    await expect(this.page.getByRole('radio', { name: value })).toBeChecked();
  }

  async fillAndCheckEmptyMedicalHistory() {
    const value = 'Patient has no current medical conditions';

    await this.page.locator(`input[value='${value}']`).click();

    await this.nextBackClick();

    await this.checkEmptyMedicalHistory(value);
  }

  async checkEmptyMedicalHistory(value: string) {
    await expect(this.page.getByRole('radio', { name: value })).toBeChecked();
  }

  async fillAndCheckEmptySurgicalHistory() {
    const value = 'Patient has no surgical history';

    await this.page.locator(`input[value='${value}']`).click();

    await this.nextBackClick();

    await this.checkEmptySurgicalHistory(value);
  }

  async checkEmptySurgicalHistory(value: string) {
    await expect(this.page.getByRole('radio', { name: value })).toBeChecked();
  }

  async fillAndCheckSelfPay() {
    await this.page.getByLabel('I will pay without insurance').click();
    await this.page.getByRole('button', { name: 'Continue' }).click();
    await this.page.click('#responsible-party-relationship');
    await this.page.getByText('Parent').click();
    await this.page.fill('#responsible-party-first-name', 'FN-Parent');
    await this.page.fill('#responsible-party-last-name', 'LN-Parent');
    await this.page.locator('input[aria-label="Choose date"]').click();
    await this.page.locator('button[aria-label="calendar view is open, switch to year view"]').click();
    await this.page.locator('[role="radio"][aria-current="date"]').evaluate((el) => el.scrollIntoView());
    await this.page.getByRole('radio', { name: '1980' }).click();
    await this.page.locator('button[role="gridcell"]').first().click();
    await this.page.getByRole('button', { name: 'OK' }).click();
    await this.page.click('#responsible-party-birth-sex');
    await this.page.getByText('Female').click();
    await this.page.fill('#responsible-party-number', '3425325324');
    await this.page.click('[data-testid="loading-button"]');
  }

  async checkSelfPay(paymentMethod: string) {
    await expect(this.page.locator("input[name='payment-option'][checked]")).toHaveValue('Self-pay');
    await expect(this.getCardOptionLocator(paymentMethod)).toBeChecked();
  }

  async fillAndCheckResponsiblePartyInfoAsSelf(
    patientInfo: Awaited<ReturnType<FillingInfo['fillNewPatientInfo']>> | undefined
  ) {
    await this.page.locator('#responsible-party-relationship').click();
    await this.page.getByRole('option', { name: 'Self' }).click();

    await this.nextBackClick();

    await this.checkResponsiblePartyInfoAsSelf(patientInfo);
  }

  async checkResponsiblePartyInfoAsSelf(
    patientInfo: Awaited<ReturnType<FillingInfo['fillNewPatientInfo']>> | undefined
  ) {
    await expect(this.page.locator('#responsible-party-first-name')).toBeDisabled();
    await expect(this.page.locator('#responsible-party-last-name')).toBeDisabled();
    await expect(this.page.locator("input[name='responsible-party-birth-sex']")).toBeDisabled();

    await expect(this.page.locator('#responsible-party-first-name')).toHaveValue(patientInfo?.firstName || '');
    await expect(this.page.locator('#responsible-party-last-name')).toHaveValue(patientInfo?.lastName || '');
    await expect(this.page.locator("input[name='responsible-party-birth-sex']")).toHaveValue(
      patientInfo?.birthSex || ''
    );
  }

  async fillAndCheckFillingOutAs() {
    const value = 'I am the parent or legally authorized representative of the minor patient';

    await this.page.locator(`input[value='${value}']`).click();

    await this.nextBackClick();

    await this.checkFillingOutAs(value);
  }

  async checkFillingOutAs(value: string) {
    await expect(this.page.locator("input[name='get-ready-for-the-visit-filling-out-as'][checked]")).toHaveValue(value);
  }

  async fillAndCheckAccompanyingPerson() {
    const accompanyingPerson = {
      firstName: 'firstName',
      lastName: 'lastName',
      phone: '1111111111',
      parsedPhone: '(111) 111-1111',
      relationship: 'Parent',
    };

    await this.page.locator('#person-accompanying-minor-first-name').click();
    await this.page.locator('#person-accompanying-minor-first-name').fill(accompanyingPerson.firstName);
    await this.page.locator('#person-accompanying-minor-last-name').click();
    await this.page.locator('#person-accompanying-minor-last-name').fill(accompanyingPerson.lastName);
    await this.page.locator('#person-accompanying-minor-phone-number').click();
    await this.page.locator('#person-accompanying-minor-phone-number').fill(accompanyingPerson.phone);
    await this.page.locator('#contacts-relationship-to-the-patient').click();
    await this.page.getByRole('option', { name: accompanyingPerson.relationship }).click();

    await this.nextBackClick();

    await this.checkAccompanyingPerson(accompanyingPerson);
  }

  async checkAccompanyingPerson(accompanyingPerson: {
    firstName: string;
    lastName: string;
    phone: string;
    parsedPhone: string;
    relationship: string;
  }) {
    await expect(this.page.locator('#person-accompanying-minor-first-name')).toHaveValue(accompanyingPerson.firstName);
    await expect(this.page.locator('#person-accompanying-minor-last-name')).toHaveValue(accompanyingPerson.lastName);
    await expect(this.page.locator('#person-accompanying-minor-phone-number')).toHaveValue(
      accompanyingPerson.parsedPhone
    );
    await expect(this.page.locator("input[name='contacts-relationship-to-the-patient']")).toHaveValue(
      accompanyingPerson.relationship
    );
  }

  async fillAndCheckReasonForVisit() {
    const fillingInfo = new FillingInfo(this.page);

    const reasonForVisit = await fillingInfo.fillReasonForVisit();

    await this.nextBackClick();

    await this.checkReasonForVisit(reasonForVisit);
  }

  async checkReasonForVisit(reasonForVisit: string) {
    await expect(this.page.getByText(reasonForVisit)).toBeVisible();
  }

  async fillAndCheckSchoolWorkNoteAsNone() {
    const value = 'Neither';

    await this.page.locator(`input[value='${value}']`).click();

    await this.nextBackClick();

    await this.checkSchoolWorkNoteAsNone(value);
  }

  async checkSchoolWorkNoteAsNone(value: string) {
    await expect(this.page.getByRole('radio', { name: value })).toBeChecked({ timeout: 10000 });
  }

  async fillAndCheckConsentForms() {
    await this.page.getByLabel('hipaa-acknowledgement-label').click();
    await this.page.getByLabel('consent-to-treat-label').click();
    await this.page.locator('#signature').fill('sign');
    await this.page.locator('#full-name').fill('Full Name');
    await this.page.locator('#consent-form-signer-relationship').click();
    await this.page.getByRole('option', { name: 'Parent' }).click();
    await this.nextBackClick();
    await this.checkConsentForms();
  }

  async checkConsentForms() {
    await expect(this.page.getByLabel('hipaa-acknowledgement-label').getByRole('checkbox')).toBeChecked();
    await expect(this.page.getByLabel('consent-to-treat-label').getByRole('checkbox')).toBeChecked();
    await expect(this.page.locator('#signature')).toHaveValue('sign');
    await expect(this.page.locator('#full-name')).toHaveValue('Full Name');
    await expect(this.page.locator('#consent-form-signer-relationship')).toHaveValue('Parent');
  }

  async fillAndCheckNoInviteParticipant() {
    const value = 'No, only one device will be connected';
    await this.page.locator(`input[value='${value}']`).click();
  }
}
