import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from '../../src/helpers/data-test-ids';

export class Locators {
  page: Page;
  scheduleInPersonVisitButton: Locator;
  scheduleVirtualVisitButton: Locator;
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
  firstAvailableTimeButton: Locator;
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
  patientPronouns: Locator;
  patientMyPronounsLabel: Locator;
  patientMyPronounsInput: Locator;
  patientPointOfDiscovery: Locator;
  pcpFirstName: Locator;
  pcpLastName: Locator;
  pcpPractice: Locator;
  pcpAddress: Locator;
  pcpNumber: Locator;
  backButton: Locator;
  pcpNumberErrorText: Locator;
  appointmentDescription: Locator;
  goToWaitingRoomButton: Locator;
  clearImage: Locator;
  photoIdFrontImage: Locator;
  photoIdBackImage: Locator;
  responsiblePartyNumber: Locator;
  numberErrorText: Locator;
  zipErrorText: Locator;
  responsiblePartyDOBAnswer: Locator;
  dateOlder18YearsError: Locator;
  dateFutureError: Locator;
  calendarCurrentDay: Locator;
  calendarButtonOK: Locator;
  calendarArrowRight: Locator;
  calendarArrowDown: Locator;
  calendarDay: Locator;
  insuranceOption: Locator;
  insuranceHeading: Locator;
  insuranceCarrier: Locator;
  insuranceCarrierFirstOption: Locator;
  insuranceMemberID: Locator;
  policyHolderFirstName: Locator;
  policyHolderLastName: Locator;
  policyHolderMiddleName: Locator;
  policyHolderBirthSex: Locator;
  patientRelationship: Locator;
  policyHolderAddress: Locator;
  policyHolderAddressLine2: Locator;
  policyHolderCity: Locator;
  policyHolderState: Locator;
  policyHolderZip: Locator;
  policyHolderDOB: Locator;
  insuranceFrontImage: Locator;
  insuranceBackImage: Locator;
  secondaryInsuranceCarrier: Locator;
  secondaryInsuranceMemberID: Locator;
  secondaryPolicyHolderFirstName: Locator;
  secondaryPolicyHolderLastName: Locator;
  secondaryPolicyHolderMiddleName: Locator;
  secondaryPolicyHolderBirthSex: Locator;
  secondaryPatientRelationship: Locator;
  secondaryPolicyHolderAddress: Locator;
  secondaryPolicyHolderAddressLine2: Locator;
  secondaryPolicyHolderCity: Locator;
  secondaryPolicyHolderState: Locator;
  secondaryPolicyHolderZip: Locator;
  secondaryPolicyHolderDOB: Locator;
  secondaryInsuranceFrontImage: Locator;
  secondaryInsuranceBackImage: Locator;
  secondaryInsuranceCarrierSecondOption: Locator;
  addSecondaryInsurance: Locator;
  removeSecondaryInsurance: Locator;
  secondaryInsuranceHeading: Locator;
  policyAddressIsTheSame: Locator;
  secondaryPolicyAddressIsTheSame: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scheduleInPersonVisitButton = page.getByTestId(dataTestIds.scheduleInPersonVisitButton);
    this.scheduleVirtualVisitButton = page.getByTestId(dataTestIds.scheduleVirtualVisitButton);
    this.startInPersonVisitButton = page.getByTestId(dataTestIds.startInPersonVisitButton);
    this.differentFamilyMember = page.getByTestId(dataTestIds.differentFamilyMember);
    this.continueButton = page.getByTestId(dataTestIds.continueButton);
    if (this.continueButton == null) {
      this.continueButton = page.getByText('Continue');
    }
    this.flowHeading = page.getByTestId(dataTestIds.flowPageTitle);
    this.thankYouHeading = page.getByRole('heading', { name: 'Thank you for choosing Ottehr!' });
    this.startInPersonVisitButton = page.getByTestId(dataTestIds.startInPersonVisitButton);
    this.confirmWalkInButton = page.getByRole('button', { name: 'Confirm this walk-in time' });
    this.checkInHeading = page.getByRole('heading', { name: 'You are checked in!' });
    this.locationName = page.getByTestId(dataTestIds.locationNameReviewScreen);
    this.pageTitle = page.getByTestId(dataTestIds.flowPageTitle);
    this.proceedToPaperwork = page.getByRole('button', { name: 'Proceed to paperwork' });
    this.firstAvailableTime = page.getByText('First available time');
    this.editPaperwork = page.getByRole('button', { name: 'Edit paperwork' });
    this.backButton = page.getByTestId(dataTestIds.backButton);
    this.bookAgainButton = page.getByRole('button', { name: 'Book again' });
    this.homeScreenHeading = page.getByRole('heading', { name: 'Welcome to Ottehr' });
    this.numberErrorText = page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx');
    this.zipErrorText = page.getByText('ZIP Code must be 5 numbers');
    this.dateOlder18YearsError = page.getByText('Must be 18 years or older');
    this.dateFutureError = page.getByText('Date may not be in the future');
    this.appointmentDescription = page.locator('.appointment-description');
    this.goToWaitingRoomButton = page.getByRole('button', { name: 'Go to the Waiting Room' });

