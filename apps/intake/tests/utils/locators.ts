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
  titleReviewScreen: Locator;
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
  contactInformationHeading: Locator;
  patientDetailsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scheduleInPersonVisitButton = page.getByTestId(dataTestIds.scheduleInPersonVisitButton);
    this.differentFamilyMember = page.getByText('Different family member');
    this.continueButton = page.getByText('Continue');
    this.reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    this.thankYouHeading = page.getByRole('heading', { name: 'Thank you for choosing Ottehr!' });
    this.locationName = page.getByTestId(dataTestIds.locationNameReviewScreen);
    this.prebookSlotReviewScreen = page.getByTestId(dataTestIds.prebookSlotReviewScreen);
    this.titleReviewScreen = page.getByRole('heading', { name: 'Review and submit' });
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
    this.proceedToPaperwork = page.getByRole('button', { name: 'Proceed to paperwork' });
    this.streetAddress = page.locator('[id="patient-street-address"]');
    this.streetAddressLine2 = page.locator('[id="patient-street-address-2"]');
    this.patientCity = page.locator('[id="patient-city"]');
    this.patientState = page.locator('[id="patient-state"]');
    this.patientZip = page.locator('[id="patient-zip"]');
    this.patientEmail = page.locator('[id="patient-email"]');
    this.patientNumber = page.locator('[id="patient-number"]');
    this.mobileOptIn = page.getByLabel('mobile-opt-in-label');
    this.contactInformationHeading = page.getByRole('heading', { name: 'Contact information' });
    this.patientDetailsHeading = page.getByRole('heading', { name: 'Patient details' });
  }

  async selectDifferentFamilyMember(): Promise<void> {
    await this.differentFamilyMember.click();
  }
  async clickContinueButton(): Promise<void> {
    await this.continueButton.click();
  }
  async clickReserveButton(): Promise<void> {
    await this.reserveButton.click();
  }
}
