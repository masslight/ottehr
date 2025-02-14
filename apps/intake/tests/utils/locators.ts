import { Locator, Page } from '@playwright/test';
import { dataTestIds } from '../../src/helpers/data-test-ids';

export class Locators {
  page: Page;
  scheduleInPersonVisitButton: Locator;
  differentFamilyMember: Locator;
  continueButton: Locator;
  reserveButton: Locator;
  thankYouHeading: Locator;
  locationName: Locator;
  prebookSlotReviewScreen: Locator;
  titleVisitDetails: Locator;
  titlePatient: Locator;
  titleLocation: Locator;
  descReviewScreen: Locator;
  pageTitle: Locator;
  privacyPolicyReviewScreen: Locator;
  termsAndConditions: Locator;
  proceedToPaperwork: Locator;
  firstAvailableTime: Locator;
  editPencilReviewScreen: Locator;
  modifyTimeThankYouScreen: Locator;
  cancelVisitThankYouScreen: Locator;
  cancelScreenHeading: Locator;
  submitModifyTime: Locator;
  cancellationReasonField: Locator;
  cancelVisitButton: Locator;
  cancelConfirmationScreenHeading: Locator;
  bookAgainButton: Locator;
  homeScreenHeading: Locator;
  streetAddress: Locator;
  streetAddressLine2: Locator;
  patientCity: Locator;
  patientState: Locator;
  patientZip: Locator;
  patientEmail: Locator;
  patientNumber: Locator;
  mobileOptIn: Locator;
  patientEthnicity: Locator;
  patientRace: Locator;
  patientPreferredLanguage: Locator;
  selfPayOption: Locator;
  responsiblePartyRelationship: Locator;
  responsiblePartyFirstName: Locator;
  responsiblePartyLastName: Locator;
  responsiblePartyBirthSex: Locator;
  hipaaAcknowledgement: Locator;
  consentToTreat: Locator;
  signature: Locator;
  consentFullName: Locator;
  consentSignerRelationship: Locator;
  editPaperwork: Locator;
  flowHeading: Locator;
  startInPersonVisitButton: Locator;
  confirmWalkInButton: Locator;
  checkInHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scheduleInPersonVisitButton = page.getByTestId(dataTestIds.scheduleInPersonVisitButton);
    this.differentFamilyMember = page.getByTestId(dataTestIds.differentFamilyMember);
    this.continueButton = page.getByTestId(dataTestIds.continueButton);
    if (this.continueButton == null) {
      this.continueButton = page.getByText('Continue');
    }
    this.reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    this.flowHeading = page.getByTestId(dataTestIds.flowPageTitle);
    this.thankYouHeading = page.getByRole('heading', { name: 'Thank you for choosing Ottehr!' });
    this.startInPersonVisitButton = page.getByTestId(dataTestIds.startInPersonVisitButton);
    this.continueButton = page.getByText('Continue');
    this.reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    this.confirmWalkInButton = page.getByRole('button', { name: 'Confirm this walk-in time' });
    this.thankYouHeading = page.getByRole('heading', { name: 'Thank you for choosing Ottehr!' });
    this.checkInHeading = page.getByRole('heading', { name: 'You are checked in!' });
    this.locationName = page.getByTestId(dataTestIds.locationNameReviewScreen);
    this.prebookSlotReviewScreen = page.getByTestId(dataTestIds.prebookSlotReviewScreen);
    this.titleVisitDetails = page.getByRole('heading', { name: 'Visit details' });
    this.titlePatient = page.getByText('Patient');
    this.titleLocation = page.getByText('Location');
    this.descReviewScreen = page.getByText('Review and confirm all details below.');
    this.pageTitle = page.getByTestId(dataTestIds.flowPageTitle);
    this.privacyPolicyReviewScreen = page.getByTestId(dataTestIds.privacyPolicyReviewScreen);
    this.termsAndConditions = page.getByTestId(dataTestIds.termsAndConditionsReviewScreen);
    this.proceedToPaperwork = page.getByRole('button', { name: 'Proceed to paperwork' });
    this.firstAvailableTime = page.getByText('First available time');
    this.editPencilReviewScreen = page.getByTestId('EditOutlinedIcon');
    this.modifyTimeThankYouScreen = page.getByRole('button', { name: 'Modify' });
    this.cancelVisitThankYouScreen = page.getByRole('button', { name: 'Cancel' });
    this.cancelScreenHeading = page.getByText('Why are you canceling?');
    this.submitModifyTime = page.getByRole('button', { name: 'Modify', exact: false });
    this.cancellationReasonField = page.locator('#cancellationReason');
    this.cancelVisitButton = page.getByRole('button', { name: 'Cancel visit' });
    this.cancelConfirmationScreenHeading = page.getByRole('heading', { name: 'Your visit has been canceled' });
    this.bookAgainButton = page.getByRole('button', { name: 'Book again' });
    this.homeScreenHeading = page.getByRole('heading', { name: 'Welcome to Ottehr' });
    this.streetAddress = page.locator('[id="patient-street-address"]');
    this.streetAddressLine2 = page.locator('[id="patient-street-address-2"]');
    this.patientCity = page.locator('[id="patient-city"]');
    this.patientState = page.locator('[id="patient-state"]');
    this.patientZip = page.locator('[id="patient-zip"]');
    this.patientEmail = page.locator('[id="patient-email"]');
    this.patientNumber = page.locator('[id="patient-number"]');
    this.patientEthnicity = page.locator('[id="patient-ethnicity"]');
    this.patientRace = page.locator('[id="patient-race"]');
    this.patientPreferredLanguage = page.locator('[id="preferred-language"]');
    this.mobileOptIn = page.getByLabel('mobile-opt-in-label');
    this.selfPayOption = page.getByLabel('I will pay without insurance');
    this.responsiblePartyRelationship = page.locator('[id="responsible-party-relationship"]');
    this.responsiblePartyFirstName = page.locator('[id="responsible-party-first-name"]');
    this.responsiblePartyLastName = page.locator('[id="responsible-party-last-name"]');
    this.responsiblePartyBirthSex = page.locator('[id="responsible-party-birth-sex"]');
    this.hipaaAcknowledgement = page.getByLabel('I have reviewed and accept HIPAA Acknowledgement *');
    this.consentToTreat = page.getByLabel('I have reviewed and accept Consent to Treat and Guarantee of Payment *');
    this.signature = page.locator('[id="signature"]');
    this.consentFullName = page.locator('[id="full-name"]');
    this.consentSignerRelationship = page.locator('[id="consent-form-signer-relationship"]');
    this.editPaperwork = page.getByRole('button', { name: 'Edit paperwork' });
  }

  async selectDifferentFamilyMember(): Promise<void> {
    await this.differentFamilyMember.click({ force: true });
  }
  async clickContinueButton(): Promise<void> {
    await this.continueButton.click();
  }
  async clickReserveButton(): Promise<void> {
    await this.reserveButton.click();
  }
}