    // Review page locators
    this.prebookSlotReviewScreen = page.getByTestId(dataTestIds.prebookSlotReviewScreen);
    this.titleVisitDetails = page.getByRole('heading', { name: 'Visit details' });
    this.titlePatient = page.getByText('Patient');
    this.titleLocation = page.getByText('Location');
    this.descReviewScreen = page.getByText('Review and confirm all details below.');
    this.privacyPolicyReviewScreen = page.getByTestId(dataTestIds.privacyPolicyReviewScreen);
    this.termsAndConditions = page.getByTestId(dataTestIds.termsAndConditionsReviewScreen);
    this.reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    this.confirmWalkInButton = page.getByRole('button', { name: 'Confirm this walk-in time' });

    // Modify locators
    this.firstAvailableTimeButton = page.getByRole('button', { name: 'First available time' });
    this.editPencilReviewScreen = page.getByTestId('EditOutlinedIcon');
    this.modifyTimeThankYouScreen = page.getByRole('button', { name: 'Modify' });
    this.submitModifyTime = page.getByRole('button', { name: 'Modify', exact: false });

    //Cancel visit locators
    this.cancelVisitThankYouScreen = page.getByRole('button', { name: 'Cancel' });
    this.cancelScreenHeading = page.getByText('Why are you canceling?');
    this.cancellationReasonField = page.locator('#cancellationReason');
    this.cancelVisitButton = page.getByRole('button', { name: 'Cancel visit' });
    this.cancelConfirmationScreenHeading = page.getByRole('heading', { name: 'Your visit has been canceled' });

    // Contact information locators
    this.streetAddress = page.locator('[id="patient-street-address"]');
    this.streetAddressLine2 = page.locator('[id="patient-street-address-2"]');
    this.patientCity = page.locator('[id="patient-city"]');
    this.patientState = page.locator('[id="patient-state"]');
    this.patientZip = page.locator('[id="patient-zip"]');
    this.patientEmail = page.locator('[id="patient-email"]');
    this.patientNumber = page.locator('[id="patient-number"]');

    // Patient details locators
    this.patientEthnicity = page.locator('[id="patient-ethnicity"]');
    this.patientRace = page.locator('[id="patient-race"]');
    this.patientPronouns = page.locator('[id="patient-pronouns"]');
    this.patientMyPronounsLabel = page.getByText('My pronouns');
    this.patientMyPronounsInput = page.locator('[id="patient-pronouns-custom"]');
    this.patientPreferredLanguage = page.locator('[id="preferred-language"]');
    this.patientPointOfDiscovery = page.locator('[id="patient-point-of-discovery"]');
    this.mobileOptIn = page.getByLabel('mobile-opt-in-label');

    // Payment, insurance locators
    this.selfPayOption = page.getByLabel('I will pay without insurance');
    this.insuranceOption = page.getByLabel('I have insurance');
    this.insuranceHeading = page.getByText('Insurance details');
    this.insuranceCarrier = page.locator("[id='insurance-carrier']");
    this.insuranceCarrierFirstOption = page.locator("[id='insurance-carrier-option-0']");
    this.insuranceMemberID = page.locator("[id='insurance-member-id']");
    this.policyHolderFirstName = page.locator("[id='policy-holder-first-name']");
    this.policyHolderMiddleName = page.locator("[id='policy-holder-middle-name']");
    this.policyHolderLastName = page.locator("[id='policy-holder-last-name']");
    this.policyHolderBirthSex = page.locator("[id='policy-holder-birth-sex']");
    this.patientRelationship = page.locator("[id='patient-relationship-to-insured']");
    this.policyHolderAddress = page.locator('[id="policy-holder-address"]');
    this.policyHolderAddressLine2 = page.locator('[id="policy-holder-address-additional-line"]');
    this.policyHolderCity = page.locator('[id="policy-holder-city"]');
    this.policyHolderState = page.locator('[id="policy-holder-state"]');
    this.policyHolderZip = page.locator('[id="policy-holder-zip"]');
    this.policyHolderDOB = page.locator('[name="policy-holder-date-of-birth.answer.0.valueString"]');
    this.insuranceFrontImage = page.locator('#insurance-card-front-description');
    this.insuranceBackImage = page.locator('#insurance-card-back-description');
    this.policyAddressIsTheSame = page.getByLabel('policy-holder-address-as-patient-label');

    // Secondary insurance locators
    this.addSecondaryInsurance = page.getByRole('button', { name: 'Add Secondary Insurance' });
    this.removeSecondaryInsurance = page.getByRole('button', { name: 'Remove Secondary Insurance' });
    this.secondaryInsuranceHeading = page.getByText('Secondary insurance details');
    this.secondaryInsuranceCarrier = page.locator("[id='secondary-insurance.item.0']");
    this.secondaryInsuranceCarrierSecondOption = page.locator("[id='secondary-insurance.item.0-option-1']");
    this.secondaryInsuranceMemberID = page.locator("[id='secondary-insurance.item.1']");
    this.secondaryPolicyHolderFirstName = page.locator("[id='secondary-insurance.item.2']");
    this.secondaryPolicyHolderMiddleName = page.locator("[id='secondary-insurance.item.3']");
    this.secondaryPolicyHolderLastName = page.locator("[id='secondary-insurance.item.4']");
    this.secondaryPolicyHolderBirthSex = page.locator("[id='secondary-insurance.item.6']");
    this.secondaryPatientRelationship = page.locator("[id='secondary-insurance.item.13']");
    this.secondaryPolicyHolderAddress = page.locator('[id="secondary-insurance.item.8"]');
    this.secondaryPolicyHolderAddressLine2 = page.locator('[id="secondary-insurance.item.9"]');
    this.secondaryPolicyHolderCity = page.locator('[id="secondary-insurance.item.10"]');
    this.secondaryPolicyHolderState = page.locator('[id="secondary-insurance.item.11"]');
    this.secondaryPolicyHolderZip = page.locator('[id="secondary-insurance.item.12"]');
    this.secondaryPolicyHolderDOB = page.locator('[name="secondary-insurance.item.5.answer.0.valueString"]');
    this.secondaryInsuranceFrontImage = page.locator('[id="secondary-insurance.item.14-description"]');
    this.secondaryInsuranceBackImage = page.locator('[id="secondary-insurance.item.15-description"]');
    this.secondaryPolicyAddressIsTheSame = page.getByLabel('policy-holder-address-as-patient-2-label');

    // Responsible Party locators
    this.responsiblePartyRelationship = page.locator('[id="responsible-party-relationship"]');
    this.responsiblePartyFirstName = page.locator('[id="responsible-party-first-name"]');
    this.responsiblePartyLastName = page.locator('[id="responsible-party-last-name"]');
    this.responsiblePartyBirthSex = page.locator('[id="responsible-party-birth-sex"]');
    this.responsiblePartyNumber = page.locator('[id="responsible-party-number"]');
    this.responsiblePartyDOBAnswer = page.locator('[name="responsible-party-date-of-birth.answer.0.valueString"]');

    // Paperwork calendar locators
    this.calendarCurrentDay = page.locator('button[aria-current="date"]');
    this.calendarButtonOK = page.locator('button:has-text("OK")');
    this.calendarArrowRight = page.getByTestId('ArrowRightIcon');
    this.calendarArrowDown = page.locator('[role="presentation"] [data-testid="ArrowDropDownIcon"]');
    this.calendarDay = page.locator('div[aria-rowindex="2"] button[aria-colindex="1"]').nth(0);

    //Consent forms locators
    this.hipaaAcknowledgement = page.getByLabel('I have reviewed and accept HIPAA Acknowledgement *');
    this.consentToTreat = page.getByLabel('I have reviewed and accept Consent to Treat and Guarantee of Payment *');
    this.signature = page.locator('[id="signature"]');
    this.consentFullName = page.locator('[id="full-name"]');
    this.consentSignerRelationship = page.locator('[id="consent-form-signer-relationship"]');

    // PCP locators
    this.pcpFirstName = page.locator('[id="pcp-first"]');
    this.pcpLastName = page.locator('[id="pcp-last"]');
    this.pcpPractice = page.locator('[id="pcp-practice"]');
    this.pcpAddress = page.locator('[id="pcp-address"]');
    this.pcpNumber = page.locator('[id="pcp-number"]');
    this.pcpNumberErrorText = page.locator('[id="pcp-number-helper-text"]');

    // Photo ID locators
    this.clearImage = page.getByRole('button', { name: 'Clear' });
    this.photoIdFrontImage = page.locator('#photo-id-front-description');
    this.photoIdBackImage = page.locator('#photo-id-back-description');
  }

  async selectDifferentFamilyMember(): Promise<void> {
    await this.differentFamilyMember.click({ force: true });
  }
  async clickContinueButton(awaitNavigation = false): Promise<unknown> {
    await expect(this.continueButton).toBeEnabled();
    const currentPath = new URL(this.page.url()).pathname;
    if (awaitNavigation) {
      return await Promise.all([
        this.page.waitForURL((url) => url.pathname !== currentPath),
        this.continueButton.click(),
      ]);
    } else {
      return await this.continueButton.click();
    }
  }
  async clickBackButton(): Promise<void> {
    await this.backButton.click();
  }
  async clickReserveButton(): Promise<void> {
    await this.reserveButton.click();
  }
}
